-- Security audit 2026-10-08, H1: become_member_save_profile answered "duplicate" before it
-- checked the delegate, so a made-up delegate id rolled every probe back. One account could test
-- unlimited personal IDs, leaving no trace.
-- Now:
--   (a) every non-ID validation, delegate included, runs first;
--   (b) a conflict is RETURNED as {"error": "duplicate_personal_id"}, so its audit row commits
--       (lib's saveMembershipProfileAction maps the returned refusal);
--   (c) three conflicts stop the step for that account for good (decision D2: no daily reset,
--       because a reset lets a patient prober keep asking; a real person only conflicts when
--       their ID is already taken, which needs support anyway).
--   (d) a read-only call is refused before any lookup: PostgREST runs a GET RPC in a READ ONLY
--       transaction, where the audit insert and the profile update would fail with different
--       errors — an untraced answer to "is this ID taken?".
-- The audit row's actor_id stays NULL on purpose: audit_log.actor_id is a plain FK to profiles,
-- and a non-null actor would make the account undeletable. The tried ID is never stored.
-- Body restated from 20260728100000_personal_id_at_membership.sql; only the marked parts change.
create or replace function become_member_save_profile(
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null,
  p_personal_id text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
  v_constraint text;
  v_conflicts int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  -- H1 (d): writes are this function's whole point; a read-only call could only probe.
  if pg_catalog.current_setting('transaction_read_only') = 'on' then
    raise exception 'read_only_transaction';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null
     or v_profile.status = 'active_member' then
    raise exception 'already_completed';
  end if;

  if p_birth_date is null or p_birth_date >= public.tbilisi_today()
     or p_birth_date < date '1900-01-01' then
    raise exception 'invalid_birth_date';
  end if;
  if p_employment is null or length(btrim(p_employment)) not between 1 and 100 then
    raise exception 'invalid_employment';
  end if;
  if not exists (
    select 1 from public.cities c where c.id = p_city_id and c.region_id = p_region_id
  ) then
    raise exception 'invalid_city';
  end if;

  -- H1 (a): the delegate is resolved BEFORE the personal ID is looked at.
  v_delegate := null;
  if v_profile.signup_ref_code is not null then
    select d.id into v_delegate
      from public.delegates d
      where d.referral_code = v_profile.signup_ref_code and d.status = 'approved';
  end if;
  if v_delegate is null and p_delegate_id is not null then
    select d.id into v_delegate
      from public.delegates d
      where d.id = p_delegate_id and d.status = 'approved';
    if v_delegate is null then raise exception 'invalid_delegate'; end if;
  end if;

  -- Owner fix #10: the ID is captured here. Immutable once set — a provided value for a
  -- profile that already has one is IGNORED (idempotent resume), never overwritten.
  if v_profile.personal_id is null then
    if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
      raise exception 'invalid_personal_id';
    end if;
    -- H1 (c): three conflicts, ever, stop this step for the account (decision D2).
    select count(*) into v_conflicts
      from public.audit_log a
     where a.action = 'member.personal_id_conflict'
       and a.target_id = v_uid::text;
    if v_conflicts >= 3 then
      raise exception 'personal_id_attempts_exceeded';
    end if;
    -- H1 (b): a conflict is recorded and RETURNED, so the audit row commits.
    if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (null, 'member.personal_id_conflict', 'profile', v_uid::text, null);
      return jsonb_build_object('error', 'duplicate_personal_id');
    end if;
  end if;

  begin
    update public.profiles set
      birth_date = p_birth_date,
      region_id = p_region_id,
      city_id = p_city_id,
      employment = btrim(p_employment),
      -- review fix F3: coalesce against the COLUMN, not v_profile.personal_id — under a
      -- concurrent double-save the second writer must keep the first writer's value (full
      -- explanation in 20260728100000_personal_id_at_membership.sql).
      personal_id = coalesce(personal_id, p_personal_id),
      pending_delegate_id = v_delegate
    where id = v_uid;
  exception when unique_violation then
    -- two save-profile calls racing the same ID past the pre-check above — dispatch on
    -- CONSTRAINT_NAME rather than assuming (register()'s idiom, 20260722140000 §1)
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint = 'profiles_personal_id_key' then
      -- H1 (b), race branch: the subtransaction undid the UPDATE; record and return.
      insert into public.audit_log (actor_id, action, target_type, target_id, details)
      values (null, 'member.personal_id_conflict', 'profile', v_uid::text, null);
      return jsonb_build_object('error', 'duplicate_personal_id');
    else
      raise;
    end if;
  end;

  return public.cabinet_state();
end $$;

-- The cap's count runs on every save; keep it off a full audit_log scan.
create index audit_log_personal_id_conflicts
  on public.audit_log (target_id)
  where action = 'member.personal_id_conflict';

grant execute on function become_member_save_profile(date, int, int, text, uuid, text) to authenticated;
revoke execute on function become_member_save_profile(date, int, int, text, uuid, text) from public, anon;
