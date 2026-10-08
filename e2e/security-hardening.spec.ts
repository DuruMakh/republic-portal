import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanupUsersByPhone, runCleanups } from "./cleanup-helpers";
import {
  approveOwnDelegate,
  JOURNEY,
  journeyPersonalId,
  journeyPhone,
  seedPendingDelegate,
} from "./funnel-helpers";
import { clientFor, fixtureSession, serviceClient } from "./otp-helpers";

/**
 * Security audit 2026-10-08 — the database rules of the hardening release, exercised as a
 * signed-in client against staging (migrations 20261008160000..160200). No SMS: accounts
 * are seeded through the service client and signed in by password (ADR-043).
 */

const proberPhone = journeyPhone(JOURNEY.secProber);
const delegatePhone = journeyPhone(JOURNEY.secDelegate);
const heldPersonalId = journeyPersonalId(JOURNEY.secDelegate);
const ourPhones = [proberPhone, delegatePhone].flatMap((p) => [`+995${p}`, `995${p}`]);

async function cleanup(): Promise<void> {
  await cleanupUsersByPhone("security-hardening e2e cleanup", ourPhones);
}

/** A registered account WITHOUT a personal ID yet, so the membership step checks the ID. */
async function seedProber(): Promise<string> {
  const admin = serviceClient();
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    phone: `+995${proberPhone}`,
    phone_confirm: true,
  });
  if (userErr || !created.user) throw new Error(`prober createUser failed: ${userErr?.message}`);
  const { error } = await admin.from("profiles").insert({
    id: created.user.id,
    first_name: "ვატესტ",
    last_name: "უსაფრთხოებას",
    phone: `+995${proberPhone}`,
    status: "registered",
  });
  if (error) throw new Error(`prober profile insert failed: ${error.message}`);
  return created.user.id;
}

async function anyCity(): Promise<{ regionId: number; cityId: number }> {
  const { data, error } = await serviceClient()
    .from("cities")
    .select("id, region_id")
    .order("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error(`city lookup failed: ${error?.message}`);
  return { regionId: data.region_id as number, cityId: data.id as number };
}

test.describe.configure({ mode: "serial" });
test.beforeAll(() => runCleanups([cleanup]));
test.afterAll(() => runCleanups([cleanup]));

test("hardening rules hold for signed-in clients", async () => {
  await seedPendingDelegate({
    phone: delegatePhone,
    firstName: "ვატესტ",
    lastName: "დელეგატს",
    personalId: heldPersonalId,
  });
  await approveOwnDelegate(delegatePhone);
  const proberId = await seedProber();
  const prober = await clientFor(await fixtureSession(proberPhone));
  const { regionId, cityId } = await anyCity();
  const save = (personalId: string, delegateId: string | null = null) =>
    prober.rpc("become_member_save_profile", {
      p_birth_date: "1990-05-20",
      p_region_id: regionId,
      p_city_id: cityId,
      p_employment: "სტუდენტი",
      p_delegate_id: delegateId,
      p_personal_id: personalId,
    });

  // C1: the legacy register() is no longer reachable by a signed-in client
  const legacy = await prober.rpc("register", { p_first_name: "ა", p_last_name: "ბ" });
  expect(legacy.error?.code).toBe("42501");

  // H1 (d): a read-only (GET) call answers the same for a taken and a free ID, and records
  // nothing — PostgREST runs GET RPCs read-only, which once made an untraced probe
  const readOnly = (personalId: string) =>
    prober.rpc(
      "become_member_save_profile",
      {
        p_birth_date: "1990-05-20",
        p_region_id: regionId,
        p_city_id: cityId,
        p_employment: "სტუდენტი",
        p_delegate_id: null,
        p_personal_id: personalId,
      },
      { get: true },
    );
  const takenGet = await readOnly(heldPersonalId);
  const freeGet = await readOnly("90000000000");
  expect(takenGet.error).not.toBeNull();
  expect(freeGet.error?.message).toBe(takenGet.error?.message);

  // H1 (a): a made-up delegate is refused BEFORE the personal ID is looked at, and nothing
  // is saved — so it can no longer be used to probe IDs for free
  const bogus = await save(heldPersonalId, randomUUID());
  expect(bogus.error?.message).toContain("invalid_delegate");

  // H1 (b)+(c): a conflict is returned and recorded; the fourth try is refused outright
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const conflict = await save(heldPersonalId);
    expect(conflict.error).toBeNull();
    expect(conflict.data).toEqual({ error: "duplicate_personal_id" });
  }
  const capped = await save(heldPersonalId);
  expect(capped.error?.message).toContain("personal_id_attempts_exceeded");

  const admin = serviceClient();
  const { count, error: auditErr } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "member.personal_id_conflict")
    .eq("target_id", proberId);
  expect(auditErr).toBeNull();
  expect(count).toBe(3);
  const { data: proberRow } = await admin
    .from("profiles")
    .select("personal_id, birth_date")
    .eq("id", proberId)
    .single();
  expect(proberRow).toEqual({ personal_id: null, birth_date: null });

  // M2: an approved delegate cannot rename themselves, but other profile edits still work
  const delegate = await clientFor(await fixtureSession(delegatePhone));
  const { data: delegateRow } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", `+995${delegatePhone}`)
    .single();
  const delegateId = delegateRow!.id as string;
  const rename = await delegate
    .from("profiles")
    .update({ first_name: "სხვა" })
    .eq("id", delegateId);
  expect(rename.error?.message).toContain("name_locked");
  const otherEdit = await delegate
    .from("profiles")
    .update({ employment: "მასწავლებელი" })
    .eq("id", delegateId);
  expect(otherEdit.error).toBeNull();
});
