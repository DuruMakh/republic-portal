-- Owner fix list #5 (2026-07-27): the finances table shows collected money per
-- region, and the "member" column finally counts members instead of everyone who
-- ever registered. The column set changes, so transparency_regions is dropped and
-- recreated (create-or-replace cannot drop or rename columns); grants restated to
-- match 20260719150000 + the 20260726120000 write-grant revoke.
--
-- Money is attributed to the PAYER'S CURRENT REGION: a member who moves takes their
-- payment history with them. The page's footnote says so in plain Georgian.
drop view transparency_regions;

create view transparency_regions as
select r.id as region_id,
       r.name_ka,
       count(p.id) filter (
         where p.status in ('profile_completed', 'active_member')
       )::int as members,
       coalesce((
         select sum(pay.amount_gel)
           from payments pay
           join profiles pp on pp.id = pay.member_id
          where pp.region_id = r.id and pay.voided_at is null
       ), 0)::numeric(12, 2) as collected_gel
from regions r
left join profiles p on p.region_id = r.id
group by r.id, r.name_ka;

revoke all on transparency_regions from anon, authenticated;
grant select on transparency_regions to anon, authenticated;

-- transparency_stats carried the same lie in its "წევრი" box: registered_members
-- counts every non-draft profile. Add an honest members count; registered_members
-- stays for the box that legitimately counts everyone.
-- Same signature otherwise, and create-or-replace CAN append a trailing column.
create or replace view transparency_stats as
select
  coalesce((select sum(amount_gel) from payments where voided_at is null), 0)::numeric(12, 2)
    as total_gel,
  (select count(*)::int from profiles where status <> 'draft') as registered_members,
  (select count(*)::int from delegates where status = 'approved') as approved_delegates,
  (select count(*)::int from profiles
     where status in ('profile_completed', 'active_member')) as members;
