-- Security check-up fix wave (Task 12), fix 1 of 5 — finding F5 / LB-5.
--
-- Eleven views still carried the Supabase default INSERT/UPDATE/DELETE/TRUNCATE
-- grants for `anon` and `authenticated`: admin_admins, admin_audit,
-- admin_delegate_queue, admin_finance_stats, admin_members, admin_overview,
-- admin_payments, admin_region_stats, admin_settings, public_delegates,
-- public_stats. The other thirteen were treated in
-- 20260719150000_community.sql:252 (`revoke all ... from anon, authenticated`);
-- these eleven predate that migration and were never swept.
--
-- WHY THIS IS A REAL FINDING AND NOT A THEORETICAL ONE. The write is refused
-- live today, but the ERROR CODE says who refused it: an anonymous INSERT into
-- admin_roles answers 42501 (a SECURITY check refused you), while an anonymous
-- INSERT into admin_admins answers 55000 "Views that do not select from a
-- single table or view are not automatically updatable" — i.e. the security
-- check PASSED and the PLANNER refused on the view's SHAPE. Every one of these
-- views is owned by postgres with security_invoker unset and no WITH CHECK
-- OPTION, so a write through an auto-updatable one would execute with the
-- owner's rights and never evaluate the view's own WHERE — straight past the
-- base table's RLS. admin_settings and admin_admins are each ONE real table
-- plus a cosmetic display join for a name; removing that join is a routine
-- refactor, and it would turn anonymous writes into app_settings / admin_roles
-- from impossible into live. The defence is accidental, not designed.
--
-- The fix is the one LB-5 prescribes and is behaviour-free: take away the
-- write privileges and leave every SELECT grant exactly as it is. No
-- security_invoker change — flipping that WOULD change behaviour, because the
-- self-gating admin views read base tables the caller cannot read.
--
-- All 24 views are named, not just the 11, so this migration is the single
-- authoritative statement of the invariant (`lib/security/schema-guards.test.ts`
-- checks it against the live catalog on every commit). Restating it for the 13
-- already-revoked views is a no-op.
revoke insert, update, delete, truncate on
  admin_admins,
  admin_audit,
  admin_delegate_queue,
  admin_events,
  admin_finance_stats,
  admin_members,
  admin_news,
  admin_overview,
  admin_payments,
  admin_poll_options,
  admin_polls,
  admin_region_stats,
  admin_settings,
  member_event_going_counts,
  member_news,
  member_poll_options,
  member_polls,
  poll_option_counts,
  public_delegates,
  public_events,
  public_news,
  public_stats,
  transparency_regions,
  transparency_stats
  from anon, authenticated;
