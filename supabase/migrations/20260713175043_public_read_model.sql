-- Phase 1: public read model.
-- Views are intentionally definer-style (owned by postgres, no security_invoker):
-- they exist precisely to expose a fixed, safe column set from RLS-protected
-- tables to anonymous visitors. Supabase's linter will flag them — documented
-- exception, see docs/superpowers/specs/2026-07-13-phase-1-public-core-design.md §4.

-- Delegate page slugs (seed backfills; Phase 4 approval flow generates)
alter table delegates add column slug text unique;
alter table delegates add constraint approved_delegates_have_slug
  check (status <> 'approved' or slug is not null);

-- Serve the per-delegate active-supporter count
create index memberships_active_by_delegate
  on memberships (delegate_id) where ended_at is null;

create view public_delegates as
select
  d.id,
  d.slug,
  p.first_name,
  p.last_name,
  p.region_id,
  r.name_ka as region_name_ka,
  d.bio,
  d.photo_url,
  coalesce(s.cnt, 0)::int as active_supporters
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
where d.status = 'approved';

create view public_stats as
select
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles where status = 'active_member') as active_members;

grant select on public_delegates, public_stats to anon, authenticated;

-- Close the Phase 0 deferred item: public reads go ONLY through the views.
-- (The old policy exposed tc_accepted_at/verified_at/verified_by/referral_code
-- on approved rows to any client.)
drop policy "approved delegates are public" on delegates;
revoke select on delegates from anon, authenticated;

-- Deferred-item rider: created_at joins the server-managed profile columns.
create or replace function protect_profile_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.status is distinct from old.status
      or new.personal_id is distinct from old.personal_id
      or new.phone is distinct from old.phone
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at)
  then
    raise exception 'profiles.status, personal_id, phone, id and created_at are server-managed';
  end if;
  return new;
end $$;
