-- Support page (spec docs/superpowers/specs/2026-08-02-support-page-design.md §4).
-- A public contact form: anybody may write to the movement, so the insert path
-- is open to anon. The table itself is unreachable from client roles in BOTH
-- directions -- writes go through the definer RPC below, reads through the
-- self-gating admin view. No mail: the owner deferred it (§7), so there is no
-- emailed_at column until the change that actually sends something adds one.
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
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  -- The server is the source of truth: every rule the form enforces is
  -- restated here, so a caller bypassing the form gains nothing. The address
  -- check is deliberately looser than the client's -- it exists to stop
  -- nonsense, not to adjudicate address grammar and reject a real person.
  if p_name is null
     or length(btrim(p_name)) not between 1 and 60
     or p_message is null
     or length(btrim(p_message)) not between 10 and 2000
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
  values (btrim(p_name), v_email, v_phone, btrim(p_message), p_ip_hash)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function submit_support_message(text, text, text, text, text) to anon, authenticated;

-- Read path: same self-gating shape as the other admin_* views (spec §6), and
-- has_admin_role like admin_settings, the other super_admin-only view.
-- ip_hash is deliberately absent -- it exists to throttle, not to be read.
create view admin_support_messages as
select id, name, email, phone, message, created_at
from support_messages
where has_admin_role('super_admin');

grant select on admin_support_messages to authenticated;
