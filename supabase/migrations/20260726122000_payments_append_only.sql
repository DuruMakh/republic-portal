-- Security check-up fix wave (Task 12), fix 5 of 5 — finding L3-2.
--
-- `payments` drives active_member status AND every money figure the platform
-- publishes, and it rested on ONE layer: the absence of an RLS write policy.
-- audit_log — a table nothing derives from — has two (RLS in front, the
-- append-only trigger behind). payments also carried the Supabase default
-- INSERT/UPDATE/DELETE/TRUNCATE grants for anon and authenticated, inert today
-- only because no write policy exists, and a direct write emitted NO audit_log
-- row at all: only the RPCs audit.
--
-- Measured live before this migration, inside one aborted transaction:
-- update=ALLOWED, delete=ALLOWED. ADR-015 says both are unrepresentable —
-- payments are immutable and corrections are voids.
--
-- This adds the missing second layer in exactly audit_log's shape (a BEFORE
-- UPDATE OR DELETE row trigger raising a full sentence, not a token), with the
-- one narrowing the money table needs that the audit log does not: the void
-- transition must still go through.
--
-- WHAT COUNTS AS A VOID, and why it is defined by shape rather than by caller:
-- admin_void_payment is SECURITY DEFINER and runs as the table owner, so a
-- caller-based rule would exempt every definer function in the schema, present
-- and future. Instead the trigger permits exactly the transition that RPC
-- performs — a LIVE row (voided_at null) becoming a voided one, with every
-- other column byte-identical. months_covered is GENERATED from amount_gel and
-- tier_gel_at_payment, both pinned by that comparison, so it cannot drift
-- either. Anything else — a rewritten amount, a moved date, a swapped member,
-- an un-void — is refused whoever asks.
--
-- THE ONE DELIBERATE EXEMPTION, stated plainly rather than left implicit:
-- service_role and supabase_auth_admin. `scripts/seed-staging.mjs` wipes
-- payments outright with the service key on every reseed (ADR-016 — a QA
-- payment recorded for a wipe-surviving admin would otherwise poison the
-- engine forever), and deleting an auth user cascades auth.users -> profiles ->
-- payments as supabase_auth_admin, which is how every probe and e2e fixture is
-- cleaned up. Both are server-side keys that can already drop this trigger, so
-- exempting them costs nothing: the layer exists to stop writes arriving
-- through a CLIENT role or an unaudited in-database path, and both of those
-- still hit it.
create function payments_append_only() returns trigger language plpgsql as $$
begin
  if current_user in ('service_role', 'supabase_auth_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'payments are append-only';
  end if;
  if old.voided_at is not null or new.voided_at is null then
    raise exception 'payments are append-only';
  end if;
  if (new.id, new.member_id, new.amount_gel, new.paid_at, new.bank_reference, new.source,
      new.recorded_by, new.created_at, new.tier_gel_at_payment)
     is distinct from
     (old.id, old.member_id, old.amount_gel, old.paid_at, old.bank_reference, old.source,
      old.recorded_by, old.created_at, old.tier_gel_at_payment) then
    raise exception 'payments are append-only';
  end if;
  return new;
end $$;

create trigger payments_no_rewrite before update or delete on payments
  for each row execute function payments_append_only();

-- The grant half of the same finding, and the treatment the Phase-5 community
-- tables already got (20260719150000_community.sql:126). SELECT is untouched:
-- members keep the column-scoped read of their own billing rows granted by
-- 20260718100000_admin_crm_hardening.sql:404. No client path has ever written
-- here — every insert goes through admin_record_payment(_bulk), definer.
revoke insert, update, delete, truncate on payments from anon, authenticated;
