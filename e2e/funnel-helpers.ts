import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FUNNEL_CODE_ALPHABET } from "../lib/funnel";

// Per-run isolation (spec §7): E2E_TEST_PHONE is CI-derived in the 55XXXXXXX block
// (run number + attempt) and ends in 9 — the login journey's digit. Journey phones
// replace the final digit. Personal IDs use the reserved 9-prefix (seed uses 1-prefix).
const LOGIN_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";
const BASE = LOGIN_PHONE.slice(0, 8);

// Progressive registration reworked the journeys. Single digits are scarce (0–9,
// with 9 reserved for login.spec's fixed phone, 8 left free), so the slots are
// explicit. cleanupJourneyUsers keys off these phones (mechanics unchanged); admin/
// community specs keep their separate phase4Phone range (no collision).
export const JOURNEY = {
  regHappy: 0, // registration.spec: happy path + duplicate-phone re-entry
  membFull: 1, // membership.spec: full upgrade
  regDupId: 2, // registration.spec: duplicate personal ID + retry
  membResume: 3, // membership.spec: wizard resume
  regReferral: 4, // registration.spec + membership.spec: referral capture → completion
  cabinet: 5, // cabinet.spec (ported setup)
  membRsvp: 6, // membership.spec: RSVP as registered
  spare: 7, // 8 also free
} as const;

export function journeyPhone(journey: number): string {
  return `${BASE}${journey}`; // 9 national digits, 55-prefixed
}

export function journeyPersonalId(journey: number): string {
  return `9${BASE.slice(1)}${journey}00`; // 11 digits, 9-prefixed
}

/** Service-role client for seeding + reading the dev OTP inbox (staging only). */
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("e2e seed/login needs staging service credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** 6-char default region+city for seeded members. ქვემო ქართლი has 4 cities —
 * cabinet.spec's profile-edit selects city index 2, so seeded members must sit in a
 * region that offers ≥3 cities. No spec asserts a seeded member's specific region. */
let cachedLocation: { regionId: number; cityId: number } | null = null;
async function defaultLocation(
  admin: SupabaseClient,
): Promise<{ regionId: number; cityId: number }> {
  if (cachedLocation) return cachedLocation;
  const { data: region, error: rErr } = await admin
    .from("regions")
    .select("id")
    .eq("name_ka", "ქვემო ქართლი")
    .single();
  if (rErr || !region) throw new Error(`seed: region lookup failed: ${rErr?.message}`);
  const { data: city, error: cErr } = await admin
    .from("cities")
    .select("id")
    .eq("region_id", region.id)
    .order("id")
    .limit(1)
    .single();
  if (cErr || !city) throw new Error(`seed: city lookup failed: ${cErr?.message}`);
  cachedLocation = { regionId: region.id as number, cityId: city.id as number };
  return cachedLocation;
}

/** Crockford-style code (no I/L/O/0/1) — matches gen_funnel_code / seeded GR- codes. */
function randomFunnelCode(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += FUNNEL_CODE_ALPHABET[Math.floor(Math.random() * FUNNEL_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Click „გაგრძელება →" on the filled /join form and wait for the dev-OTP to appear.
 * A phone that was OTP-verified moments ago (the duplicate-phone re-entry, or the same
 * journey slot reused by a sibling spec) hits Supabase's ~60s per-phone OTP cooldown:
 * submitForm's signInWithOtp errors, the page shows „კოდის გაგზავნა ვერ მოხერხდა…" and
 * stays on the form, so the dev-OTP never renders. Ride the window out and retry the
 * send — same idiom as loginAs. Fresh phones reveal the code on the first click (no wait).
 */
export async function submitJoinAndAwaitOtp(page: Page): Promise<void> {
  const devOtp = page.getByTestId("dev-otp");
  const sendError = page.getByText("კოდის გაგზავნა ვერ მოხერხდა");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "გაგრძელება →" }).click();
    await expect(devOtp.or(sendError)).toBeVisible({ timeout: 15_000 });
    if (await devOtp.isVisible()) return;
    if (attempt === 2) throw new Error("join OTP send throttled after 3 attempts");
    await page.waitForTimeout(62_000); // ride out Supabase's per-phone OTP window, then retry
  }
}

/**
 * Drive the one-door /join form (spec §4.1): the four light fields + dev-OTP, then
 * wait for /me. Same dev-otp/otp-0 mechanics as the retired step-one helper; the
 * account is fresh (not completed) so the dev-otp UI element renders. Callers land on
 * the /join page first (page.goto("/join")).
 */
export async function passRegistration(
  page: Page,
  opts: { phone: string; firstName: string; lastName: string; personalId: string },
): Promise<void> {
  await page.getByLabel("სახელი").fill(opts.firstName);
  await page.getByLabel("გვარი").fill(opts.lastName);
  await page.getByLabel("პირადი ნომერი").fill(opts.personalId);
  await page.getByLabel("ტელეფონის ნომერი").fill(opts.phone);
  await submitJoinAndAwaitOtp(page);
  const otp = (await page.getByTestId("dev-otp").locator("strong").innerText()).trim();
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/me(\/|\?|#|$)/, { timeout: 15_000 });
}

/**
 * Fill the become-a-member wizard's profile phase (spec §4.3) — the profile basics
 * minus personalId (now captured at registration). The wizard renders
 * region/city/employment as LabeledSelects; the delegate binding is separate and left
 * at its default (central) by this helper.
 */
export async function fillMembershipProfile(
  page: Page,
  opts: { regionLabel: string },
): Promise<void> {
  await page.getByLabel("დაბადების თარიღი").fill("1990-05-20");
  await page.getByLabel("მხარე").selectOption({ label: opts.regionLabel });
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption({ index: 1 });
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "სტუდენტი" });
}

/**
 * Service-role: create an auth user + a COMPLETE member profile (all wizard fields,
 * status profile_completed, registration_completed_at, tier, GR- reference code) plus
 * an open membership row (delegate_id null = central) — the new invariant: members
 * always hold a membership. `delegateId` binds the membership to a specific delegate
 * (referral supporters); `tier` defaults to 10. Guard: e2e phones only.
 */
export async function seedCompletedMember(opts: {
  phone: string;
  firstName: string;
  lastName: string;
  personalId: string;
  tier?: 5 | 10 | 20;
  delegateId?: string | null;
}): Promise<{ id: string }> {
  if (!opts.phone.startsWith("55")) {
    throw new Error(`refusing to seed non-e2e phone ${opts.phone}`);
  }
  const admin = adminClient();
  const authPhone = `+995${opts.phone}`;
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    phone: authPhone,
    phone_confirm: true,
  });
  if (userErr || !created?.user) {
    throw new Error(`seedCompletedMember createUser failed: ${userErr?.message}`);
  }
  const id = created.user.id;
  const { regionId, cityId } = await defaultLocation(admin);
  const { error: pErr } = await admin.from("profiles").insert({
    id,
    first_name: opts.firstName,
    last_name: opts.lastName,
    phone: authPhone,
    personal_id: opts.personalId,
    birth_date: "1990-05-20",
    region_id: regionId,
    city_id: cityId,
    employment: "სტუდენტი",
    status: "profile_completed",
    membership_tier: opts.tier ?? 10,
    reference_code: `GR-${randomFunnelCode(6)}`,
    registration_completed_at: new Date().toISOString(),
  });
  if (pErr) throw new Error(`seedCompletedMember profile insert failed: ${pErr.message}`);
  const { error: mErr } = await admin
    .from("memberships")
    .insert({ member_id: id, delegate_id: opts.delegateId ?? null });
  if (mErr) throw new Error(`seedCompletedMember membership insert failed: ${mErr.message}`);
  return { id };
}

/**
 * Service-role: a COMPLETED member (seedCompletedMember) turned into a PENDING
 * delegate — close the open membership (delegates hold none, Phase 3 invariant), then
 * insert the delegates row (pending, random referral code, tc_accepted now). Replaces
 * UI-driven delegate creation until R2's request flow exists. Pair with
 * approveOwnDelegate where the journey needs an approved delegate.
 */
export async function seedPendingDelegate(opts: {
  phone: string;
  firstName: string;
  lastName: string;
  personalId: string;
}): Promise<{ id: string }> {
  const { id } = await seedCompletedMember(opts); // e2e-phone guard runs inside
  const admin = adminClient();
  const { error: closeErr } = await admin
    .from("memberships")
    .update({ ended_at: new Date().toISOString() })
    .eq("member_id", id)
    .is("ended_at", null);
  if (closeErr) throw new Error(`seedPendingDelegate membership close failed: ${closeErr.message}`);
  const { error: dErr } = await admin.from("delegates").insert({
    id,
    status: "pending",
    referral_code: randomFunnelCode(6),
    tc_accepted_at: new Date().toISOString(),
  });
  if (dErr) throw new Error(`seedPendingDelegate delegate insert failed: ${dErr.message}`);
  return { id };
}

/**
 * Service-role: a REGISTERED-standing user — the light registration only
 * (name+phone+personal_id, status registered, NO membership; the new invariant is that
 * only members hold a membership). Used by login.spec's registered-standing case.
 */
export async function seedRegisteredMember(opts: {
  phone: string;
  firstName: string;
  lastName: string;
  personalId: string;
}): Promise<{ id: string }> {
  if (!opts.phone.startsWith("55")) {
    throw new Error(`refusing to seed non-e2e phone ${opts.phone}`);
  }
  const admin = adminClient();
  const authPhone = `+995${opts.phone}`;
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    phone: authPhone,
    phone_confirm: true,
  });
  if (userErr || !created?.user) {
    throw new Error(`seedRegisteredMember createUser failed: ${userErr?.message}`);
  }
  const id = created.user.id;
  const { error: pErr } = await admin.from("profiles").insert({
    id,
    first_name: opts.firstName,
    last_name: opts.lastName,
    phone: authPhone,
    personal_id: opts.personalId,
    status: "registered",
  });
  if (pErr) throw new Error(`seedRegisteredMember profile insert failed: ${pErr.message}`);
  return { id };
}

/**
 * /login flow that signs the BROWSER in as a seeded user (spec §7). Reads the code
 * straight from dev_otp_inbox via the service client — the /api/dev/otp UI element is
 * withheld for COMPLETED accounts, so this path works for members AND delegates AND
 * registered-standing users alike. The broad landing regex admits the registered
 * cabinet (/me), the member/delegate cabinets, and /admin.
 */
export async function loginAs(page: Page, phoneNational: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(phoneNational);
  // Repeated logins can hit Supabase's per-phone OTP throttle: signInWithOtp errors,
  // the page shows the send-failed notice and stays on the phone step, so the "SMS
  // კოდი" group never renders. Wait for EITHER outcome; on a throttled send, ride out
  // the per-phone window (~60s) and retry, up to 3 attempts.
  const otpGroup = page.getByRole("group", { name: "SMS კოდი" });
  const sendError = page.getByText("კოდის გაგზავნა ვერ მოხერხდა");
  let sentAt = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    sentAt = Date.now() - 2000; // 2s slack for test-machine vs DB clock skew
    await page.getByRole("button", { name: "კოდის მიღება" }).click();
    await expect(otpGroup.or(sendError)).toBeVisible({ timeout: 15_000 });
    if (await otpGroup.isVisible()) break;
    if (attempt === 2) throw new Error(`loginAs: OTP send throttled for ${phoneNational}`);
    await page.waitForTimeout(62_000); // ride out Supabase's per-phone OTP window, then retry
  }
  const db = adminClient();
  const forms = [`+995${phoneNational}`, `995${phoneNational}`];
  let otp: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", forms)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row && new Date(row.created_at as string).getTime() >= sentAt) {
      otp = row.otp as string;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!otp) throw new Error(`no fresh OTP in dev_otp_inbox for ${phoneNational}`);
  await page.getByTestId("otp-0").fill(otp); // OtpInput distributes the pasted digits
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/(me|delegate|admin)(\/|\?|#|$)/, { timeout: 15_000 });
}

export async function cleanupJourneyUsers(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("e2e cleanup skipped: staging service credentials not in env");
    return;
  }
  const admin = createClient(url, key);
  const phones = Object.values(JOURNEY).flatMap((j) => [
    `+995${journeyPhone(j)}`,
    `995${journeyPhone(j)}`,
  ]);
  const { data: rows } = await admin.from("profiles").select("id").in("phone", phones);
  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) return;
  // memberships.delegate_id has NO cascade: a row pointing at a journey DELEGATE
  // blocks deleteUser when iteration order deletes the delegate first. Detach
  // first — scoped strictly to this run's own users.
  const { error: detachErr } = await admin.from("memberships").delete().in("delegate_id", ids);
  if (detachErr) console.warn(`e2e cleanup: membership detach failed: ${detachErr.message}`);
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.warn(`e2e cleanup: deleteUser ${id} failed: ${error.message}`);
  }
}

export async function getSeededReferral(): Promise<{ code: string; fullName: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("referral journey needs staging service credentials");
  const admin = createClient(url, key);
  // PostgREST cannot embed delegates→profiles in one call here: delegates has TWO
  // FK paths to profiles (id→profiles.id AND verified_by→profiles.id), so
  // `.select("referral_code, profiles(...)")` is ambiguous (PGRST201) without an
  // explicit `!<fkey>` hint. Two queries instead of guessing the constraint name.
  const { data: delegate, error: delegateErr } = await admin
    .from("delegates")
    .select("id, referral_code")
    .eq("status", "approved")
    .order("id")
    .limit(1)
    .single();
  if (delegateErr || !delegate)
    throw new Error(`no approved seeded delegate found: ${delegateErr?.message}`);
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", delegate.id)
    .single();
  if (profileErr || !profile) throw new Error(`delegate profile not found: ${profileErr?.message}`);
  return {
    code: delegate.referral_code as string,
    fullName: `${profile.first_name} ${profile.last_name}`,
  };
}

export async function approveOwnDelegate(phoneNational: string): Promise<void> {
  if (!phoneNational.startsWith("55")) {
    throw new Error(`refusing to approve non-e2e phone ${phoneNational}`);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("approveOwnDelegate needs staging service credentials");
  const admin = createClient(url, key);
  const { data: rows, error: pErr } = await admin
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (pErr || !rows || rows.length !== 1) {
    throw new Error(`delegate profile lookup failed: ${pErr?.message ?? `rows=${rows?.length}`}`);
  }
  const { error } = await admin
    .from("delegates")
    .update({
      status: "approved",
      verified_at: new Date().toISOString(),
      slug: `e2e-delegate-${phoneNational}`,
    })
    .eq("id", rows[0]!.id);
  if (error) throw new Error(`approve failed: ${error.message}`);
}

export async function cleanupLoginUser(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("login cleanup skipped: staging service credentials not in env");
    return;
  }
  const admin = createClient(url, key);
  const loginPhone = `995${LOGIN_PHONE}`; // auth stores phones without '+'
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || data.users.length === 0) return;
    const orphan = data.users.find((u) => u.phone === loginPhone);
    if (orphan) {
      const { error: delErr } = await admin.auth.admin.deleteUser(orphan.id);
      if (delErr) console.warn(`login cleanup: deleteUser ${orphan.id} failed: ${delErr.message}`);
      return;
    }
    if (data.users.length < 1000) return;
  }
}
