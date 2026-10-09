-- Account deletion, the rest of the race class (ADR-049; spec
-- docs/superpowers/specs/2026-10-08-account-deletion-design.md). Fix round 1 of the review of
-- 20261009160000, which is already on staging: its statements stay as they are and every change
-- lands here. Same database release (PR #49). Additive for the code on main: the four admin RPCs
-- keep their signatures, results and grants, and only refuse one more case with a token they
-- already raise ('invalid_target').
--
-- An admin RPC that reads a person's name and then writes it into an audit row must not commit
-- that row after an erasure of the same person has scrubbed the log. erase_account() locks the
-- person's profile row FOR UPDATE first (then their open membership and their delegate row), so:
-- 1. admin_update_delegate_profile() gets the FOUND check the three others got in 160000: its
--    UPDATE of the delegate row waits for an erasure holding that row, finds it gone, and raises
--    'invalid_target' before the audit insert.
-- 2. admin_reveal_personal_id(), admin_reveal_applicant_personal_id() and admin_void_payment()
--    read the profile FOR SHARE, which waits behind the erasure's FOR UPDATE and then finds no
--    row ('invalid_target'). One that takes the share lock first makes the erasure wait until it
--    commits, so the scrub sees its audit row. admin_void_payment() is not in the review's list:
--    reading every audit insert again for this round showed its payment UPDATE can wait on the
--    erasure's cascade, change nothing and still log the member's name.
-- The other functions that put a name into an audit row were already safe and are unchanged:
-- admin_grant_role(), admin_reassign_member(), admin_record_payment() and
-- admin_record_payments_bulk() insert a row referencing the person, whose key-share lock on the
-- profile conflicts with the erasure's FOR UPDATE (they wait and fail on the foreign key, or
-- finish first and get scrubbed); admin_revoke_role() targets a role holder, and the erasure
-- refuses anyone whose role row still exists. lib/account-deletion-migration.test.ts keeps this
-- list complete.
-- 3. The purge of anonymized SMS send reservations runs hourly (minute 17) instead of daily, so
--    an erased person's phone number in an anonymized reservation is gone within about 25 hours
--    of the code being sent (older than 24 hours, then the next run). Same job name and command;
--    the daily job from 160000 is unscheduled first, which also keeps a fresh replay working.
--
-- Each function below is its latest definition copied exactly (20260717150000_admin_crm.sql for
-- all four), plus only the lines named above; the grants are asserted again unchanged.

-- 1. A FOUND check after the UPDATE ---------------------------------------------------------------
create or replace function public.admin_update_delegate_profile(
  p_delegate_id uuid, p_bio text, p_photo_url text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_photo text := nullif(btrim(coalesce(p_photo_url, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if v_bio is not null and length(v_bio) > 1000 then raise exception 'invalid_target'; end if;
  if v_photo is not null and (v_photo !~ '^https://' or length(v_photo) > 512) then
    raise exception 'invalid_target';
  end if;
  select * into v_delegate from public.delegates where id = p_delegate_id;
  if not found or v_delegate.status <> 'approved' then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_delegate_id;

  update public.delegates set bio = v_bio, photo_url = v_photo where id = p_delegate_id;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.update_profile', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'bioChanged', v_bio is distinct from v_delegate.bio,
            'photoChanged', v_photo is distinct from v_delegate.photo_url));
end $$;
grant execute on function public.admin_update_delegate_profile(uuid, text, text) to authenticated;
revoke execute on function public.admin_update_delegate_profile(uuid, text, text) from public, anon;

-- 2. The profile read waits for an in-flight erasure -----------------------------------------------
create or replace function public.admin_reveal_personal_id(p_member_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  select * into v_profile from public.profiles where id = p_member_id for share;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.reveal_personal_id', 'profile', p_member_id::text,
          jsonb_build_object('memberName', v_profile.first_name || ' ' || v_profile.last_name));
  return v_profile.personal_id;
end $$;
grant execute on function public.admin_reveal_personal_id(uuid) to authenticated;
revoke execute on function public.admin_reveal_personal_id(uuid) from public, anon;

create or replace function public.admin_reveal_applicant_personal_id(p_delegate_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  if not exists (select 1 from public.delegates d where d.id = p_delegate_id) then
    raise exception 'invalid_target'; -- verifier's reveal scope is applicants only
  end if;
  select * into v_profile from public.profiles where id = p_delegate_id for share;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.reveal_personal_id', 'delegate', p_delegate_id::text,
          jsonb_build_object('memberName', v_profile.first_name || ' ' || v_profile.last_name));
  return v_profile.personal_id;
end $$;
grant execute on function public.admin_reveal_applicant_personal_id(uuid) to authenticated;
revoke execute on function public.admin_reveal_applicant_personal_id(uuid) from public, anon;

create or replace function public.admin_void_payment(p_payment_id bigint, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_profile public.profiles%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_new_status public.member_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then raise exception 'invalid_reason'; end if;
  select * into v_payment from public.payments where id = p_payment_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_payment.voided_at is not null then raise exception 'already_voided'; end if;
  select * into v_profile from public.profiles where id = v_payment.member_id for share;
  if not found then raise exception 'invalid_target'; end if;

  update public.payments
    set voided_at = now(), voided_by = v_uid, void_reason = v_reason
    where id = p_payment_id;

  perform public.recompute_member_active(v_payment.member_id);
  select status into v_new_status from public.profiles where id = v_payment.member_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'payment.void', 'payment', p_payment_id::text,
          jsonb_build_object(
            'memberId', v_payment.member_id,
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'amountGel', v_payment.amount_gel,
            'reason', v_reason,
            'newStatus', v_new_status::text));
  return jsonb_build_object('newStatus', v_new_status::text);
end $$;
grant execute on function public.admin_void_payment(bigint, text) to authenticated;
revoke execute on function public.admin_void_payment(bigint, text) from public, anon;

-- 3. The purge of anonymized SMS send reservations, hourly ----------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'purge-anonymous-sms-reservations';
select cron.schedule(
  'purge-anonymous-sms-reservations',
  '17 * * * *',
  $purge$delete from public.phone_verification_send_reservations where user_id is null and created_at < now() - interval '24 hours'$purge$
);
