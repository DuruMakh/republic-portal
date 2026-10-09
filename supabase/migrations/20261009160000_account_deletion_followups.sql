-- Account deletion, follow-ups (ADR-047; spec docs/superpowers/specs/2026-10-08-account-deletion-design.md).
-- The whole-branch re-review's findings on 20261009140000 and 20261009150000. Both files are
-- already on staging, so their statements stay as they are and every change lands here; all three
-- ship together in the same database release (PR #49). Still additive for the code on main:
-- nothing on main calls erase_account(), and the three admin RPCs keep their signatures, results
-- and grants; they only refuse one more case.
--
-- 1. erase_account() is restated again, exactly as 20261009150000 has it, plus:
--    a) the person's own open membership row is locked FOR UPDATE right after the profile lock, so
--       a concurrent delegate change or reassignment of the person finishes first or waits;
--    b) the departing delegate's team is the set of rows the closing UPDATE itself ends
--       (`returning member_id`). Reading the team first and ending it second let a member who
--       moved to another delegate in between get a second open membership: the central row's
--       insert failed with 23505 on one_active_membership and the erasure was refused;
--    c) the person's SMS send reservations older than 24 hours are deleted. They feed no limit:
--       every window reserve_phone_verification_send() counts (20261008160000) is 24 hours or
--       shorter (60 seconds, 1 hour, 24 hours), so deleting and registering again still cannot
--       reset a send limit. Newer ones stay, anonymized by the foreign key (20261009150000).
--    Same signature, result and definer settings; the revokes are asserted again after it.
-- 2. A daily pg_cron job (01:30 UTC, after the 01:00 active-member sweep) deletes anonymized
--    reservations (user_id null) older than 24 hours, so a phone number that never asks for a
--    code again no longer stays in an anonymized row: it is gone at most about two days after its
--    last code was sent (older than 24 hours, then the next nightly run). An existing job of the
--    same name is removed first, so replaying the migrations on a fresh database works. The
--    security session's send functions (reserve_ and complete_phone_verification_send) are not
--    changed: their own 24-hour cleanup still runs whenever a number asks for a code.
-- 3. admin_approve_delegate(), admin_reject_delegate() and admin_update_delegate_name() are
--    restated exactly as their latest definitions (20260722120000, 20260717150000,
--    20261008160200), plus `if not found then raise exception 'invalid_target'` right after their
--    UPDATE of the delegate or profile row, before the audit insert. erase_account() locks those
--    rows first: an admin action that reaches its UPDATE while an erasure holds the row waits,
--    finds the row gone, and refuses, so it can no longer commit an audit row with the name of a
--    person erased meanwhile. An admin action that gets the row first finishes first, and the
--    erasure's scrub then sees its audit row. Their grants are asserted again unchanged.
--    Not covered: admin_reveal_personal_id() and admin_reveal_applicant_personal_id() read the
--    profile without a lock and write no row but their audit row, so one running at the same
--    moment as an erasure can still leave the person's name in that row.

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
  -- the person's rows first; a concurrent erasure that got here first leaves nothing to lock
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'invalid_target';
  end if;
  -- (1a) their own open membership: a concurrent delegate change or reassignment waits
  perform 1 from public.memberships where member_id = p_user_id and ended_at is null for update;
  perform 1 from public.delegates where id = p_user_id for update;
  if exists (select 1 from public.admin_roles where user_id = p_user_id) then
    raise exception 'staff_account';
  end if;

  select photo_url into v_photo_url from public.delegates where id = p_user_id;

  -- votes in polls still running go; closed and past-deadline polls keep theirs anonymously.
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

  -- the delegate's team moves to the central movement, marked for the cabinet note.
  -- (1b) the team is exactly the rows this UPDATE ends: a member who moved away meanwhile is not
  -- given a second open membership
  with ended as (
    update public.memberships set ended_at = now()
     where delegate_id = p_user_id and ended_at is null
    returning member_id
  )
  select coalesce(array_agg(member_id), '{}') into v_team from ended;
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

  -- Supabase auth's own log, best effort: lacking the privilege never blocks the erasure
  begin
    delete from auth.audit_log_entries where payload ->> 'actor_id' = p_user_id::text;
  exception
    when insufficient_privilege or undefined_table then
      raise notice 'erase_account: auth.audit_log_entries not scrubbed (%)', sqlerrm;
  end;

  -- (1c) SMS send reservations older than 24 hours feed no send limit (every window is 24 hours
  -- or shorter); the newer ones stay, anonymized by the foreign key, until the daily purge
  delete from public.phone_verification_send_reservations
   where user_id = p_user_id
     and created_at < now() - interval '24 hours';

  delete from auth.users where id = p_user_id;
  return jsonb_build_object('photoUrl', v_photo_url);
exception
  when foreign_key_violation then
    -- recorded payments, approvals, settings or audit rows as staff: keep the trail intact.
    -- The token stays what the app maps; the detail says which foreign key refused.
    get stacked diagnostics v_constraint = constraint_name, v_table = table_name;
    raise exception 'staff_history'
      using detail = format('blocked by foreign key %s on %s', v_constraint, v_table);
end $$;

-- Nobody runs the erasure directly; the two wrappers are the only way in.
revoke execute on function public.erase_account(uuid) from public, anon, authenticated, service_role;

-- 2. Daily purge of anonymized SMS send reservations -------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'purge-anonymous-sms-reservations';
select cron.schedule(
  'purge-anonymous-sms-reservations',
  '30 1 * * *',
  $purge$delete from public.phone_verification_send_reservations where user_id is null and created_at < now() - interval '24 hours'$purge$
);

-- 3. Admin actions refuse a person erased meanwhile ---------------------------------------------
create or replace function public.admin_approve_delegate(p_delegate_id uuid, p_slug text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status = 'approved' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;
  -- the delegates row exists from funnel step 2 — approving an applicant who
  -- abandoned before step 3 would publish a public page + live referral link
  -- for a profile with no tier and no reference code
  if v_profile.registration_completed_at is null then raise exception 'invalid_target'; end if;

  -- slug is permanent once set (URL stability); re-approval keeps the original
  v_slug := coalesce(v_delegate.slug, nullif(btrim(coalesce(p_slug, '')), ''));
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 80 then
    raise exception 'invalid_slug';
  end if;

  -- a concurrent duplicate slug surfaces as 23505; the server action retries
  update public.delegates set
    status = 'approved',
    slug = v_slug,
    verified_at = now(),
    verified_by = v_uid
  where id = p_delegate_id;
  if not found then raise exception 'invalid_target'; end if;

  -- R2 rider: a delegate stops being anyone's supporter the moment they hold
  -- the role themselves
  update public.memberships set ended_at = now()
  where member_id = p_delegate_id and ended_at is null;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.approve', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'slug', v_slug,
            'priorStatus', v_delegate.status::text));
  return jsonb_build_object('slug', v_slug);
end $$;
grant execute on function public.admin_approve_delegate(uuid, text) to authenticated;
revoke execute on function public.admin_approve_delegate(uuid, text) from public, anon;

create or replace function public.admin_reject_delegate(p_delegate_id uuid, p_note text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if v_note is not null and length(v_note) > 500 then raise exception 'invalid_note'; end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status <> 'pending' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.delegates set
    status = 'rejected',
    review_note = v_note,
    verified_at = now(),
    verified_by = v_uid
  where id = p_delegate_id;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.reject', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'note', v_note));
end $$;
grant execute on function public.admin_reject_delegate(uuid, text) to authenticated;
revoke execute on function public.admin_reject_delegate(uuid, text) from public, anon;

create or replace function public.admin_update_delegate_name(
  p_delegate_id uuid, p_first_name text, p_last_name text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_first text := btrim(coalesce(p_first_name, ''), E' \t\r\n');
  v_last text := btrim(coalesce(p_last_name, ''), E' \t\r\n');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if length(v_first) not between 1 and 60 or length(v_last) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if not exists (
    select 1 from public.delegates d where d.id = p_delegate_id and d.status = 'approved'
  ) then
    raise exception 'invalid_target';
  end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.profiles set first_name = v_first, last_name = v_last where id = p_delegate_id;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.update_name', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'from', v_profile.first_name || ' ' || v_profile.last_name,
            'to', v_first || ' ' || v_last));
end $$;
revoke execute on function public.admin_update_delegate_name(uuid, text, text) from public, anon;
grant execute on function public.admin_update_delegate_name(uuid, text, text) to authenticated;
