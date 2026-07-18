-- Phase 4 hardening (post-review fix batch, 2026-07-18). Six independent fixes:
--
--   1) Tbilisi day source: every date check/derivation used current_date, which
--      evaluates on the UTC session day — 4h behind the app's todayTbilisiIso
--      (UTC+4) every night. A payment dated "today" was rejected between 00:00
--      and 04:00 Tbilisi, and the engine's active-ness flipped 4h late. One
--      tbilisi_today() helper now feeds all of them.
--   2) admin_record_payment gets the member+amount+date duplicate backstop for
--      REFERENCE-LESS payments — the live-ref unique index only protects rows
--      that carry a bank reference, so the same real transfer entered twice
--      with the field blank double-credited the member.
--   3) admin_approve_delegate requires a COMPLETED registration; the delegates
--      row exists from funnel step 2, so an abandoned applicant could be
--      approved and published with no tier and no reference code. The queue
--      view hides incomplete applicants for the same reason (they reappear
--      the moment they finish step 3), and admin_overview's pending count
--      matches the queue.
--   4) admin_revoke_role serializes super_admin revokes with an advisory lock:
--      the count(*)=1 lockout guard was check-then-act — two concurrent
--      revokes could each see 2 and leave the platform with none.
--   5) payments column privileges: the Phase-0 table-wide grant let a member
--      read the admin-internal void_reason / voided_by / recorded_by on their
--      own rows via the REST API. Members keep exactly the columns the
--      billing page renders; admin surfaces read the definer views.

-- 1) One day source ------------------------------------------------------------------
create function tbilisi_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Tbilisi')::date
$$;
revoke execute on function tbilisi_today() from public, anon, authenticated;

create or replace function recompute_member_active(p_member uuid) returns void
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
    when v_end is not null and public.tbilisi_today() <= v_end + public.active_grace_days()
      then 'active_member'::public.member_status
    else 'profile_completed'::public.member_status
  end;
  if v_new is distinct from v_status then
    update public.profiles set status = v_new where id = p_member;
  end if;
end $$;

create or replace function recompute_all_active() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.profiles p set status = sub.new_status
  from (
    select p2.id,
           case
             when c.v_end is not null
                  and public.tbilisi_today() <= c.v_end + public.active_grace_days()
               then 'active_member'::public.member_status
             else 'profile_completed'::public.member_status
           end as new_status
    from public.profiles p2
    cross join lateral (select public.active_coverage(p2.id) as v_end) c
    where p2.status <> 'draft'
  ) sub
  where p.id = sub.id and p.status is distinct from sub.new_status;
end $$;

create or replace function active_sweep() returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_demoted int;
begin
  with lapsed as (
    select p.id
    from public.profiles p
    cross join lateral (select public.active_coverage(p.id) as v_end) c
    where p.status = 'active_member'
      and (c.v_end is null or public.tbilisi_today() > c.v_end + public.active_grace_days())
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

-- 2) Single-entry duplicate backstop + Tbilisi date window ---------------------------
create or replace function admin_record_payment(
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
  if p_paid_at is null or p_paid_at > public.tbilisi_today()
     or p_paid_at < date '2026-01-01' then
    raise exception 'invalid_date';
  end if;
  if v_ref is not null and length(v_ref) > 64 then raise exception 'invalid_target'; end if;
  select * into v_profile from public.profiles where id = p_member_id;
  if not found then raise exception 'invalid_target'; end if;
  -- only completed registrations hold a reference code and a tier
  if v_profile.reference_code is null or v_profile.membership_tier is null then
    raise exception 'not_completed';
  end if;
  -- reference-less duplicate backstop: the live-ref unique index cannot see
  -- rows with a NULL reference, so the same real transfer entered twice with
  -- the field blank would double-credit the member. Same policy as bulk rows.
  -- Distinct same-day same-amount transfers ARE legitimate — they carry
  -- distinct bank references, which this path does not gate.
  if v_ref is null and exists (
    select 1 from public.payments pay
    where pay.member_id = p_member_id and pay.amount_gel = p_amount_gel
      and pay.paid_at = p_paid_at and pay.voided_at is null
  ) then
    raise exception 'duplicate';
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

-- 3) Bulk: Tbilisi date window (body otherwise identical to 20260717150000) ----------
create or replace function admin_record_payments_bulk(p_rows jsonb) returns jsonb
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
    if v_paid is null or v_paid > public.tbilisi_today() or v_paid < date '2026-01-01' then
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

-- 4) Approve requires a completed registration ---------------------------------------
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

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'delegate.approve', 'delegate', p_delegate_id::text,
          jsonb_build_object(
            'name', v_profile.first_name || ' ' || v_profile.last_name,
            'slug', v_slug,
            'priorStatus', v_delegate.status::text));
  return jsonb_build_object('slug', v_slug);
end $$;

-- The queue hides incomplete PENDING/REJECTED applicants for the same reason:
-- they cannot be (re-)approved, the verifier cannot tell them apart, and they
-- reappear the moment funnel_complete stamps registration_completed_at.
-- APPROVED rows stay visible regardless of completion — a delegate approved
-- while incomplete (possible before this migration) is already publicly
-- published and must remain manageable here, and their slug must stay in the
-- approve action's collision set. Column list is unchanged.
create or replace view admin_delegate_queue as
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
where (d.status = 'approved' or p.registration_completed_at is not null)
  and has_any_admin_role('super_admin', 'verifier');

-- pending count must match the queue the verifier actually sees
create or replace view admin_overview as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int
     from delegates d join profiles p on p.id = d.id
     where d.status = 'pending'
       and p.registration_completed_at is not null) as pending_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles where status <> 'draft') as total_completed,
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel
where has_any_admin_role('super_admin', 'verifier', 'finance');

-- 5) Serialize the last-super-admin guard --------------------------------------------
create or replace function admin_revoke_role(p_user_id uuid, p_role text) returns void
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
  -- lockout guard (spec §3.7): the platform must always retain one super_admin.
  -- The advisory lock serializes concurrent super_admin revokes — without it the
  -- count check is check-then-act and two simultaneous revokes of two DIFFERENT
  -- super_admins could each see 2, both pass, and leave zero.
  if p_role = 'super_admin' then
    perform pg_advisory_xact_lock(hashtext('admin_roles:super_admin_guard'));
    if exists (select 1 from public.admin_roles
               where user_id = p_user_id and role = 'super_admin')
       and (select count(*) from public.admin_roles where role = 'super_admin') = 1 then
      raise exception 'last_super_admin';
    end if;
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

-- 6) payments column privileges ------------------------------------------------------
-- Members keep exactly what the billing page renders plus benign own-row facts;
-- recorded_by / voided_by / void_reason are admin-internal (the void reason can
-- name fraud suspicions) and are readable only through the definer views.
revoke select on payments from authenticated;
grant select (id, member_id, amount_gel, paid_at, bank_reference, source,
              tier_gel_at_payment, months_covered, created_at, voided_at)
  on payments to authenticated;
