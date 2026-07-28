-- Owner fix list #5 (2026-07-27): the finances table shows collected money per
-- region, and the "member" column finally counts members instead of everyone who
-- ever registered. The column set changes, so transparency_regions is dropped and
-- recreated (create-or-replace cannot drop or rename columns); grants restated to
-- match 20260719150000 + the 20260726120000 write-grant revoke.
--
-- Money is attributed to the PAYER'S CURRENT REGION: a member who moves takes their
-- payment history with them.
--
-- The members predicate below (status in ('profile_completed', 'active_member')) is
-- the honest, explicit spelling of what this view's old `registered` column already
-- evaluated to. 20260721120000_progressive_registration.sql:26 renamed the
-- member_status enum's original first label to 'registered' via ALTER TYPE ...
-- RENAME VALUE, an operation that changes only the label recorded in pg_enum, not
-- the value's OID -- and a stored view's query tree binds enum literals to the OID
-- at CREATE VIEW time, not the label. So the original predicate kept meaning exactly
-- what it always meant even after the rename; only its on-screen spelling changed.
-- Writing today's equivalent out in full (rather than restating that original
-- literal) is required here, not cosmetic: that label no longer exists on the live
-- enum at all, so any new statement citing it raises 22P02 and rolls back the whole
-- migration on push. Same convention 20260722120000_r2_ladder_and_numbers.sql:193-195
-- already established for this situation -- do not "simplify" this back to the
-- original literal.
--
-- profiles.region_id is nullable (registration completes before a region is chosen),
-- so a payer with no region is counted in the page's headline total but in no region
-- row here -- collected_gel across regions may therefore not sum exactly to that
-- total. become_member_save_profile raises invalid_region, so only legacy rows
-- predating that requirement can hit this.
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
