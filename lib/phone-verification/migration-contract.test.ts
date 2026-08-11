import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve("supabase/migrations");

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
    expect(sql).toContain("record_phone_verification_failure");
    expect(sql).toContain("consume_phone_verification_challenge");

    expect(sql).toContain(
      "revoke execute on function public.record_phone_verification_failure(uuid, uuid) from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.record_phone_verification_failure(uuid, uuid) to service_role",
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
  });
});
