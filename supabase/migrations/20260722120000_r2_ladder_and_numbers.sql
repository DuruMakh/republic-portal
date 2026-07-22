-- Phase 6 R2: the ladder and the numbers.
-- Spec: docs/superpowers/specs/2026-07-22-progressive-registration-r2-design.md §3, §4, §5, §8, §10.

-- 1) Integrity (spec §3.2): a delegates row requires a COMPLETED member profile.
--    request_delegacy() satisfies this by construction; the trigger seals every
--    other path (service-role scripts, seed). Staging complies: all 15 seeded
--    delegates sit on active members. Not a definer function — it runs as the
--    inserting role, and only ever reads profiles (schema-qualified).
create function enforce_delegate_completed() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.id and p.registration_completed_at is not null
  ) then
    raise exception 'delegate_requires_completed_member';
  end if;
  return new;
end $$;

create trigger delegates_require_completed
  before insert or update of id on delegates
  for each row execute function enforce_delegate_completed();

-- 2) The member-only delegacy request (spec §3.1). Inserts the same row the old
--    public funnel created — status defaults to 'pending', referral code minted
--    by the ADR-010 generator, T&C stamp now — but only ever on top of a
--    completed member. Any existing delegates row refuses: pending (already
--    asked), approved (already a delegate), rejected (final — re-approval is an
--    admin decision, spec R2-6/D7). The unique_violation handler covers the
--    double-click race: the second insert loses the pkey race and maps to the
--    same token the pre-check emits.
create function request_delegacy() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
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
  begin
    insert into public.delegates (id, referral_code, tc_accepted_at)
    values (v_uid, public.gen_funnel_code(6), now());
  exception when unique_violation then
    raise exception 'delegacy_exists';
  end;
  return public.cabinet_state();
end $$;
grant execute on function request_delegacy() to authenticated;
revoke execute on function request_delegacy() from public, anon;

-- 3) register(): the duplicate-personal-ID pre-check has a check-then-insert
--    race (two same-ID submissions in the same instant). Catch the constraint
--    instead of leaking a raw 23505: personal_id collision → the same
--    'duplicate_personal_id' token the pre-check raises (field-specific Georgian
--    error + in-place retry, spec §7b); pkey collision (the SAME user double
--    submitting) → the row now exists, behave as the existing no-op path.
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
  v_ref text := nullif(btrim(coalesce(p_ref_code, '')), '');
  v_constraint text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    -- duplicate phone after OTP: a state read, never an overwrite (spec §8)
    return public.cabinet_state() || jsonb_build_object('created', false);
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 60
     or p_last_name is null or length(btrim(p_last_name)) not between 1 and 60 then
    raise exception 'invalid_name';
  end if;
  if p_personal_id is null or p_personal_id !~ '^\d{11}$' then
    raise exception 'invalid_personal_id';
  end if;
  -- Phase 3 rider parity (20260715213000 §4.6): junk ref codes are silently dropped
  if v_ref is not null and v_ref !~ '^[A-Za-z0-9-]{1,32}$' then
    v_ref := null;
  end if;
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
      v_uid, btrim(p_first_name), btrim(p_last_name), v_phone, p_personal_id, 'registered', v_ref
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

-- 4) Approval closes the new delegate's own supporter membership (spec §3.1
--    rider): delegates back no one (Phase 3 canon). The membership stays open
--    through the pending wait, so rejection leaves member life untouched. Body
--    otherwise identical to 20260718100000 (ADR-016 completeness guard kept as
--    depth under the new trigger). ACLs survive create-or-replace.
create or replace function admin_approve_delegate(p_delegate_id uuid, p_slug text) returns jsonb
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

-- 5) The stored wizard choice must never dangle or block deletion (spec §3.2):
--    R1 created the FK with default NO ACTION.
alter table profiles drop constraint profiles_pending_delegate_id_fkey;
alter table profiles add constraint profiles_pending_delegate_id_fkey
  foreign key (pending_delegate_id) references delegates(id) on delete set null;

-- 6) Public counters (spec §4, D5/R2-5): registered_total = ALL profiles,
--    cumulative — every member is also a registered person. Column APPENDED so
--    create-or-replace is legal; grants (anon, authenticated) survive.
create or replace view public_stats as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles) as registered_total;

-- 7) Admin views (spec §5). Columns appended; self-gating WHERE unchanged.
--    total_completed / region predicates rewritten from the OID-renamed
--    status <> 'draft' to the explicit R1 meaning (same values, honest text).
create or replace view admin_overview as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int
     from delegates d join profiles p on p.id = d.id
     where d.status = 'pending'
       and p.registration_completed_at is not null) as pending_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles
     where registration_completed_at is not null) as total_completed,
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel,
  (select count(*)::int from profiles) as registered_total
where has_any_admin_role('super_admin', 'verifier', 'finance');

create or replace view admin_region_stats as
select r.id as region_id, r.name_ka, count(p.id)::int as member_count
from regions r
join profiles p on p.region_id = r.id and p.registration_completed_at is not null
where has_any_admin_role('super_admin', 'verifier', 'finance')
group by r.id, r.name_ka;

-- standing buckets are DISJOINT and sum to the total (spec §5): the three
-- member_status values already partition profiles 1:1 — the view names them.
-- signup_delegate_* resolves the referral source for registered rows (who
-- brought them in) regardless of that delegate's current status.
create or replace view admin_members as
select
  p.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.region_id,
  r.name_ka as region_name_ka,
  c.name_ka as city_name_ka,
  m.delegate_id,
  dp.first_name as delegate_first_name,
  dp.last_name as delegate_last_name,
  p.status,
  p.membership_tier,
  p.reference_code,
  p.created_at,
  p.registration_completed_at,
  (d.id is not null) as is_delegate,
  case
    when p.status = 'active_member' then 'active'
    when p.registration_completed_at is not null then 'member'
    else 'registered'
  end as standing,
  sdp.first_name as signup_delegate_first_name,
  sdp.last_name as signup_delegate_last_name
from profiles p
left join regions r on r.id = p.region_id
left join cities c on c.id = p.city_id
left join delegates d on d.id = p.id
left join memberships m on m.member_id = p.id and m.ended_at is null
left join profiles dp on dp.id = m.delegate_id
left join delegates sd on sd.referral_code = p.signup_ref_code
left join profiles sdp on sdp.id = sd.id
where has_any_admin_role('super_admin', 'verifier', 'finance');

-- admin_export_members: NO change — its p_status filter already speaks the
-- three-bucket vocabulary ('registered'|'profile_completed'|'active_member').

-- 8) delegate_panel: the jsonb key finally says what it counts (spec §7d). The
--    UI label already reads „რეგისტრირებული“ (R1); this closes the naming debt.
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
    'registeredCount', (select count(*)
                          from public.profiles p
                          where p.signup_ref_code = v_delegate.referral_code
                            and p.status = 'registered')
  );
end $$;

-- 9) Phase 5 riders, SQL half (spec §8.1-5).

-- 9a) admin_save_event: conditional DML behind the existing cancelled pre-check
--     (the pre-check alone was check-then-act vs a concurrent cancel) + btrim
--     guard on the description. Body otherwise identical to 20260719150000.
create or replace function admin_save_event(
  p_id uuid, p_title text, p_description text, p_location text,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := coalesce(p_description, '');
  v_location text := btrim(coalesce(p_location, ''));
  v_row public.events%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_description) > 20000
     or char_length(btrim(v_description)) < 1 then
    raise exception 'invalid_body';
  end if;
  if char_length(v_location) not between 1 and 200 then raise exception 'invalid_location'; end if;
  if p_starts_at is null or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_event_dates';
  end if;

  if p_id is null then
    insert into public.events (title, description, location, starts_at, ends_at, created_by)
    values (v_title, v_description, v_location, p_starts_at, p_ends_at, v_uid)
    returning * into v_row;
    v_action := 'event.save';
  else
    select * into v_row from public.events where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    -- cancelled events are frozen history (only draft/published are editable)
    if v_row.status = 'cancelled' then raise exception 'invalid_status'; end if;
    v_action := case when v_row.status = 'published' then 'event.update' else 'event.save' end;
    update public.events
    set title = v_title, description = v_description, location = v_location,
        starts_at = p_starts_at, ends_at = p_ends_at
    where id = p_id and status <> 'cancelled'
    returning * into v_row;
    -- conditional DML: a cancel that lands between the check and this UPDATE
    -- now yields zero rows instead of silently editing frozen history
    if not found then raise exception 'invalid_status'; end if;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'event', v_row.id::text,
          jsonb_build_object('title', v_title, 'startsAt', p_starts_at,
                             'status', v_row.status));
  return v_row.id;
end $$;

-- 9b) admin_save_news: honest visibility token + btrim guard on the body.
--     Body otherwise identical to 20260719150000.
create or replace function admin_save_news(p_id uuid, p_title text, p_body text, p_visibility text)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := coalesce(p_body, '');
  v_row public.news%rowtype;
  v_action text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  if char_length(v_title) not between 1 and 160 then raise exception 'invalid_title'; end if;
  if char_length(v_body) > 20000 or char_length(btrim(v_body)) < 1 then
    raise exception 'invalid_body';
  end if;
  if p_visibility not in ('public', 'members') then raise exception 'invalid_visibility'; end if;

  if p_id is null then
    insert into public.news (title, body, visibility, created_by)
    values (v_title, v_body, p_visibility, v_uid)
    returning * into v_row;
    v_action := 'news.save';
  else
    select * into v_row from public.news where id = p_id;
    if not found then raise exception 'invalid_target'; end if;
    v_action := case when v_row.status = 'published' then 'news.update' else 'news.save' end;
    update public.news
    set title = v_title, body = v_body, visibility = p_visibility
    where id = p_id
    returning * into v_row;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, v_action, 'news', v_row.id::text,
          jsonb_build_object('title', v_title, 'visibility', p_visibility,
                             'status', v_row.status));
  return v_row.id;
end $$;

-- 9c) Whitespace-only bodies become unrepresentable at the table too (the RPCs
--     above are the front door; constraints are the backstop — seed writes
--     status directly, published_news_complete precedent). Existing staging
--     rows all carry real text; a violation here fails the push loudly, which
--     is the correct outcome.
alter table news drop constraint news_body_len;
alter table news add constraint news_body_len
  check (char_length(body) <= 20000 and char_length(btrim(body)) >= 1);
alter table events drop constraint events_description_len;
alter table events add constraint events_description_len
  check (char_length(description) <= 20000 and char_length(btrim(description)) >= 1);

-- 9d) Cover-image pin: the old LIKE accepted ANY host that carried the right
--     path. Pin to the supabase.co storage origin + the uploader's exact
--     filename shape (<news-uuid>-<epoch-ms>.<ext> from PHOTO_TYPES: jpg|png|webp).
--     Existing rows are untouched (validated on SET only).
create or replace function admin_set_news_image(p_id uuid, p_image_url text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.news%rowtype;
  v_url text := nullif(btrim(coalesce(p_image_url, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'editor') then
    raise exception 'missing_role';
  end if;
  select * into v_row from public.news where id = p_id;
  if not found then raise exception 'invalid_target'; end if;
  -- pinned to THIS platform's storage origin and the upload action's filename
  -- shape — the RPC pairs with the upload action, so foreign hosts and
  -- hand-crafted paths have no business here
  if v_url is null or char_length(v_url) > 600
     or v_url !~ '^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/news-images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9]{10,16}\.(jpg|png|webp)$' then
    raise exception 'invalid_image';
  end if;

  update public.news set image_url = v_url where id = p_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'news.set_image', 'news', p_id::text,
          jsonb_build_object('title', v_row.title));
end $$;

-- 9e) member_rsvp: the same FOR SHARE lock member_cast_vote has, on the event
--     row — serializes RSVP against admin_cancel_event's status flip (the
--     recorded cancel/RSVP race; inert today, parity is the fix). Body
--     otherwise identical to 20260721120000.
create or replace function member_rsvp(p_event_id uuid, p_going boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'not_completed'; end if;
  if p_going is null then raise exception 'invalid_status'; end if;
  -- FOR SHARE serializes this RSVP against admin_cancel_event's row update
  -- (check-then-insert race) without RSVPs blocking each other
  select * into v_event from public.events where id = p_event_id for share;
  if not found or v_event.status = 'draft' then raise exception 'invalid_target'; end if;
  if v_event.status = 'cancelled' or v_event.starts_at <= now() then
    raise exception 'rsvp_closed';
  end if;

  insert into public.event_rsvps (event_id, member_id, status)
  values (p_event_id, v_uid, case when p_going then 'going' else 'cancelled' end)
  on conflict (event_id, member_id)
  do update set status = excluded.status;
end $$;
