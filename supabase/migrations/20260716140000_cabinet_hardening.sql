-- Phase 3 hardening (whole-branch review follow-ups). The Phase 3 migration
-- (20260715213000_cabinets.sql) is already applied to staging, so these fixes
-- land as a new, additive migration.

-- 1) Validate the scoped-grant columns in-DB (review #1) -----------------------
-- The Phase 3 column-scoped UPDATE grant lets an authenticated client PATCH
-- first_name/last_name/employment straight through PostgREST, with no zod (that
-- runs only in the server action) and no CHECK on these columns — so an empty or
-- multi-hundred-KB value could land and then render on the PUBLIC public_delegates
-- view / delegate_team. A CHECK constraint can't be used (draft rows legitimately
-- carry the empty defaults), so mirror the funnel RPCs' value rules inside the
-- existing protect trigger, which only fires for client roles: the SECURITY DEFINER
-- funnel RPCs run as the owner and are unaffected.
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_role is distinct from old.signup_role
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at
    then
      raise exception 'server-managed profile columns cannot be changed by client roles';
    end if;
    -- Phase 3 scoped-grant columns: enforce the funnel RPCs' rules on direct writes
    -- (names 1–60 chars, employment 1–100, all trimmed & non-empty when changed).
    if new.first_name is distinct from old.first_name
       and length(btrim(coalesce(new.first_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.last_name is distinct from old.last_name
       and length(btrim(coalesce(new.last_name, ''))) not between 1 and 60 then
      raise exception 'invalid_name';
    end if;
    if new.employment is distinct from old.employment
       and length(btrim(coalesce(new.employment, ''))) not between 1 and 100 then
      raise exception 'invalid_employment';
    end if;
  end if;
  return new;
end $$;

-- 2) Withhold the referral code until approval (review #2) ---------------------
-- delegate_panel() previously returned the real referral_code to pending/rejected
-- delegates too; a pending delegate could read it from the browser console and
-- distribute /join?ref=<code>, but funnel_save_profile only binds to APPROVED
-- delegates — so every such sign-up silently bound to ცენტრალური მოძრაობა with no
-- retro-binding on later approval, exactly what the pending screen promises can't
-- happen. Gate the code on approval; the UI only reads it in the approved branch.
create or replace function delegate_panel() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_delegate public.delegates%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_delegate from public.delegates where id = v_uid;
  if not found then raise exception 'not_a_delegate'; end if;

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
    'draftCount', (select count(*)
                     from public.profiles p
                     where p.signup_ref_code = v_delegate.referral_code
                       and p.status = 'draft')
  );
end $$;

-- 3) Indexes for the new per-page-view query patterns (review #15) -------------
-- delegate_panel's draftCount scans profiles by signup_ref_code on every dashboard
-- and team view; the billing page reads payments by member_id ordered by paid_at.
-- Both were sequential scans of growing tables.
create index if not exists profiles_draft_by_ref_code
  on public.profiles (signup_ref_code) where status = 'draft';
create index if not exists payments_by_member_paid_at
  on public.payments (member_id, paid_at desc);
