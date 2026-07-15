-- Phase 2: registration funnel. Spec: docs/superpowers/specs/2026-07-15-phase-2-registration-funnel-design.md
create extension if not exists pgcrypto with schema extensions;

-- 1) New profile columns ------------------------------------------------------
alter table profiles add column signup_role text not null default 'member'
  check (signup_role in ('member', 'delegate'));
alter table profiles add column signup_ref_code text;
alter table profiles add column membership_tier smallint
  check (membership_tier in (5, 10, 20));
alter table profiles add column reference_code text unique
  check (reference_code ~ '^GR-[A-HJKMNP-Z2-9]{6}$');
alter table profiles add column registration_completed_at timestamptz;

-- Backfill: profiles that already have a delegates row are delegates
update profiles p set signup_role = 'delegate'
  where exists (select 1 from delegates d where d.id = p.id);

-- 2) Protect the new server-managed columns -----------------------------------
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.signup_role is distinct from old.signup_role
      or new.signup_ref_code is distinct from old.signup_ref_code
      or new.membership_tier is distinct from old.membership_tier
      or new.reference_code is distinct from old.reference_code
      or new.registration_completed_at is distinct from old.registration_completed_at)
  then
    raise exception 'server-managed profile columns cannot be changed by client roles';
  end if;
  return new;
end $$;

-- 3) No direct client writes to profiles at all in Phase 2 --------------------
-- All funnel writes go through the definer RPCs below. The "own profile
-- updatable" RLS policy stays for Phase 3's scoped cabinet editing; without
-- this grant it is unreachable. (Spec §4.1.)
revoke update on profiles from authenticated;

-- 4) Code generator ------------------------------------------------------------
-- 31-char Crockford-style alphabet (no I, L, O, 0, 1). Modulo bias over 31 of
-- 256 byte values is negligible for anti-typo membership codes.
create function gen_funnel_code(len int) returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
  i int;
begin
  for i in 0..len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return result;
end $$;
revoke execute on function gen_funnel_code(int) from public, anon, authenticated;

-- 5) funnel_state --------------------------------------------------------------
create function funnel_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate public.delegates%rowtype;
  v_has_delegate boolean := false;
  v_role text;
  v_referral jsonb;
  v_chosen jsonb;
  v_membership_exists boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then return jsonb_build_object('exists', false); end if;

  select * into v_delegate from public.delegates where id = v_uid;
  v_has_delegate := found;
  v_role := case when v_has_delegate then 'delegate' else v_profile.signup_role end;

  if v_role = 'member' and v_profile.signup_ref_code is not null then
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
    'role', v_role,
    'firstName', v_profile.first_name,
    'lastName', v_profile.last_name,
    'personalIdSet', v_profile.personal_id is not null,
    'birthDate', v_profile.birth_date,
    'regionId', v_profile.region_id,
    'cityId', v_profile.city_id,
    'employment', v_profile.employment,
    'tier', v_profile.membership_tier,
    'referenceCode', v_profile.reference_code,
    'completed', v_profile.registration_completed_at is not null
                 or v_profile.status = 'active_member',
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false)
  );
end $$;

-- 6) funnel_start ---------------------------------------------------------------
create function funnel_start(
  p_first_name text,
  p_last_name text,
  p_role text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_status public.member_status;
  v_completed timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_role is null or p_role not in ('member', 'delegate') then
    raise exception 'invalid_role';
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;

  select status, registration_completed_at into v_status, v_completed
    from public.profiles where id = v_uid;

  if not found then
    -- canonical phone format is E.164 with '+'; Supabase auth stores it without
    select case
             when u.phone is null then null
             when left(u.phone, 1) = '+' then u.phone
             else '+' || u.phone
           end
      into v_phone
      from auth.users u where u.id = v_uid;
    insert into public.profiles
      (id, first_name, last_name, phone, status, signup_role, signup_ref_code)
    values (
      v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, 'draft', p_role,
      case when p_role = 'member' then nullif(btrim(coalesce(p_ref_code, '')), '') end
    );
  elsif v_completed is null and v_status <> 'active_member' then
    update public.profiles set
      first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      -- path + referral only change while nothing role-specific exists yet (spec §4.3)
      signup_role = case when status = 'draft' then p_role else signup_role end,
      signup_ref_code = case
        when status <> 'draft' then signup_ref_code
        when p_role = 'delegate' then null
        else coalesce(nullif(btrim(coalesce(p_ref_code, '')), ''), signup_ref_code)
      end
    where id = v_uid;
  end if;
  -- completed profiles: no-op; state below routes them onward

  return public.funnel_state();
end $$;

-- 7) funnel_save_profile ---------------------------------------------------------
create function funnel_save_profile(
  p_personal_id text,
  p_birth_date date,
  p_region_id int,
  p_city_id int,
  p_employment text,
  p_delegate_id uuid default null,
  p_tc_accepted boolean default false
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_role text;
  v_delegate uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
  i int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null
     or v_profile.status = 'active_member' then
    raise exception 'already_completed';
  end if;

  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  if p_birth_date is null or p_birth_date >= current_date
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
  if exists (
    select 1 from public.profiles pr
    where pr.personal_id = p_personal_id and pr.id <> v_uid
  ) then
    raise exception 'duplicate_personal_id';
  end if;

  v_role := case when exists (select 1 from public.delegates d where d.id = v_uid)
                 then 'delegate' else v_profile.signup_role end;

  if v_role = 'delegate' then
    if not coalesce(p_tc_accepted, false) then raise exception 'terms_required'; end if;
    -- create once; resubmits keep the original referral_code and tc_accepted_at
    for i in 1..5 loop
      begin
        insert into public.delegates (id, referral_code, tc_accepted_at)
        values (v_uid, public.gen_funnel_code(6), now())
        on conflict (id) do nothing;
        exit;
      exception when unique_violation then
        if i = 5 then raise; end if; -- referral_code collision: retry with a new code
      end;
    end loop;
  else
    -- member binding: stored approved referral wins over the picker (spec §3.3)
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

    select m.delegate_id, true into v_open_delegate, v_has_open
      from public.memberships m
      where m.member_id = v_uid and m.ended_at is null;
    if not coalesce(v_has_open, false) then
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    elsif v_open_delegate is distinct from v_delegate then
      update public.memberships set ended_at = now()
        where member_id = v_uid and ended_at is null;
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    end if;
  end if;

  update public.profiles set
    personal_id = p_personal_id,
    birth_date = p_birth_date,
    region_id = p_region_id,
    city_id = p_city_id,
    employment = btrim(p_employment),
    status = case when status = 'draft' then 'profile_completed' else status end
  where id = v_uid;

  return public.funnel_state();
end $$;

-- 8) funnel_complete --------------------------------------------------------------
create function funnel_complete(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_is_delegate boolean;
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;

  -- idempotent: repeat calls (any tier) return existing state untouched (spec §4.3)
  if v_profile.registration_completed_at is not null then
    return public.funnel_state();
  end if;
  if v_profile.status <> 'profile_completed' then raise exception 'profile_incomplete'; end if;
  if p_tier is null or p_tier not in (5, 10, 20) then raise exception 'invalid_tier'; end if;

  v_is_delegate := exists (select 1 from public.delegates d where d.id = v_uid);
  if not v_is_delegate and not exists (
    select 1 from public.memberships m where m.member_id = v_uid and m.ended_at is null
  ) then
    raise exception 'profile_incomplete';
  end if;

  loop
    v_code := 'GR-' || public.gen_funnel_code(6);
    begin
      update public.profiles set
        membership_tier = p_tier,
        reference_code = v_code,
        registration_completed_at = now()
      where id = v_uid;
      exit;
    exception when unique_violation then
      -- reference_code collision — regenerate and retry
    end;
  end loop;

  return public.funnel_state();
end $$;

-- 9) Grants -------------------------------------------------------------------------
grant execute on function funnel_state() to authenticated;
revoke execute on function funnel_state() from public, anon;
grant execute on function funnel_start(text, text, text, text) to authenticated;
revoke execute on function funnel_start(text, text, text, text) from public, anon;
grant execute on function funnel_save_profile(text, date, int, int, text, uuid, boolean) to authenticated;
revoke execute on function funnel_save_profile(text, date, int, int, text, uuid, boolean) from public, anon;
grant execute on function funnel_complete(int) to authenticated;
revoke execute on function funnel_complete(int) from public, anon;
