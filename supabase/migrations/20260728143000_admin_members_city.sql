-- Owner fix list #16 (2026-07-27): the member list gains a city filter. The view
-- already exposes city_name_ka for display but not the id the filter needs.
-- create-or-replace may only APPEND columns, so city_id goes last.
--
-- Select list copied VERBATIM from the LIVE definition at
-- 20260722120000_r2_ladder_and_numbers.sql:222-255 (the most recent
-- `create or replace view admin_members` in the migration history — confirmed
-- by grepping every migration for the statement; the three later unpushed
-- migrations from this round, 20260728140000/141000/142000, never redefine
-- this view — 141000 only repeats the standing grant, verbatim, across all
-- nine admin_ views including this one). Only change: p.city_id appended as
-- the last select-list item, immediately before `from profiles p`.
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
  sdp.last_name as signup_delegate_last_name,
  p.city_id
from profiles p
left join regions r on r.id = p.region_id
left join cities c on c.id = p.city_id
left join delegates d on d.id = p.id
left join memberships m on m.member_id = p.id and m.ended_at is null
left join profiles dp on dp.id = m.delegate_id
left join delegates sd on sd.referral_code = p.signup_ref_code
left join profiles sdp on sdp.id = sd.id
where has_any_admin_role('super_admin', 'verifier', 'finance');
