-- Member counts without dues (ADR-036, owner decision 2026-10-07).
--
-- Dues are dropped for now, so nobody becomes active_member and the "active" figures would
-- freeze. Every public member figure now counts each completed member (profile_completed or
-- active_member). Additive only: each view is replaced with its existing columns unchanged
-- and in place, and one column appended at the end, which CREATE OR REPLACE VIEW allows.
-- Ownership, definer-style execution and the grants from
-- 20260811101122_normalize_production_view_grants.sql are kept by CREATE OR REPLACE.
-- The old active figures stay for the hidden finance surfaces and admin finance tooling.

-- Body unchanged from 20260713175043_public_read_model.sql; `members` appended: the
-- delegate's open memberships, which only completed members hold.
create or replace view public_delegates as
select
  d.id,
  d.slug,
  p.first_name,
  p.last_name,
  p.region_id,
  r.name_ka as region_name_ka,
  d.bio,
  d.photo_url,
  coalesce(s.cnt, 0)::int as active_supporters,
  coalesce(t.cnt, 0)::int as members
from delegates d
join profiles p on p.id = d.id
left join regions r on r.id = p.region_id
left join lateral (
  select count(*) as cnt
  from memberships m
  join profiles mp on mp.id = m.member_id
  where m.delegate_id = d.id
    and m.ended_at is null
    and mp.status = 'active_member'
) s on true
left join lateral (
  select count(*) as cnt
  from memberships m
  where m.delegate_id = d.id
    and m.ended_at is null
) t on true
where d.status = 'approved';

-- Body unchanged from 20260722120000_r2_ladder_and_numbers.sql; `members_total` appended.
create or replace view public_stats as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members,
  (select count(*)::int from profiles) as registered_total,
  (select count(*)::int from profiles
     where status in ('profile_completed', 'active_member')) as members_total;
