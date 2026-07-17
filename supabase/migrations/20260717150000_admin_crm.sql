-- Phase 4: Admin CRM. Spec: docs/superpowers/specs/2026-07-17-phase-4-admin-crm-design.md
-- Access model (ADR-014): self-gating definer views for admin reads (no personal-ID
-- columns anywhere); SECURITY DEFINER RPCs for every admin mutation — role re-check +
-- audit_log row in the same transaction. Engine semantics recorded as ADR-015.

-- 1) Role helpers ---------------------------------------------------------------
create function has_admin_role(p_role text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = p_role
  );
$$;
grant execute on function has_admin_role(text) to authenticated;
revoke execute on function has_admin_role(text) from public, anon;

create function has_any_admin_role(variadic p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role = any (p_roles)
  );
$$;
grant execute on function has_any_admin_role(text[]) to authenticated;
revoke execute on function has_any_admin_role(text[]) from public, anon;

-- 2) Settings (spec §3.9, §4.3) ---------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
alter table app_settings enable row level security;
-- sealed: no client grants, no policies — reads via admin_settings view, writes via RPC
insert into app_settings (key, value) values ('active_grace_days', '30'::jsonb);

-- 3) payments: engine + void + dedup columns (spec §4.3) ---------------------------
-- Table is empty today (recording starts this phase) — NOT NULL add is safe.
alter table payments add column tier_gel_at_payment smallint not null
  check (tier_gel_at_payment in (5, 10, 20));
-- Derived IN the database from immutable facts — no editable derivable column.
alter table payments add column months_covered int generated always as
  (greatest(1, floor(amount_gel / tier_gel_at_payment)::int)) stored;
alter table payments add column voided_at timestamptz;
alter table payments add column voided_by uuid references profiles(id);
alter table payments add column void_reason text;

-- Referenced (single-entry) payments cannot double-record — live references are
-- unique; voiding frees the reference. Bulk rows carry no reference: the bulk RPC
-- enforces its own live member+amount+date duplicate check per row (see §7).
create unique index payments_bank_ref_live on payments (bank_reference)
  where bank_reference is not null and voided_at is null;
-- No new (member_id, paid_at) index: payments_by_member_paid_at (Phase 3,
-- 20260716140000_cabinet_hardening.sql) already covers the engine's scan.

-- e2e/staging deletability (spec §4.3): no product deletion flow exists; cleanup
-- deletes e2e users, and their payments must go with them (audit keeps the trail —
-- targets are stored as text, never FKs).
alter table payments drop constraint payments_member_id_fkey;
alter table payments add constraint payments_member_id_fkey
  foreign key (member_id) references profiles(id) on delete cascade;

-- 4) delegates: internal rejection note (spec §3.4) --------------------------------
alter table delegates add column review_note text;

-- 5) The active-member engine (spec §4.4, ADR-015) ----------------------------------
-- Date-only math, mirrored by lib/active.ts:
--   coverage_end = greatest(prev_end, paid_at) + months_covered × 30 days
--   active ⇔ current_date ≤ coverage_end + grace
create function active_grace_days() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (value #>> '{}')::int from public.app_settings where key = 'active_grace_days'),
    30);
$$;
revoke execute on function active_grace_days() from public, anon, authenticated;

create function active_coverage(p_member uuid) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_end date := null;
  r record;
begin
  for r in
    select paid_at, months_covered from public.payments
    where member_id = p_member and voided_at is null
    order by paid_at, id
  loop
    v_end := greatest(coalesce(v_end, r.paid_at), r.paid_at) + (r.months_covered * 30);
  end loop;
  return v_end;
end $$;
revoke execute on function active_coverage(uuid) from public, anon, authenticated;

-- The engine owns profile_completed ⇄ active_member. It never touches drafts —
-- the funnel owns draft → profile_completed (spec §4.4).
create function recompute_member_active(p_member uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_status public.member_status;
  v_end date;
  v_new public.member_status;
begin
  select status into v_status from public.profiles where id = p_member;
  if not found or v_status = 'draft' then return; end if;
  v_end := public.active_coverage(p_member);
  v_new := case
    when v_end is not null and current_date <= v_end + public.active_grace_days()
      then 'active_member'::public.member_status
    else 'profile_completed'::public.member_status
  end;
  if v_new is distinct from v_status then
    update public.profiles set status = v_new where id = p_member;
  end if;
end $$;
revoke execute on function recompute_member_active(uuid) from public, anon, authenticated;

create function recompute_all_active() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.profiles p set status = sub.new_status
  from (
    select p2.id,
           case
             when c.v_end is not null
                  and current_date <= c.v_end + public.active_grace_days()
               then 'active_member'::public.member_status
             else 'profile_completed'::public.member_status
           end as new_status
    from public.profiles p2
    cross join lateral (select public.active_coverage(p2.id) as v_end) c
    where p2.status <> 'draft'
  ) sub
  where p.id = sub.id and p.status is distinct from sub.new_status;
end $$;
revoke execute on function recompute_all_active() from public, anon, authenticated;
-- the seed script (service role) runs the full recompute after inserting payments
grant execute on function recompute_all_active() to service_role;

create function active_sweep() returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_demoted int;
begin
  with lapsed as (
    select p.id
    from public.profiles p
    cross join lateral (select public.active_coverage(p.id) as v_end) c
    where p.status = 'active_member'
      and (c.v_end is null or current_date > c.v_end + public.active_grace_days())
  ), upd as (
    update public.profiles set status = 'profile_completed'
    where id in (select id from lapsed)
    returning 1
  )
  select count(*)::int into v_demoted from upd;
  if v_demoted > 0 then
    insert into public.audit_log (actor_id, action, target_type, details)
    values (null, 'system.active_sweep', 'system',
            jsonb_build_object('demoted', v_demoted));
  end if;
  return v_demoted;
end $$;
revoke execute on function active_sweep() from public, anon, authenticated;
grant execute on function active_sweep() to service_role; -- probes exercise it

-- Nightly sweep, 01:00 UTC = 05:00 Tbilisi. Named risk (spec §4.4): verified live
-- in the apply step; fallback = Vercel cron calling active_sweep() via service role.
create extension if not exists pg_cron;
select cron.schedule('active-member-sweep', '0 1 * * *', 'select public.active_sweep()');

-- 6) Admin read views (spec §4.2) ----------------------------------------------------
-- Definer-style like public_delegates: fixed safe column sets, self-gated on the
-- caller's role — non-admins get ZERO rows. personal_id/birth_date appear in NO view.

create view admin_overview as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from delegates where status = 'pending') as pending_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles where status <> 'draft') as total_completed,
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel
where has_any_admin_role('super_admin', 'verifier', 'finance');

create view admin_region_stats as
select r.id as region_id, r.name_ka, count(p.id)::int as member_count
from regions r
join profiles p on p.region_id = r.id and p.status <> 'draft'
where has_any_admin_role('super_admin', 'verifier', 'finance')
group by r.id, r.name_ka;

create view admin_members as
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
  (d.id is not null) as is_delegate
from profiles p
left join regions r on r.id = p.region_id
left join cities c on c.id = p.city_id
left join delegates d on d.id = p.id
left join memberships m on m.member_id = p.id and m.ended_at is null
left join profiles dp on dp.id = m.delegate_id
where has_any_admin_role('super_admin', 'verifier', 'finance');

create view admin_delegate_queue as
select
  d.id,
  p.first_name,
  p.last_name,
  p.phone,
  p.region_id,
  r.name_ka as region_name_ka,
  d.status,
  d.slug,
  d.bio,
  d.photo_url,
  d.review_note,
  d.tc_accepted_at,
  p.created_at,
  d.verified_at,
  vp.first_name as verified_by_first_name,
  vp.last_name as verified_by_last_name,
  coalesce(act.cnt, 0)::int as active_supporters,
  coalesce(tot.cnt, 0)::int as total_supporters
from delegates d
join profiles p on p.id = d.id
left join regions r on r.id = p.region_id
left join profiles vp on vp.id = d.verified_by
left join lateral (
  select count(*) as cnt from memberships m
  join profiles mp on mp.id = m.member_id
  where m.delegate_id = d.id and m.ended_at is null and mp.status = 'active_member'
) act on true
left join lateral (
  select count(*) as cnt from memberships m
  where m.delegate_id = d.id and m.ended_at is null
) tot on true
where has_any_admin_role('super_admin', 'verifier');

create view admin_payments as
select
  pay.id,
  pay.member_id,
  p.first_name,
  p.last_name,
  p.reference_code,
  pay.amount_gel,
  pay.months_covered,
  pay.paid_at,
  pay.bank_reference,
  pay.source,
  rb.first_name as recorded_by_first_name,
  rb.last_name as recorded_by_last_name,
  pay.created_at,
  pay.voided_at,
  vb.first_name as voided_by_first_name,
  vb.last_name as voided_by_last_name,
  pay.void_reason
from payments pay
join profiles p on p.id = pay.member_id
left join profiles rb on rb.id = pay.recorded_by
left join profiles vb on vb.id = pay.voided_by
where has_any_admin_role('super_admin', 'finance');

create view admin_finance_stats as
select
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel,
  (select count(*)::int from profiles where status = 'active_member') as active_count,
  (select count(*)::int from profiles
     where status = 'active_member' and membership_tier = 5) as tier5_count,
  (select count(*)::int from profiles
     where status = 'active_member' and membership_tier = 10) as tier10_count,
  (select count(*)::int from profiles
     where status = 'active_member' and membership_tier = 20) as tier20_count
where has_any_admin_role('super_admin', 'finance');

create view admin_admins as
select
  ar.user_id,
  p.first_name,
  p.last_name,
  p.phone,
  ar.role,
  ar.granted_at,
  gp.first_name as granted_by_first_name,
  gp.last_name as granted_by_last_name
from admin_roles ar
join profiles p on p.id = ar.user_id
left join profiles gp on gp.id = ar.granted_by
where has_admin_role('super_admin');

create view admin_audit as
select
  a.id,
  a.created_at,
  a.actor_id,
  ap.first_name as actor_first_name,
  ap.last_name as actor_last_name,
  a.action,
  a.target_type,
  a.target_id,
  -- text-compare join: target_id is text by design (targets survive deletion);
  -- resolves display names for people-shaped targets, null otherwise
  case when tp.id is not null then tp.first_name || ' ' || tp.last_name end as target_label,
  a.details
from audit_log a
left join profiles ap on ap.id = a.actor_id
left join profiles tp
  on a.target_type in ('profile', 'delegate') and tp.id::text = a.target_id
where has_admin_role('super_admin');

create view admin_settings as
select s.key, s.value, s.updated_at,
       up.first_name as updated_by_first_name,
       up.last_name as updated_by_last_name
from app_settings s
left join profiles up on up.id = s.updated_by
where has_admin_role('super_admin');

grant select on admin_overview, admin_region_stats, admin_members,
  admin_delegate_queue, admin_payments, admin_finance_stats, admin_admins,
  admin_audit, admin_settings to authenticated;

-- 7) Mutation RPCs (spec §4.5) --------------------------------------------------------
-- Envelope: SECURITY DEFINER, search_path '', role check FIRST, every effect + its
-- audit row in this one transaction, error tokens for lib/funnel.ts mapping.

create function admin_approve_delegate(p_delegate_id uuid, p_slug text) returns jsonb
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

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.approve', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'slug', v_slug,
            'priorStatus', v_delegate.status::text));
  return jsonb_build_object('slug', v_slug);
end $$;
grant execute on function admin_approve_delegate(uuid, text) to authenticated;
revoke execute on function admin_approve_delegate(uuid, text) from public, anon;

create function admin_reject_delegate(p_delegate_id uuid, p_note text default null) returns void
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

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.reject', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'note', v_note));
end $$;
grant execute on function admin_reject_delegate(uuid, text) to authenticated;
revoke execute on function admin_reject_delegate(uuid, text) from public, anon;

create function admin_update_delegate_profile(
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

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.update_profile', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'bioChanged', v_bio is distinct from v_delegate.bio,
            'photoChanged', v_photo is distinct from v_delegate.photo_url));
end $$;
grant execute on function admin_update_delegate_profile(uuid, text, text) to authenticated;
revoke execute on function admin_update_delegate_profile(uuid, text, text) from public, anon;

create function admin_record_payment(
  p_member_id uuid, p_amount_gel numeric, p_paid_at date, p_bank_reference text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_ref text := nullif(btrim(coalesce(p_bank_reference, '')), '');
  v_months int;
  v_payment_id bigint;
  v_new_status public.member_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if p_amount_gel is null or p_amount_gel <= 0 or p_amount_gel > 10000
     or p_amount_gel <> round(p_amount_gel, 2) then
    raise exception 'invalid_amount';
  end if;
  if p_paid_at is null or p_paid_at > current_date or p_paid_at < date '2026-01-01' then
    raise exception 'invalid_date';
  end if;
  if v_ref is not null and length(v_ref) > 64 then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;
  -- only completed registrations hold a reference code and a tier
  if v_profile.reference_code is null or v_profile.membership_tier is null then
    raise exception 'not_completed';
  end if;

  begin
    insert into public.payments
      (member_id, amount_gel, paid_at, bank_reference, source, recorded_by, tier_gel_at_payment)
    values
      (p_member_id, p_amount_gel, p_paid_at, v_ref, 'manual', v_uid, v_profile.membership_tier)
    returning id, months_covered into v_payment_id, v_months;
  exception when unique_violation then
    raise exception 'duplicate_reference';
  end;

  perform public.recompute_member_active(p_member_id);
  select status into v_new_status from public.profiles where id = p_member_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'payment.record', 'payment', v_payment_id::text,
          jsonb_build_object(
            'memberId', p_member_id,
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'referenceCode', v_profile.reference_code,
            'amountGel', p_amount_gel,
            'months', v_months,
            'paidAt', p_paid_at,
            'bankReference', v_ref,
            'newStatus', v_new_status::text));
  return jsonb_build_object('months', v_months, 'newStatus', v_new_status::text);
end $$;
grant execute on function admin_record_payment(uuid, numeric, date, text) to authenticated;
revoke execute on function admin_record_payment(uuid, numeric, date, text) from public, anon;

-- Bulk: all-or-nothing. Any invalid row aborts the whole batch with a positional
-- token 'bulk_row:<index>:<reason>' the server action surfaces on the preview.
create function admin_record_payments_bulk(p_rows jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_batch uuid := gen_random_uuid();
  v_count int := 0;
  v_total numeric := 0;
  v_row jsonb;
  v_idx int := 0;
  v_code text;
  v_amount numeric;
  v_paid date;
  v_profile public.profiles%rowtype;
  v_months int;
  v_payment_id bigint;
  v_member_ids uuid[] := '{}';
  v_member uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then
    raise exception 'invalid_rows';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_code := upper(btrim(coalesce(v_row->>'referenceCode', '')));
    v_amount := (v_row->>'amountGel')::numeric;
    v_paid := (v_row->>'paidAt')::date;

    if v_amount is null or v_amount <= 0 or v_amount > 10000
       or v_amount <> round(v_amount, 2) then
      raise exception 'bulk_row:%:invalid_amount', v_idx;
    end if;
    if v_paid is null or v_paid > current_date or v_paid < date '2026-01-01' then
      raise exception 'bulk_row:%:invalid_date', v_idx;
    end if;
    select * into v_profile from public.profiles where reference_code = v_code;
    if not found then raise exception 'bulk_row:%:unknown_code', v_idx; end if;
    if v_profile.membership_tier is null then
      raise exception 'bulk_row:%:not_completed', v_idx;
    end if;
    -- In-DB duplicate backstop (bulk rows have no bank_reference, so the live-ref
    -- unique index cannot protect them): an identical live payment — same member,
    -- amount and date — aborts the batch. The preview classifies these as
    -- duplicates and excludes them; reaching this raise means a stale/bypassed
    -- confirm payload. Covers within-batch repeats too (earlier row already inserted).
    if exists (select 1 from public.payments pay
               where pay.member_id = v_profile.id and pay.amount_gel = v_amount
                 and pay.paid_at = v_paid and pay.voided_at is null) then
      raise exception 'bulk_row:%:duplicate', v_idx;
    end if;

    insert into public.payments
      (member_id, amount_gel, paid_at, bank_reference, source, recorded_by, tier_gel_at_payment)
    values
      (v_profile.id, v_amount, v_paid, null, 'manual', v_uid, v_profile.membership_tier)
    returning id, months_covered into v_payment_id, v_months;

    insert into public.audit_log (actor_id, action, target_type, target_id, details)
    values (v_uid, 'payment.record', 'payment', v_payment_id::text,
            jsonb_build_object(
              'memberId', v_profile.id,
              'memberName', v_profile.first_name || ' ' || v_profile.last_name,
              'referenceCode', v_code,
              'amountGel', v_amount,
              'months', v_months,
              'paidAt', v_paid,
              'batchId', v_batch));

    v_member_ids := array_append(v_member_ids, v_profile.id);
    v_count := v_count + 1;
    v_total := v_total + v_amount;
    v_idx := v_idx + 1;
  end loop;

  -- dedup before recompute: a member may appear in several batch rows
  select array_agg(distinct m) into v_member_ids from unnest(v_member_ids) m;
  foreach v_member in array v_member_ids loop
    perform public.recompute_member_active(v_member);
  end loop;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'payment.bulk_record', 'payment', v_batch::text,
          jsonb_build_object('batchId', v_batch, 'count', v_count, 'totalGel', v_total));
  return jsonb_build_object('count', v_count, 'totalGel', v_total);
end $$;
grant execute on function admin_record_payments_bulk(jsonb) to authenticated;
revoke execute on function admin_record_payments_bulk(jsonb) from public, anon;

create function admin_void_payment(p_payment_id bigint, p_reason text) returns jsonb
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
  select * into v_profile from public.profiles where id = v_payment.member_id;

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
grant execute on function admin_void_payment(bigint, text) to authenticated;
revoke execute on function admin_void_payment(bigint, text) from public, anon;

create function admin_reassign_member(p_member_id uuid, p_delegate_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target uuid;
  v_open_delegate uuid;
  v_has_open boolean := false;
  v_from_name text;
  v_to_name text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'verifier') then
    raise exception 'missing_role';
  end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then
    raise exception 'invalid_target';
  end if;
  if exists (select 1 from public.delegates d where d.id = p_member_id) then
    raise exception 'invalid_target'; -- delegates hold no membership (ADR-013)
  end if;
  select d.id into v_target from public.delegates d
    where d.id = p_delegate_id and d.status = 'approved';
  if v_target is null then raise exception 'invalid_delegate'; end if;

  select m.delegate_id, true into v_open_delegate, v_has_open
    from public.memberships m where m.member_id = p_member_id and m.ended_at is null;

  if not coalesce(v_has_open, false) then
    -- spec §4.5 precondition: completed members always hold an open membership row
    -- (possibly with delegate_id null = ცენტრალური მოძრაობა, ADR-013); a missing
    -- row means this member is not reassignable — refuse rather than self-heal.
    raise exception 'invalid_target';
  end if;
  if v_open_delegate = v_target then
    return; -- same target: friendly no-op, no history row, no audit noise
  end if;

  update public.memberships set ended_at = now()
    where member_id = p_member_id and ended_at is null;
  insert into public.memberships (member_id, delegate_id) values (p_member_id, v_target);

  select case when v_open_delegate is null then 'ცენტრალური მოძრაობა'
              else (select pr.first_name || ' ' || pr.last_name
                      from public.profiles pr where pr.id = v_open_delegate) end
    into v_from_name;
  select pr.first_name || ' ' || pr.last_name into v_to_name
    from public.profiles pr where pr.id = v_target;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.reassign', 'profile', p_member_id::text,
          jsonb_build_object(
            'memberName', v_profile.first_name || ' ' || v_profile.last_name,
            'fromDelegateId', v_open_delegate, 'fromName', v_from_name,
            'toDelegateId', v_target, 'toName', v_to_name));
end $$;
grant execute on function admin_reassign_member(uuid, uuid) to authenticated;
revoke execute on function admin_reassign_member(uuid, uuid) from public, anon;

-- The ONLY two paths that return a personal ID to any client, both audited
-- unconditionally (spec decision #5).
create function admin_reveal_personal_id(p_member_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.reveal_personal_id', 'profile', p_member_id::text,
          jsonb_build_object('memberName', v_profile.first_name || ' ' || v_profile.last_name));
  return v_profile.personal_id;
end $$;
grant execute on function admin_reveal_personal_id(uuid) to authenticated;
revoke execute on function admin_reveal_personal_id(uuid) from public, anon;

create function admin_reveal_applicant_personal_id(p_delegate_id uuid) returns text
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
  select * into v_profile from public.profiles where id = p_delegate_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.reveal_personal_id', 'delegate', p_delegate_id::text,
          jsonb_build_object('memberName', v_profile.first_name || ' ' || v_profile.last_name));
  return v_profile.personal_id;
end $$;
grant execute on function admin_reveal_applicant_personal_id(uuid) to authenticated;
revoke execute on function admin_reveal_applicant_personal_id(uuid) from public, anon;

create function admin_export_members(
  p_search text, p_region_id int, p_status text, p_include_ids boolean
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status public.member_status;
  v_rows jsonb;
  v_count int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_any_admin_role('super_admin', 'finance') then
    raise exception 'missing_role';
  end if;
  if coalesce(p_include_ids, false) and not public.has_admin_role('super_admin') then
    raise exception 'missing_role'; -- IDs are super_admin-only (spec decision #6)
  end if;
  if v_search is not null and length(v_search) > 100 then raise exception 'invalid_target'; end if;
  if p_status is not null then
    if p_status not in ('draft', 'profile_completed', 'active_member') then
      raise exception 'invalid_target';
    end if;
    v_status := p_status::public.member_status;
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb),
         count(*)::int
    into v_rows, v_count
  from (
    select p.created_at,
           jsonb_build_object(
             'firstName', p.first_name,
             'lastName', p.last_name,
             'phone', p.phone,
             'regionNameKa', r.name_ka,
             'cityNameKa', c.name_ka,
             'delegateName', case when m.delegate_id is null then null
                                  else dp.first_name || ' ' || dp.last_name end,
             'status', p.status::text,
             'tier', p.membership_tier,
             'referenceCode', p.reference_code,
             -- Tbilisi calendar day, fixed offset (house convention)
             'registeredAt', to_char(p.created_at + interval '4 hours', 'YYYY-MM-DD'))
           || case when coalesce(p_include_ids, false)
                   then jsonb_build_object('personalId', p.personal_id)
                   else '{}'::jsonb end as row_data
    from public.profiles p
    left join public.regions r on r.id = p.region_id
    left join public.cities c on c.id = p.city_id
    left join public.memberships m on m.member_id = p.id and m.ended_at is null
    left join public.profiles dp on dp.id = m.delegate_id
    where (v_search is null
           or p.first_name ilike '%' || v_search || '%'
           or p.last_name ilike '%' || v_search || '%'
           or p.phone ilike '%' || v_search || '%'
           or p.reference_code ilike '%' || v_search || '%')
      and (p_region_id is null or p.region_id = p_region_id)
      and (v_status is null or p.status = v_status)
  ) q;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'member.export', 'profile', null,
          jsonb_build_object(
            'search', v_search, 'regionId', p_region_id, 'status', p_status,
            'includeIds', coalesce(p_include_ids, false), 'rowCount', v_count));
  return v_rows;
end $$;
grant execute on function admin_export_members(text, int, text, boolean) to authenticated;
revoke execute on function admin_export_members(text, int, text, boolean) from public, anon;

create function admin_grant_role(p_user_id uuid, p_role text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_inserted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if p_role is null or p_role not in ('super_admin', 'verifier', 'finance', 'editor') then
    raise exception 'invalid_role';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then raise exception 'invalid_target'; end if;
  if v_profile.registration_completed_at is null and v_profile.status <> 'active_member' then
    raise exception 'not_completed'; -- admins must be completed members (spec §3.7)
  end if;

  insert into public.admin_roles (user_id, role, granted_by)
  values (p_user_id, p_role, v_uid)
  on conflict (user_id, role) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return; end if; -- already held: friendly no-op, no audit noise

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'admin.grant_role', 'admin_role', p_user_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'role', p_role));
end $$;
grant execute on function admin_grant_role(uuid, text) to authenticated;
revoke execute on function admin_grant_role(uuid, text) from public, anon;

create function admin_revoke_role(p_user_id uuid, p_role text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_deleted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if p_role is null or p_role not in ('super_admin', 'verifier', 'finance', 'editor') then
    raise exception 'invalid_role';
  end if;
  -- lockout guard (spec §3.7): the platform must always retain one super_admin
  if p_role = 'super_admin'
     and exists (select 1 from public.admin_roles
                 where user_id = p_user_id and role = 'super_admin')
     and (select count(*) from public.admin_roles where role = 'super_admin') = 1 then
    raise exception 'last_super_admin';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;

  delete from public.admin_roles where user_id = p_user_id and role = p_role;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then return; end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'admin.revoke_role', 'admin_role', p_user_id::text,
          jsonb_build_object(
            'name', coalesce(v_profile.first_name || ' ' || v_profile.last_name, p_user_id::text),
            'role', p_role));
end $$;
grant execute on function admin_revoke_role(uuid, text) to authenticated;
revoke execute on function admin_revoke_role(uuid, text) from public, anon;

create function admin_update_setting(p_key text, p_value jsonb) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_days int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_admin_role('super_admin') then raise exception 'missing_role'; end if;
  if p_key is distinct from 'active_grace_days' then raise exception 'invalid_setting'; end if;
  begin
    v_days := (p_value #>> '{}')::int;
  exception when others then
    raise exception 'invalid_setting';
  end;
  if v_days is null or v_days < 0 or v_days > 365 then raise exception 'invalid_setting'; end if;

  select value into v_old from public.app_settings where key = p_key;
  -- upsert (spec §3.9): the migration seeds the row, but the RPC must not
  -- silently no-op if the row is ever absent
  insert into public.app_settings (key, value, updated_at, updated_by)
    values (p_key, to_jsonb(v_days), now(), v_uid)
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'settings.update', 'setting', p_key,
          jsonb_build_object('old', v_old, 'new', to_jsonb(v_days)));

  -- the rule changed — the whole platform reflects it immediately (spec §3.9)
  perform public.recompute_all_active();
end $$;
grant execute on function admin_update_setting(text, jsonb) to authenticated;
revoke execute on function admin_update_setting(text, jsonb) from public, anon;

-- 8) Grants & RLS riders (spec §4.6) ---------------------------------------------------
-- Personal-ID lockdown: the general read grant on profiles loses personal_id and
-- birth_date. Verified: no client-path code selects either (write-only through
-- funnel_save_profile; the platform never echoes them — Phase 3 stance).
revoke select on profiles from authenticated;
grant select (id, first_name, last_name, phone, region_id, city_id, employment,
              status, signup_role, signup_ref_code, membership_tier, reference_code,
              registration_completed_at, created_at, updated_at)
  on profiles to authenticated;

-- Own roles readable — the admin layout/nav reads ONLY the caller's rows.
create policy "own admin roles readable" on admin_roles
  for select using (auth.uid() = user_id);
grant select on admin_roles to authenticated;

-- 9) funnel_state(): + admin flag (additive; full replacement of the Phase 3 body) ----
create or replace function funnel_state() returns jsonb
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
    'status', v_profile.status::text,
    'registrationCompletedAt', v_profile.registration_completed_at,
    'createdAt', v_profile.created_at,
    'delegateStatus', case when v_has_delegate then v_delegate.status::text end,
    'referral', v_referral,
    'chosenDelegate', v_chosen,
    'membershipExists', coalesce(v_membership_exists, false),
    -- Phase 4 (spec §4.6): the cabinet's ადმინისტრირება tab
    'admin', exists (select 1 from public.admin_roles ar where ar.user_id = v_uid)
  );
end $$;
-- CREATE OR REPLACE preserves existing ACLs — no re-grant needed (house note, Phase 3).

-- 10) Storage: delegate photos (spec §4.8) ---------------------------------------------
-- Public-read bucket; NO client write policies — uploads go exclusively through the
-- server action (service role) paired with admin_update_delegate_profile.
insert into storage.buckets (id, name, public)
values ('delegate-photos', 'delegate-photos', true)
on conflict (id) do update set public = true;
