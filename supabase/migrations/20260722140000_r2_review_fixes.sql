-- Phase 6 R2 post-review fixes (whole-branch max-effort review on PR #10).
-- 20260722120000/-130000 stay frozen (applied migrations are never edited);
-- this is a new migration on top, per house policy. Four fixes:
--
-- 1) register(): the name guards/values used plain btrim(), which strips ONLY
--    spaces — the exact class 20260722130000 fixed for admin_save_event/news but
--    register() was missed, so a tab/newline-only name passed the 1–60 guard and
--    stored verbatim (blank name in admin tables, audit details, public pages).
--    Also: signup ref codes now normalize to upper() — every legitimately minted
--    code is uppercase (ADR-010 alphabet, roster seeds) while the junk filter
--    accepts lowercase input, so a hand-retyped lowercase link registered fine
--    but silently lost attribution in admin_members' join and delegate_panel's
--    registeredCount. upper() is lossless for every real code.
-- 2) request_delegacy(): the blanket unique_violation handler conflated a random
--    gen_funnel_code(6) collision on delegates_referral_code_key with the
--    double-click pkey race — a member with NO request was told one already
--    exists ("დელეგატობის მოთხოვნა უკვე დაფიქსირებულია") and the request was
--    silently lost. Dispatch on CONSTRAINT_NAME (register()'s idiom) and retry
--    the mint with a fresh code, as the retired funnel creation path did.
-- 3) member_change_delegate(): refused ANY delegates-row holder, stranding
--    pending/rejected requesters whose membership R2 deliberately keeps open
--    (spec §3.1 — "member life untouched while waiting"). Only an APPROVED
--    delegate holds no membership.
-- 4) profiles: CHECK tying status='active_member' to a non-null
--    registration_completed_at. The standing ladder is derived on two bases
--    (status vs timestamp) across several views; they can only diverge via a
--    partial write — this makes that divergent state unrepresentable. Every
--    engine path already sets both atomically (become_member_complete), and the
--    reseeded staging data satisfies it.

-- 1) register(): whitespace-aware trims + uppercased ref code. Body otherwise
--    identical to 20260722120000 §3. ACLs survive create-or-replace; grants
--    restated verbatim per house shape.
create or replace function register(
  p_first_name text,
  p_last_name text,
  p_personal_id text,
  p_ref_code text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_ref text := nullif(btrim(coalesce(p_ref_code, ''), E' \t\r\n'), '');
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;
  if p_first_name is null or length(btrim(p_first_name, E' \t\r\n')) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name, E' \t\r\n')) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
  -- every minted code is uppercase (gen_funnel_code alphabet, roster seeds);
  -- lowercase arrivals are hand-retyped links — normalize losslessly so the
  -- case-sensitive attribution joins (admin_members, delegate_panel) match
  v_ref := upper(v_ref);
  if exists (select 1 from public.profiles pr where pr.personal_id = p_personal_id) then
    raise exception 'duplicate_personal_id';
  end if;

  select case
           when u.phone is null then null
           when left(u.phone, 1) = '+' then u.phone
           else '+' || u.phone
         end
    into v_phone
    from auth.users u where u.id = v_uid;

  begin
    insert into public.profiles (id, first_name, last_name, phone, personal_id, status, signup_ref_code)
    values (
      v_uid, btrim(p_first_name, E' \t\r\n'), btrim(p_last_name, E' \t\r\n'),
      v_phone, p_personal_id, 'registered', v_ref
    );
  exception when unique_violation then
    get stacked diagnostics v_constraint = CONSTRAINT_NAME;
    if v_constraint = 'profiles_personal_id_key' then
      raise exception 'duplicate_personal_id';
    elsif v_constraint = 'profiles_pkey' then
      return public.cabinet_state() || jsonb_build_object('created', false);
    else
      raise;
    end if;
  end;

  return public.cabinet_state() || jsonb_build_object('created', true);
end $$;

grant execute on function register(text, text, text, text) to authenticated;
revoke execute on function register(text, text, text, text) from public, anon;

-- 2) request_delegacy(): constraint-name dispatch + fresh-code retry. The mint
--    can collide two ways: delegates_pkey (double-click race — the request DOES
--    exist → 'delegacy_exists' is true) or delegates_referral_code_key (random
--    collision with another delegate's code — the request does NOT exist; the
--    pre-check just proved that). Body otherwise identical to 20260722120000 §2.
create or replace function request_delegacy() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_uid and registration_completed_at is not null
  ) then
    raise exception 'not_a_member';
  end if;
  if exists (select 1 from public.delegates where id = v_uid) then
    raise exception 'delegacy_exists';
  end if;
  for i in 1..5 loop
    begin
      insert into public.delegates (id, referral_code, tc_accepted_at)
      values (v_uid, public.gen_funnel_code(6), now());
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = CONSTRAINT_NAME;
      if v_constraint = 'delegates_pkey' then
        raise exception 'delegacy_exists';
      elsif v_constraint = 'delegates_referral_code_key' and i < 5 then
        null; -- referral-code collision: retry with a fresh code (retired funnel idiom)
      else
        raise;
      end if;
    end;
  end loop;
  return public.cabinet_state();
end $$;

grant execute on function request_delegacy() to authenticated;
revoke execute on function request_delegacy() from public, anon;

-- 3) member_change_delegate(): the delegates-row guard narrows to APPROVED only.
--    Pending/rejected requesters are members with an open membership (R2 §3.1)
--    and may keep viewing/changing the delegate that membership backs. Body
--    otherwise identical to 20260721120000.
create or replace function member_change_delegate(p_delegate_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'not_completed'; end if;
  if v_profile.registration_completed_at is null
     and v_profile.status <> 'active_member' then
    raise exception 'not_completed';
  end if;
  if exists (
    select 1 from public.delegates d where d.id = v_uid and d.status = 'approved'
  ) then
    raise exception 'not_a_member'; -- APPROVED delegates hold no membership (spec §3.1)
  end if;

  v_target := null;
  if p_delegate_id is not null then
    select d.id into v_target from public.delegates d
      where d.id = p_delegate_id and d.status = 'approved';
    if v_target is null then raise exception 'invalid_delegate'; end if;
  end if;

  select m.delegate_id, true into v_open_delegate, v_has_open
    from public.memberships m
    where m.member_id = v_uid and m.ended_at is null;

  if not coalesce(v_has_open, false) then
    insert into public.memberships (member_id, delegate_id) values (v_uid, v_target);
  elsif v_open_delegate is distinct from v_target then
    -- close-then-open, same pattern as funnel_save_profile: history never deleted
    update public.memberships set ended_at = now()
      where member_id = v_uid and ended_at is null;
    insert into public.memberships (member_id, delegate_id) values (v_uid, v_target);
  end if; -- same target: no-op, no history row minted (spec §4.2)

  return public.cabinet_state();
end $$;

grant execute on function member_change_delegate(uuid) to authenticated;
revoke execute on function member_change_delegate(uuid) from public, anon;

-- 4) the two standing bases can no longer diverge: an active_member without the
--    completion stamp becomes unrepresentable (partial-write class only — every
--    RPC path sets both atomically).
alter table profiles add constraint profiles_active_member_completed
  check (status <> 'active_member' or registration_completed_at is not null);
