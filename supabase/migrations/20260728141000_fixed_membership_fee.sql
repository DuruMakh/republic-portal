-- Owner fix list #9 (2026-07-27): membership is a fixed 10 GEL/month. The 5/10/20
-- choice is retired from the product, so the database stops accepting anything else.
--
-- BACKFILL SAFETY (verified before the owner approved this): payments carry
-- tier_gel_at_payment, frozen at the moment of payment, and payments.months_covered
-- is a GENERATED column derived from it (20260717150000:43-44). Re-tagging a
-- profile's membership_tier therefore CANNOT retroactively change what any past
-- payment bought. Only future obligation changes. payments.tier_gel_at_payment's own
-- check (in (5, 10, 20)) is deliberately left untouched: narrowing it would require
-- rewriting historical rows that legitimately recorded 5 or 20 at the time they were
-- paid, which is exactly the history-rewriting this migration must not do.
--
-- protect_profile_columns() guards membership_tier only for
-- current_user in ('anon','authenticated') (20260721120000:56), so the migration
-- role updates it directly — no trigger juggling needed. Verified by reading the
-- trigger body, not assumed.
--
-- SOURCE-CITATION CORRECTION (verified against the actual migration history in this
-- worktree, not assumed from the plan): the plan's citation for become_member_complete's
-- VERBATIM source (20260721120000_progressive_registration.sql:529-581) is the
-- function's original, correctly-bounded definition, but that definition was already
-- superseded — before this branch — by 20260728100000_personal_id_at_membership.sql:
-- 231-284, which added the `or v_profile.personal_id is null` clause to the
-- profile-completeness guard (owner fix #10). Copying the plan's cited body verbatim
-- would silently revert that fix and let become_member_complete mint a member with no
-- personal_id again. The body restated below is copied VERBATIM from the LIVE
-- definition instead (20260728100000_personal_id_at_membership.sql:231-284, the
-- `create or replace function` line through its own `end $$;`), changing exactly the
-- tier-guard line the plan specifies.
--
-- GRANTS-ON-DROP CORRECTION: admin_finance_stats loses columns, so it must be dropped
-- and recreated (create-or-replace view can only append columns). A dropped-and-
-- recreated relation starts over at this Supabase project's default privileges, which
-- grant anon/authenticated everything on any new object in public (confirmed live —
-- see lib/security/schema-guards.test.ts's standing comment, and
-- 20260726120000_revoke_view_write_grants.sql, which closed this exact hole for
-- admin_finance_stats and 23 other views). Restating only the SELECT grant (as the
-- plan's SQL snippet shows) would silently reopen the write-grant hole for this one
-- view while its 23 siblings stayed closed. Both statements are restated below, revoke
-- before grant, same order 20260728140000_transparency_region_money.sql used when it
-- did the identical drop-and-recreate for transparency_regions.

update profiles set membership_tier = 10
 where membership_tier is not null and membership_tier <> 10;

alter table profiles add constraint profiles_membership_tier_fixed
  check (membership_tier is null or membership_tier = 10);

-- The self-service tier switcher has no product surface any more.
drop function member_change_tier(int);

-- become_member_complete(p_tier int): same signature, so create-or-replace and no
-- drop/regrant — but grants are restated below anyway, per the house style
-- 20260728100000_personal_id_at_membership.sql established for this exact function.
create or replace function become_member_complete(p_tier int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_delegate uuid;
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'profile_incomplete'; end if;
  if v_profile.registration_completed_at is not null then
    return public.cabinet_state();
  end if;
  if v_profile.birth_date is null or v_profile.region_id is null
     or v_profile.city_id is null or v_profile.employment is null
     or v_profile.personal_id is null then
    raise exception 'profile_incomplete';
  end if;
  if p_tier is distinct from 10 then raise exception 'invalid_tier'; end if;

  -- re-validate the held choice; a delegate who lost approval falls back to central
  select d.id into v_delegate
    from public.delegates d
    where d.id = v_profile.pending_delegate_id and d.status = 'approved';

  if not exists (
    select 1 from public.memberships m where m.member_id = v_uid and m.ended_at is null
  ) then
    begin
      insert into public.memberships (member_id, delegate_id) values (v_uid, v_delegate);
    exception when unique_violation then
      null; -- concurrent double-complete: the partial unique index already holds the row
    end;
  end if;

  loop
    v_code := 'GR-' || public.gen_funnel_code(6);
    begin
      update public.profiles set
        membership_tier = p_tier,
        reference_code = v_code,
        registration_completed_at = now(),
        status = case when status = 'registered' then 'profile_completed' else status end,
        pending_delegate_id = null
      where id = v_uid;
      exit;
    exception when unique_violation then
      -- reference_code collision — regenerate and retry
    end;
  end loop;

  return public.cabinet_state();
end $$;

grant execute on function become_member_complete(int) to authenticated;
revoke execute on function become_member_complete(int) from public, anon;

-- admin_finance_stats: the column set shrinks (tier5_count/tier10_count/tier20_count
-- drop), and create-or-replace view can only append columns, never remove them — so
-- this is drop + create, same treatment 20260728140000_transparency_region_money.sql
-- gave transparency_regions.
drop view admin_finance_stats;

create view admin_finance_stats as
select
  (select coalesce(sum(membership_tier), 0)::int
     from profiles where status = 'active_member') as mrr_gel,
  (select count(*)::int from profiles where status = 'active_member') as active_count
where has_any_admin_role('super_admin', 'finance');

-- Revoke first (undoes whatever this project's default privileges just re-granted to
-- anon/authenticated on the freshly-created relation), then grant back exactly what
-- the app needs — reversing the order would have the grant undone by the revoke.
revoke all on admin_finance_stats from anon, authenticated;

-- Verbatim from 20260717150000_admin_crm.sql:336-338 — the original grant statement
-- for admin_finance_stats, which also names 8 sibling views this migration never
-- touches (repeating it is a no-op for those and restores the grant for this one).
grant select on admin_overview, admin_region_stats, admin_members,
  admin_delegate_queue, admin_payments, admin_finance_stats, admin_admins,
  admin_audit, admin_settings to authenticated;
