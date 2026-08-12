import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FUNNEL_CODE_ALPHABET, MEMBERSHIP_FEE_GEL } from "../lib/funnel";
import {
  assertE2ePhones,
  assertE2eFixtureEnvironment,
  cleanupClient,
  cleanupUsersByPhone,
  failIfAny,
  SWEEP_HINT,
} from "./cleanup-helpers";
import { installSupabaseSession, loginAs, serviceClient } from "./otp-helpers";

// Per-run isolation (spec §7): E2E_TEST_PHONE is CI-derived in the 55XXXXXXX block
// (run number + attempt) and ends in 9 — the login journey's digit. Journey phones
// replace the final digit. Personal IDs use the reserved 9-prefix (seed uses 1-prefix).
// Exported so tests derive the expected phone from here rather than re-hardcoding
// the fallback — this is read at module load, so vi.stubEnv can never reach it.
export const LOGIN_PHONE = process.env.E2E_TEST_PHONE ?? "550009999";
const BASE = LOGIN_PHONE.slice(0, 8);

// Progressive registration reworked the journeys. Single digits are scarce (0–9,
// with 9 reserved for login.spec's fixed phone), so the slots are explicit.
// cleanupJourneyUsers keys off these phones (mechanics unchanged); admin/
// community specs keep their separate phase4Phone range (no collision).
export const JOURNEY = {
  regHappy: 0, // registration.spec: happy path + duplicate-phone re-entry
  membFull: 1, // membership.spec: full upgrade
  // review fix (owner fix #10 wave 1): the duplicate-ID check moved from /join to
  // the wizard, so this slot no longer seeds a REGISTRANT attempting a dup'd ID —
  // it now seeds the already-completed MEMBER whose ID the fresh registrant
  // (membDupId, below) collides with.
  regDupId: 2, // membership.spec: seeded member holding an already-taken personal ID
  membResume: 3, // membership.spec: wizard resume
  regReferral: 4, // registration.spec + membership.spec: referral capture → completion
  cabinet: 5, // cabinet.spec (ported setup)
  membRsvp: 6, // membership.spec: RSVP as registered
  spare: 7, // delegate-panel.spec: VIA_LINK_MEMBER
  membDupId: 8, // membership.spec: fresh registrant colliding with regDupId's seeded ID
} as const;

export function journeyPhone(journey: number): string {
  return `${BASE}${journey}`; // 9 national digits, 55-prefixed
}

export function journeyPersonalId(journey: number): string {
  return `9${BASE.slice(1)}${journey}00`; // 11 digits, 9-prefixed
}

const GOOGLE_FIXTURE_SLOT = /^55\d{7}$/;

function googleFixtureEmail(phoneSlot: string): string {
  if (!GOOGLE_FIXTURE_SLOT.test(phoneSlot)) {
    throw new Error(`refusing Google fixture slot outside the 55 e2e block: ${phoneSlot}`);
  }
  return `e2e+${phoneSlot}@example.invalid`;
}

export async function createGoogleBackedTestUser(
  page: Page,
  phoneSlot: string,
): Promise<{ id: string }> {
  assertE2eFixtureEnvironment();
  const email = googleFixtureEmail(phoneSlot);
  const password = `E2e-${randomBytes(24).toString("hex")}!Aa1`;
  const admin = serviceClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: "google", providers: ["google"], e2e: true },
  });
  if (createError || !created.user) {
    throw new Error(`createGoogleBackedTestUser failed: ${createError?.message ?? "no user"}`);
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Google e2e fixture needs public Supabase credentials");
    const anon = createClient(url, key, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error("Google e2e fixture sign-in failed");
    await installSupabaseSession(page, data.session);
    return { id: created.user.id };
  } catch (error) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
    if (cleanupError) {
      throw new Error(`Google e2e fixture setup and cleanup failed: ${cleanupError.message}`);
    }
    throw error;
  }
}

export async function cleanupGoogleBackedTestUsers(phoneSlots: readonly string[]): Promise<void> {
  assertE2eFixtureEnvironment();
  const label = "Google-backed e2e cleanup";
  const emails = new Set(phoneSlots.map(googleFixtureEmail));
  const admin = cleanupClient(label);
  if (!admin) return;
  const failures: string[] = [];
  const ids: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      failures.push(`listUsers page ${page} failed: ${error.message}`);
      break;
    }
    ids.push(
      ...data.users.filter((user) => user.email && emails.has(user.email)).map((user) => user.id),
    );
    if (data.users.length < 1000) break;
  }
  if (ids.length > 0) {
    const { error } = await admin.from("memberships").delete().in("delegate_id", ids);
    if (error) failures.push(`membership detach failed: ${error.message}`);
  }
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failures.push(`deleteUser ${id} failed: ${error.message}`);
  }
  failIfAny(label, failures, SWEEP_HINT);
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
 * Create and sign in a synthetic Google identity, then drive the visible registration
 * form with the deterministic provider code. No Google website or paid SMS is used.
 */
export async function passRegistration(
  page: Page,
  opts: { phone: string; firstName: string; lastName: string; refCode?: string },
): Promise<void> {
  assertE2eFixtureEnvironment();
  if (process.env.PHONE_VERIFICATION_PROVIDER !== "test") {
    throw new Error("registration e2e requires PHONE_VERIFICATION_PROVIDER=test");
  }
  await createGoogleBackedTestUser(page, opts.phone);
  await page.goto(opts.refCode ? `/join?ref=${encodeURIComponent(opts.refCode)}` : "/join");
  await page.getByLabel("სახელი").fill(opts.firstName);
  await page.getByLabel("გვარი").fill(opts.lastName);
  await page.getByLabel("ტელეფონის ნომერი").fill(opts.phone);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  await expect(page.getByTestId("otp-0")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("otp-0").fill("123456");
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/me(\/|\?|#|$)/, { timeout: 15_000 });
}

/** region name_ka → a city that genuinely belongs to it. Ordered by name_ka, matching
 * the wizard's own `.order("name_ka")`, so this is the city the old positional
 * `{ index: 1 }` picked whenever it picked correctly. Cached per run. */
const cityByRegion = new Map<string, { id: number; nameKa: string }>();
async function firstCityOfRegion(regionLabel: string): Promise<{ id: number; nameKa: string }> {
  const cached = cityByRegion.get(regionLabel);
  if (cached) return cached;
  const admin = serviceClient();
  const { data: region, error: rErr } = await admin
    .from("regions")
    .select("id")
    .eq("name_ka", regionLabel)
    .single();
  if (rErr || !region)
    throw new Error(`e2e: region "${regionLabel}" lookup failed: ${rErr?.message}`);
  const { data: city, error: cErr } = await admin
    .from("cities")
    .select("id, name_ka")
    .eq("region_id", region.id)
    .order("name_ka")
    .limit(1)
    .single();
  if (cErr || !city) throw new Error(`e2e: no city in region "${regionLabel}": ${cErr?.message}`);
  const found = { id: city.id as number, nameKa: city.name_ka as string };
  cityByRegion.set(regionLabel, found);
  return found;
}

/**
 * Fill the become-a-member wizard's profile phase (spec §4.3) — the profile basics,
 * plus the personal ID (owner fix #10: captured HERE now, not at registration). The
 * wizard renders region/city/employment as design-system SelectFields; the delegate
 * binding is separate and left at its default (central) by this helper.
 *
 * `personalId` is optional and, when given, is filled FIRST — the ID field renders at
 * the top of the field stack, and only when the profile doesn't already have one.
 * Journeys that registered through the NEW /join (no ID yet) MUST pass it; journeys
 * resuming a service-seeded profile that already carries personal_id MUST NOT (the
 * field doesn't render there — a fill would time out).
 *
 * The city is selected by its own id, never positionally. changeRegion() clears cityId
 * but the new region's <option>s only arrive after the Supabase round trip in the
 * wizard's [regionId] effect; until then the select still holds the PREVIOUS region's
 * options. A positional `{ index: 1 }` matches that stale list immediately and picks a
 * foreign city, so the save trips the composite FK profiles_city_in_region
 * (20260713143120) and the wizard never advances to the tier phase. Passing the id
 * makes Playwright retry until THIS region's options render — and ids are globally
 * unique, so a stale list can never satisfy the match (a by-label match could: city
 * names repeat across regions).
 */
export async function fillMembershipProfile(
  page: Page,
  opts: { regionLabel: string; personalId?: string },
): Promise<void> {
  assertE2eFixtureEnvironment();
  const city = await firstCityOfRegion(opts.regionLabel);
  if (opts.personalId) {
    await page.getByLabel("პირადი ნომერი").fill(opts.personalId);
  }
  await page.getByLabel("დაბადების თარიღი").fill("1990-05-20");
  await page.getByLabel("მხარე").selectOption({ label: opts.regionLabel });
  await page.getByLabel("ქალაქი / მუნიციპალიტეტი").selectOption(String(city.id));
  await page.getByLabel("სამუშაო ადგილი / სტატუსი").selectOption({ label: "სტუდენტი" });
}

/**
 * Service-role: create an auth user + a COMPLETE member profile (all wizard fields,
 * status profile_completed, registration_completed_at, tier, GR- reference code) plus
 * an open membership row (delegate_id null = central) — the new invariant: members
 * always hold a membership. `delegateId` binds the membership to a specific delegate
 * (referral supporters). Tier is always the fixed fee (owner fix #9) — the DB no
 * longer accepts anything else. Guard: e2e phones only.
 */
export async function seedCompletedMember(opts: {
  phone: string;
  firstName: string;
  lastName: string;
  personalId: string;
  delegateId?: string | null;
}): Promise<{ id: string }> {
  assertE2eFixtureEnvironment();
  if (!opts.phone.startsWith("55")) {
    throw new Error(`refusing to seed non-e2e phone ${opts.phone}`);
  }
  const admin = serviceClient();
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
    membership_tier: MEMBERSHIP_FEE_GEL,
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
  assertE2eFixtureEnvironment();
  const { id } = await seedCompletedMember(opts); // e2e-phone guard runs inside
  const admin = serviceClient();
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
  userId: string;
  phone: string;
  firstName: string;
  lastName: string;
  personalId: string;
}): Promise<{ id: string }> {
  assertE2eFixtureEnvironment();
  if (!opts.phone.startsWith("55")) {
    throw new Error(`refusing to seed non-e2e phone ${opts.phone}`);
  }
  const admin = serviceClient();
  const authPhone = `+995${opts.phone}`;
  const { error: pErr } = await admin.from("profiles").insert({
    id: opts.userId,
    first_name: opts.firstName,
    last_name: opts.lastName,
    phone: authPhone,
    personal_id: opts.personalId,
    status: "registered",
  });
  if (pErr) throw new Error(`seedRegisteredMember profile insert failed: ${pErr.message}`);
  return { id: opts.userId };
}

/**
 * /login flow that signs the BROWSER in as a seeded user (spec §7). Reads the code
 * straight from dev_otp_inbox via the service client — the /api/dev/otp UI element is
 * withheld for ANY existing profile (R1 hardening), so this path works for members AND
 * delegates AND registered-standing users alike. The broad landing regex admits the
 * registered cabinet (/me), the member/delegate cabinets, and /admin.
 */
export { loginAs }; // spec imports stay untouched

export async function cleanupJourneyUsers(): Promise<void> {
  assertE2eFixtureEnvironment();
  const phones = Object.values(JOURNEY).flatMap((j) => [
    `+995${journeyPhone(j)}`,
    `995${journeyPhone(j)}`,
  ]);
  await cleanupUsersByPhone("journey e2e cleanup", phones);
}

export async function getSeededReferral(): Promise<{ code: string; fullName: string }> {
  assertE2eFixtureEnvironment();
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
  assertE2eFixtureEnvironment();
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
  assertE2eFixtureEnvironment();
  const LABEL = "login e2e cleanup";
  const loginPhone = `995${LOGIN_PHONE}`; // auth stores phones without '+'
  // Scans auth rather than profiles, but the phone still comes from the
  // unvalidated E2E_TEST_PHONE — same guard as the profiles-based deletions.
  assertE2ePhones(LABEL, [loginPhone]);
  const admin = cleanupClient(LABEL);
  if (!admin) return;
  const failures: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    // A listing error used to return early, making a broken lookup indistinguishable
    // from "no orphan here" — success reported for a cleanup that did nothing.
    if (error) {
      failures.push(`listUsers page ${page} failed: ${error.message}`);
      break;
    }
    if (data.users.length === 0) break;
    const orphan = data.users.find((u) => u.phone === loginPhone);
    if (orphan) {
      const { error: delErr } = await admin.auth.admin.deleteUser(orphan.id);
      if (delErr) failures.push(`deleteUser ${orphan.id} failed: ${delErr.message}`);
      break;
    }
    if (data.users.length < 1000) break;
  }
  failIfAny(LABEL, failures, SWEEP_HINT);
}
