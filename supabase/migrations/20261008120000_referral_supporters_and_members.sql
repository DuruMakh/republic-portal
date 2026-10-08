-- Referral supporters and members counted apart (ADR-038, owner decision 2026-10-08).
--
-- The referral card showed one figure, every sign-up through the person's links. It now
-- shows two: supporters (signed up, membership form not finished) and members (finished
-- it). cabinet_state() and delegate_panel() each gain two keys, referralSupporters and
-- referralMembers, counted over the same sign-ups as referralCount (the person's own M-
-- code plus, once approved, the delegate code; 20260729120000), so sign-ups earned before
-- approval stay counted after it.
--
-- Additive only: every existing key is kept, referralCount and registeredCount included,
-- so the code running when this lands reads exactly what it read before. Bodies are
-- copied verbatim from 20260729120000_referral_count_sums_both_codes.sql, the live
-- definitions (no later migration redefines either function), with only the two keys
-- added to each. Signatures are unchanged, so create-or-replace keeps the grants;
-- cabinet_state() restates its grants as house style, delegate_panel() never has.

-- 1) cabinet_state()
create or replace function cabinet_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate public.delegates%rowtype;
  v_has_delegate boolean := false;
  v_standing text;
  v_referral jsonb;
  v_pending jsonb;
  v_chosen jsonb;
  v_membership_exists boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('exists', false); end if;

  select * into v_delegate from public.delegates where id = v_uid;
  v_has_delegate := found;
  v_standing := case
    when v_profile.registration_completed_at is not null
      or v_profile.status = 'active_member' then 'member'
    else 'registered'
  end;

  if not v_has_delegate and v_profile.signup_ref_code is not null then
    select jsonb_build_object(
        'firstName', pr.first_name,
        'lastName', pr.last_name,
        'regionNameKa', coalesce(r.name_ka, ''))
      into v_referral
      from public.delegates d
      join public.profiles pr on pr.id = d.id
      left join public.regions r on r.id = pr.region_id
      where d.referral_code = v_profile.signup_ref_code and d.status = 'approved';
  end if;

  if v_profile.pending_delegate_id is not null then
    select jsonb_build_object('id', d.id, 'firstName', pr.first_name, 'lastName', pr.last_name)
      into v_pending
      from public.delegates d
      join public.profiles pr on pr.id = d.id
      where d.id = v_profile.pending_delegate_id;
  end if;

  select true,
         case when m.delegate_id is null then null
              else jsonb_build_object(
                'id', m.delegate_id,
                'firstName', pr.first_name,
                'lastName', pr.last_name) end
    into v_membership_exists, v_chosen
    from public.memberships m
    left join public.profiles pr on pr.id = m.delegate_id
    where m.member_id = v_uid and m.ended_at is null;

  return jsonb_build_object(
    'exists', true,
    'standing', v_standing,
    'status', v_profile.status,
    'role', case when v_has_delegate then 'delegate' else 'member' end,
    'firstName', v_profile.first_name,
    'lastName', v_profile.last_name,
    'personalIdMasked', left(coalesce(v_profile.personal_id, ''), 3) || '********',
    'hasPersonalId', v_profile.personal_id is not null,
    'referralCode', coalesce(
      (select d.referral_code from public.delegates d
        where d.id = v_uid and d.status = 'approved'),
      v_profile.referral_code),
    -- OWNER DECISION (2026-07-29, see header): sum sign-ups matching EITHER
    -- the profile's own referral_code OR the approved-delegate code, instead
    -- of coalescing to a single code the way referralCode above still does.
    -- NULL handling (deliberate): the delegate subselect is NULL for anyone
    -- who is not an approved delegate, and `signup_ref_code = NULL` is NULL
    -- (never TRUE) — so the second OR arm silently contributes zero rows for
    -- non-delegates, leaving the count exactly p2.signup_ref_code =
    -- v_profile.referral_code, same as before this change for that
    -- population. No double-count risk either: a delegate referral_code and
    -- a profile referral_code can never be equal (delegate codes are a bare
    -- 6-char gen_funnel_code draw with no hyphen; profile codes always carry
    -- the 'M-' prefix per the check constraint in
    -- 20260728142000_member_referral_codes.sql), so no single p2 row can
    -- satisfy both arms of the OR at once.
    'referralCount', (select count(*) from public.profiles p2
                       where p2.signup_ref_code = v_profile.referral_code
                          or p2.signup_ref_code = (
                            select d.referral_code from public.delegates d
                              where d.id = v_uid and d.status = 'approved')),
    -- ADR-038: the same sign-ups as referralCount, split by status. Supporters
    -- have not finished the membership form; members have (profile_completed or
    -- active_member, the public_stats.members_total rule). The two always add up
    -- to referralCount, since every profile holds exactly one of the three
    -- statuses. Counted on every read, never stored: a person moves from one
    -- figure to the other when their status changes.
    'referralSupporters', (select count(*) from public.profiles p2
                            where (p2.signup_ref_code = v_profile.referral_code
                                or p2.signup_ref_code = (
                                  select d.referral_code from public.delegates d
                                    where d.id = v_uid and d.status = 'approved'))
                              and p2.status = 'registered'),
    'referralMembers', (select count(*) from public.profiles p2
                         where (p2.signup_ref_code = v_profile.referral_code
                             or p2.signup_ref_code = (
                               select d.referral_code from public.delegates d
                                 where d.id = v_uid and d.status = 'approved'))
                           and p2.status in ('profile_completed', 'active_member')),
    'birthDate', v_profile.birth_date,
    'regionId', v_profile.region_id,
    'cityId', v_profile.city_id,
    'employment', v_profile.employment,
    'tier', v_profile.membership_tier,
    'referenceCode', v_profile.reference_code,
    'completed', v_standing = 'member',
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'pendingDelegate', v_pending,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false),
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'admin', exists (select 1 from public.admin_roles ar where ar.user_id = v_uid)
  );
end $$;

grant execute on function cabinet_state() to authenticated;
revoke execute on function cabinet_state() from public, anon;

-- 2) delegate_panel()
create or replace function delegate_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_delegate from public.delegates where id = v_uid;
  if not found then raise exception 'not_a_delegate'; end if;
  -- delegates.id references profiles(id) on delete cascade
  -- (20260712212409_initial_schema.sql:34), so having just found a
  -- delegates row for v_uid guarantees a profiles row for the same id
  -- exists too — no separate "not found" branch needed for this select.
  select * into v_profile from public.profiles where id = v_uid;

  return jsonb_build_object(
    'status', v_delegate.status::text,
    -- inactive until approval: null for pending/rejected so it can't be shared early
    'referralCode', case when v_delegate.status = 'approved'
                         then v_delegate.referral_code end,
    'activeCount', (select count(*)
                      from public.memberships m
                      join public.profiles p on p.id = m.member_id
                      where m.delegate_id = v_uid and m.ended_at is null
                        and p.status = 'active_member'),
    'totalCount', (select count(*)
                     from public.memberships m
                     where m.delegate_id = v_uid and m.ended_at is null),
    'registeredCount', (select count(*)
                          from public.profiles p
                          where p.signup_ref_code = v_delegate.referral_code
                            and p.status = 'registered'),
    -- OWNER DECISION (2026-07-29, see header and the comment above this
    -- function): sum sign-ups matching EITHER the delegate code OR this
    -- delegate's own profile referral_code. v_delegate.referral_code is
    -- NOT NULL by schema (delegates.referral_code text not null unique,
    -- initial_schema.sql:36) and v_profile.referral_code is NOT NULL by
    -- 20260728142000_member_referral_codes.sql's own `set not null`, so
    -- unlike cabinet_state()'s analogous OR, neither side of this
    -- comparison can ever be NULL — but the two codes still can never
    -- collide (delegate codes are a bare 6-char gen_funnel_code draw with no
    -- hyphen; profile codes always carry the 'M-' prefix), so no single row
    -- can satisfy both arms and be double-counted.
    'referralCount', (select count(*)
                        from public.profiles p
                       where p.signup_ref_code = v_delegate.referral_code
                          or p.signup_ref_code = v_profile.referral_code),
    -- ADR-038: referralCount split by status, as in cabinet_state() above.
    'referralSupporters', (select count(*)
                             from public.profiles p
                            where (p.signup_ref_code = v_delegate.referral_code
                                or p.signup_ref_code = v_profile.referral_code)
                              and p.status = 'registered'),
    'referralMembers', (select count(*)
                          from public.profiles p
                         where (p.signup_ref_code = v_delegate.referral_code
                             or p.signup_ref_code = v_profile.referral_code)
                           and p.status in ('profile_completed', 'active_member'))
  );
end $$;
