-- Account deletion, hardening (ADR-049; spec docs/superpowers/specs/2026-10-08-account-deletion-design.md).
-- The whole-branch review's fixes to 20261009140000_account_deletion.sql. That file is already
-- on staging, so its statements stay as they are and every change lands here; both files ship
-- together in the same migration-only release. Still additive for the code on main: nothing on
-- main calls erase_account() or the two wrappers, and the send-limit functions read
-- phone_verification_send_reservations the same way as before.
--
-- 1. erase_account() is restated in full (same signature, result and definer settings) with:
--    a) the person's profile and delegate rows locked first. A concurrent reassignment or
--       delegate change TO the departing person then either finishes before the erasure reads
--       anything, or waits and fails on the foreign key once the person is gone: no false
--       staff_history from a membership row added mid-erasure, no team member moved to central
--       without the note. These locks do NOT stop admin_approve_delegate(),
--       admin_reject_delegate(), admin_update_delegate_name() or admin_reveal_personal_id() from
--       committing a name-bearing audit row after the scrub: they take no lock and have no FOUND
--       check on their UPDATE. Release B (the application release) fixes that in a new migration.
--    b) the person's votes in polls that are still running (open, deadline not passed) deleted.
--       The erasure frees the phone number and the personal ID, so a person who deleted their
--       account and registered again could otherwise vote twice in the same poll. Votes in
--       closed or past-deadline polls stay, with no person attached, so finished results never
--       change (owner decision c). The polls are locked FOR SHARE first, as member_cast_vote()
--       does, so a poll cannot close between the status check and the delete.
--    c) Supabase auth's own log (auth.audit_log_entries: sign-ins, token events, with the email
--       and IP address in the payload) loses the rows the person caused. Best effort: if the
--       owner of this function may not delete there, or the table is gone, the erasure goes ahead
--       and only raises a notice. Rows other actors caused about the person are not matched.
--    d) a refusal for staff history still raises 'staff_history' (the app maps that token), and
--       now names the blocking foreign key in the error detail.
-- 2. service_role cannot run erase_account() either. 20261009140000 revoked it from public,
--    anon and authenticated only; the platform's default privileges had granted it to
--    service_role, and no server code needs it (the app calls the two wrappers).
-- 3. The sequence behind poll_votes.id (new in 20261009140000) is closed to the client roles,
--    which the platform's default privileges had given ALL (precedent: support_messages_id_seq).
-- 4. SMS send reservations survive an erasure without the account link. They used to cascade
--    away with the sign-in account, so deleting and re-registering wiped the history that the
--    per-number and site-wide send limits count (20261008160000). Now user_id is nullable and
--    set null. reserve_phone_verification_send() and complete_phone_verification_send() only
--    ever look rows up by `user_id = p_user_id` (never null for a live account), so an
--    anonymous row never matches a per-account rule or a completion; it still counts for its
--    phone number and for the site-wide hour, and the existing 24-hour cleanup removes it the
--    next time that number asks for a code. If that number never asks again, the anonymized row
--    keeps the phone number: nothing purges it until Release B adds a purge. The unique
--    (user_id, phone, purpose, idempotency_key) constraint treats nulls as distinct, so
--    anonymous rows never collide.
--    The security session that owns these tables confirmed nothing assumes user_id not null.

-- 1. The erasure --------------------------------------------------------------------------------
create or replace function public.erase_account(p_user_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_photo_url text;
  v_team uuid[];
  v_personal_keys constant text[] :=
    array['name', 'memberName', 'slug', 'firstName', 'lastName', 'personalId', 'phone', 'email'];
  v_constraint text;
  v_table text;
begin
  if p_user_id is null
     or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'invalid_target';
  end if;
  -- (a) the person's rows first; a concurrent erasure that got here first leaves nothing to lock
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'invalid_target';
  end if;
  perform 1 from public.delegates where id = p_user_id for update;
  if exists (select 1 from public.admin_roles where user_id = p_user_id) then
    raise exception 'staff_account';
  end if;

  select photo_url into v_photo_url from public.delegates where id = p_user_id;

  -- (b) votes in polls still running go; closed and past-deadline polls keep theirs anonymously.
  -- "Running" is exactly what member_cast_vote() still accepts a vote for.
  perform 1 from public.polls p
   where p.id in (select v.poll_id from public.poll_votes v where v.member_id = p_user_id)
   order by p.id
     for share;
  delete from public.poll_votes v
   using public.polls p
   where p.id = v.poll_id
     and v.member_id = p_user_id
     and p.status = 'open'
     and (p.ends_at is null or now() <= p.ends_at);

  -- the delegate's team moves to the central movement, marked for the cabinet note
  select coalesce(array_agg(member_id), '{}') into v_team
    from public.memberships where delegate_id = p_user_id and ended_at is null;
  update public.memberships set ended_at = now()
   where delegate_id = p_user_id and ended_at is null;
  insert into public.memberships (member_id, delegate_id, note)
    select unnest(v_team), null::uuid, 'delegate_left';
  -- history rows that still name the delegate lose the link (the FK would block the delete)
  update public.memberships set delegate_id = null where delegate_id = p_user_id;

  -- Audit rows about the person keep the action and lose the personal details. The key list
  -- and the per-action updates are unchanged from 20261009140000, which records where each
  -- key comes from.
  perform set_config('app.erasing', 'on', true);
  -- every row about the person is marked erased, with or without a personal key in it
  update public.audit_log
     set details = (coalesce(details, '{}'::jsonb) - v_personal_keys)
                   || jsonb_build_object('erased', true)
   where target_id = p_user_id::text;
  -- payment rows target the payment; details.memberId is the person
  update public.audit_log
     set details = (details - v_personal_keys) || jsonb_build_object('erased', true)
   where details ->> 'memberId' = p_user_id::text
     and details ?| v_personal_keys;
  update public.audit_log
     set details = (details - array['from', 'to']) || jsonb_build_object('erased', true)
   where target_id = p_user_id::text
     and action = 'delegate.update_name';
  update public.audit_log
     set details = (details - 'note') || jsonb_build_object('erased', true)
   where target_id = p_user_id::text
     and action = 'delegate.reject';
  update public.audit_log
     set details = (details - 'fromName') || jsonb_build_object('erased', true)
   where action = 'member.reassign'
     and details ->> 'fromDelegateId' = p_user_id::text;
  update public.audit_log
     set details = (details - 'toName') || jsonb_build_object('erased', true)
   where action = 'member.reassign'
     and details ->> 'toDelegateId' = p_user_id::text;
  perform set_config('app.erasing', 'off', true);

  -- (c) Supabase auth's own log, best effort: lacking the privilege never blocks the erasure
  begin
    delete from auth.audit_log_entries where payload ->> 'actor_id' = p_user_id::text;
  exception
    when insufficient_privilege or undefined_table then
      raise notice 'erase_account: auth.audit_log_entries not scrubbed (%)', sqlerrm;
  end;

  delete from auth.users where id = p_user_id;
  return jsonb_build_object('photoUrl', v_photo_url);
exception
  when foreign_key_violation then
    -- recorded payments, approvals, settings or audit rows as staff: keep the trail intact.
    -- (d) the token stays what the app maps; the detail says which foreign key refused.
    get stacked diagnostics v_constraint = constraint_name, v_table = table_name;
    raise exception 'staff_history'
      using detail = format('blocked by foreign key %s on %s', v_constraint, v_table);
end $$;

-- 2. Nobody runs the erasure directly; the two wrappers are the only way in.
revoke execute on function public.erase_account(uuid) from public, anon, authenticated, service_role;

-- 3. The vote id sequence is server-side only.
revoke all on sequence public.poll_votes_id_seq from anon, authenticated;

-- 4. SMS send reservations outlive the account, without it (see the header).
alter table public.phone_verification_send_reservations alter column user_id drop not null;
alter table public.phone_verification_send_reservations
  drop constraint phone_verification_send_reservations_user_id_fkey;
alter table public.phone_verification_send_reservations
  add constraint phone_verification_send_reservations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
