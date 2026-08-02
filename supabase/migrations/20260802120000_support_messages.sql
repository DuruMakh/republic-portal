-- Support page (spec docs/superpowers/specs/2026-08-02-support-page-design.md §4).
-- A public contact form. The table is unreachable from client roles in BOTH
-- directions: writes go through the definer RPC below, which only service_role
-- may execute, and reads through the self-gating admin view. The page is public
-- but the DATABASE call is not -- see the note above the grants for why the
-- throttle cannot work any other way. No mail: the owner deferred it (§7), so
-- there is no emailed_at column until the change that sends something adds one.
create table support_messages (
  id bigserial primary key,
  name text not null,
  email text,
  phone text,
  message text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);

alter table support_messages enable row level security;
revoke all on support_messages from anon, authenticated;
revoke all on sequence support_messages_id_seq from anon, authenticated;

-- Serves the rate-limit probe: newest rows for one hashed address.
create index support_messages_by_ip_recent on support_messages (ip_hash, created_at desc);

create function submit_support_message(
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_ip_hash text default null
) returns bigint
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id bigint;
  -- btrim's one-argument form strips ASCII SPACE only. JS .trim() strips all
  -- whitespace, so trimming with the default here would let a tab-or-newline
  -- payload satisfy a length check the client rejects -- and this function is
  -- the sole gate on the stored row. Every trim below uses the explicit set.
  v_ws constant text := E' \t\n\r\f\v';
  v_name text := btrim(coalesce(p_name, ''), v_ws);
  v_message text := btrim(coalesce(p_message, ''), v_ws);
  v_email text := nullif(btrim(coalesce(p_email, ''), v_ws), '');
  v_phone text := nullif(btrim(coalesce(p_phone, ''), v_ws), '');
begin
  -- The server is the source of truth: every rule the form enforces is
  -- restated here, so a caller bypassing the form gains nothing. Lengths are
  -- counted in CHARACTERS here and in code points on the client (see
  -- lib/support-schemas.ts) -- zod's default .min/.max count UTF-16 units,
  -- which disagree with this on any astral character. The address check is
  -- deliberately looser than the client's: it exists to stop nonsense, not to
  -- adjudicate address grammar and reject a real person.
  if length(v_name) not between 1 and 60
     or length(v_message) not between 10 and 2000
     or (v_email is null and v_phone is null)
     or (v_email is not null
         and (length(v_email) > 120
              or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
     or (v_phone is not null and length(v_phone) > 40) then
    raise exception 'invalid_support_message';
  end if;

  -- Public form: at most 3 messages per hashed address per 10 minutes.
  if p_ip_hash is not null and (
    select count(*) from public.support_messages
     where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'too_many_requests';
  end if;

  insert into public.support_messages (name, email, phone, message, ip_hash)
  values (v_name, v_email, v_phone, v_message, p_ip_hash)
  returning id into v_id;
  return v_id;
end $$;

-- NOT granted to anon/authenticated, unlike an earlier draft of this migration.
-- p_ip_hash is the throttle's key and the caller supplies it, so a client-role
-- grant would make the rate limit opt-in: anyone holding the public anon key
-- could POST to /rest/v1/rpc/submit_support_message, omit the argument (the
-- default null short-circuits the check) or send a fresh random value per
-- call, and insert without limit. Restricting EXECUTE to service_role makes
-- the server action the only caller, which is what the design always claimed,
-- and it is the only way to distinguish "our server" from "a browser holding
-- the same public key". app/(public)/support/actions.ts calls it through
-- lib/supabase/admin.ts for exactly this one statement.
revoke execute on function submit_support_message(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function submit_support_message(text, text, text, text, text) to service_role;

-- Read path: same self-gating shape as the other admin_* views (spec §6), and
-- has_admin_role like admin_settings, the other super_admin-only view.
-- ip_hash is deliberately absent -- it exists to throttle, not to be read.
create view admin_support_messages as
select id, name, email, phone, message, created_at
from support_messages
where has_admin_role('super_admin');

-- Revoke BEFORE granting. On instances with classic default privileges a view
-- is born with ALL granted to client roles, and this one is single-relation
-- over plain columns with no security_invoker and no WITH CHECK OPTION -- i.e.
-- auto-updatable, executing DML with the owner's RLS-exempt rights, and a
-- view's WHERE does not constrain INSERT. Without this line anon could POST to
-- /rest/v1/admin_support_messages and write straight into support_messages,
-- past RLS, past the table's own revoke and past every rule above. Same
-- reasoning and ordering as 20260719150000_community.sql:248 and
-- 20260728141000_fixed_membership_fee.sql:126.
revoke all on admin_support_messages from anon, authenticated;
grant select on admin_support_messages to authenticated;
