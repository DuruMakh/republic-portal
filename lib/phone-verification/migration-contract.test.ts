import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve("supabase/migrations");
const productionSchemaCheckPath = resolve("scripts/production-db-schema-check.sql");

describe("Google phone-verification migration contract", () => {
  it("seals the challenge ledger and exposes only the intended RPCs", () => {
    const matchingMigrations = readdirSync(migrationsDirectory).filter((name) =>
      name.endsWith("_google_verify_phone.sql"),
    );

    expect(matchingMigrations).toHaveLength(1);

    const sql = readFileSync(join(migrationsDirectory, matchingMigrations[0] ?? ""), "utf8");

    expect(sql).toContain("create table public.phone_verification_challenges");
    expect(sql).toContain(
      "alter table public.phone_verification_challenges enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.phone_verification_challenges from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant select, insert, update, delete on public.phone_verification_challenges to service_role",
    );
    expect(sql).toContain("create table public.phone_verification_send_reservations");
    expect(sql).toContain(
      "alter table public.phone_verification_send_reservations enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.phone_verification_send_reservations from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant select, insert, update, delete on public.phone_verification_send_reservations to service_role",
    );
    expect(sql).toContain("phone ~ '^\\+9955[0-9]{8}$'");
    expect(sql).toContain("purpose = 'registration'");
    expect(sql).toContain("provider in ('verify_ge', 'test')");
    expect(sql).toContain("verify_attempts between 0 and 5");
    expect(sql).toContain("unique (provider, provider_request_id)");
    expect(sql).toContain("check (expires_at > created_at)");
    expect(sql).toContain("create index phone_verification_by_user_created");
    expect(sql).toContain("(user_id, created_at desc)");
    expect(sql).toContain("create index phone_verification_by_phone_created");
    expect(sql).toContain("(phone, created_at desc)");
    expect(sql).not.toMatch(/create\s+policy[\s\S]*phone_verification_challenges/i);

    expect(sql).toContain("raw_app_meta_data -> 'providers' ? 'google'");
    expect(sql).toContain("phone_confirmed_at");
    expect(sql).toContain("create or replace function public.register_google");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("phone_verification_challenges");
    expect(sql).toContain("reserve_phone_verification_send");
    expect(sql).toContain("complete_phone_verification_send");
    expect(sql).toContain("reserve_phone_verification_attempt");
    expect(sql).toContain("consume_phone_verification_challenge");
    expect(sql).not.toContain("record_phone_verification_failure");

    const userLock = "pg_catalog.pg_advisory_xact_lock(8611, pg_catalog.hashtext(p_user_id::text))";
    const phoneLock = "pg_catalog.pg_advisory_xact_lock(8612, pg_catalog.hashtext(p_phone))";
    expect(sql).toContain(userLock);
    expect(sql).toContain(phoneLock);
    expect(sql.indexOf(userLock)).toBeLessThan(sql.indexOf(phoneLock));
    const completionSection = sql.slice(
      sql.indexOf("create or replace function public.complete_phone_verification_send"),
      sql.indexOf("revoke execute on function public.complete_phone_verification_send"),
    );
    const completionUserLock =
      "pg_catalog.pg_advisory_xact_lock(8611, pg_catalog.hashtext(p_user_id::text))";
    const completionPhoneLock =
      "pg_catalog.pg_advisory_xact_lock(8612, pg_catalog.hashtext(v_phone))";
    expect(completionSection.indexOf(completionUserLock)).toBeGreaterThanOrEqual(0);
    expect(completionSection.indexOf(completionUserLock)).toBeLessThan(
      completionSection.indexOf(completionPhoneLock),
    );
    expect(sql).toContain("created_at >= v_now - interval '60 seconds'");
    expect(sql).toContain("created_at >= v_now - interval '1 hour'");
    expect(sql).toContain("created_at < v_now - interval '24 hours'");
    expect(sql).toContain("verify_attempts = verify_attempts + 1");
    expect(sql).toContain("verify_attempts < 5");
    expect(sql).toContain("for update");
    expect(completionSection).toContain("id <> v_challenge_id");
    expect(completionSection).toContain("user_id = p_user_id or phone = v_phone");
    for (const functionName of [
      "reserve_phone_verification_send",
      "complete_phone_verification_send",
      "reserve_phone_verification_attempt",
      "consume_phone_verification_challenge",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `function public\\.${functionName}\\([\\s\\S]*?security invoker set search_path = ''`,
        ),
      );
    }

    expect(sql).toContain(
      "revoke execute on function public.reserve_phone_verification_send(uuid, text, text) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.reserve_phone_verification_send(uuid, text, text) to service_role",
    );
    expect(sql).toContain(
      "revoke execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.complete_phone_verification_send(uuid, uuid, text, text, timestamptz) to service_role",
    );
    expect(sql).toContain(
      "revoke execute on function public.reserve_phone_verification_attempt(uuid, uuid) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.reserve_phone_verification_attempt(uuid, uuid) to service_role",
    );
    expect(sql).toContain(
      "revoke execute on function public.consume_phone_verification_challenge(uuid, uuid) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.consume_phone_verification_challenge(uuid, uuid) to service_role",
    );
    expect(sql).toContain(
      "revoke execute on function public.register_google(text, text, text) from public, anon",
    );
    expect(sql).toContain(
      "grant execute on function public.register_google(text, text, text) to authenticated",
    );

    const productionCheck = readFileSync(productionSchemaCheckPath, "utf8");
    expect(productionCheck).toContain("public.phone_verification_send_reservations");
    expect(productionCheck).toContain("public.reserve_phone_verification_send(uuid,text,text)");
    expect(productionCheck).toContain(
      "public.complete_phone_verification_send(uuid,uuid,text,text,timestamp with time zone)",
    );
    expect(productionCheck).toContain("public.reserve_phone_verification_attempt(uuid,uuid)");
  });
});
