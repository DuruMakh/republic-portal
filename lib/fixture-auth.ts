import { createHmac, randomUUID } from "node:crypto";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

/**
 * Fixture sign-in for TEST databases only, shared by the e2e suite and the preview test
 * sign-in (spec 2026-10-08 simpler dev structure 4.3). No React/Next imports: Playwright
 * loads it in plain Node. Callers own the environment gate (assertE2eFixtureEnvironment,
 * testSignInEnabled); this module owns which accounts may be signed in at all.
 */
export interface FixtureAuthConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export const FIXTURE_EMAIL_DOMAIN = "@example.invalid";

/** The owner's smoke accounts inside the 55 block (scripts/sweep-staging-e2e.mjs keeps them). */
export const OWNER_SMOKE_PHONES: ReadonlySet<string> = new Set([
  "551234567",
  "551234568",
  "551234569",
]);

/**
 * Phones e2e may sign in as: the per-run 55 block (journeys, phase-4 users) and the
 * four canonical admins scripts/seed-staging.mjs creates for e2e (50900000{1..4}).
 * Nobody else — in particular not the owner's real staging account, nor the three
 * smoke accounts scripts/sweep-staging-e2e.mjs keeps for the owner inside the 55 block.
 */
const E2E_FIXTURE_PHONE = /^(55\d{7}|50900000[1-4])$/;
/** Preview personas: the canonical admins and the seed's made-up people (phoneFor(i) = 500xxxxxx). */
const PERSONA_PHONE = /^(50900000[1-4]|500\d{6})$/;

export function isE2eFixturePhone(phoneNational: string): boolean {
  return E2E_FIXTURE_PHONE.test(phoneNational) && !OWNER_SMOKE_PHONES.has(phoneNational);
}

export function isPersonaPhone(phoneNational: string): boolean {
  return PERSONA_PHONE.test(phoneNational);
}

/**
 * Stable per phone (so overlapping CI runs agree on it and never reset each other's
 * password) and unguessable without the service-role key, which already grants
 * everything this password does.
 */
export function fixturePassword(phoneNational: string, serviceKey: string): string {
  const digest = createHmac("sha256", serviceKey)
    .update(`e2e-login:${phoneNational}`)
    .digest("hex")
    .slice(0, 32); // 128 bits; keeps the password well under GoTrue's 72-byte cap
  return `E2e-${digest}!Aa1`;
}

function serviceClient(config: FixtureAuthConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.serviceKey, {
    auth: { persistSession: false },
  });
}

function sessionlessClient(config: FixtureAuthConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

async function fixtureUserIdByPhone(
  db: SupabaseClient<Database>,
  phoneNational: string,
): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (error || !data || data.length !== 1) {
    throw new Error(
      `e2e sign-in: profile lookup for ${phoneNational} failed: ${error?.message ?? `rows=${data?.length}`}`,
    );
  }
  return data[0]!.id;
}

/**
 * A seeded fixture account's session, by email + password — no SMS.
 *
 * Phone-OTP sign-in spent staging's shared hourly SMS budget, so overlapping CI runs
 * ran it dry and every sign-in failed. The first sign-in gives the account a
 * placeholder email and a derived password; later ones just use them. The password is
 * never re-set once it works: changing it would end the sessions of a concurrent run
 * signed in as the same canonical admin. Phone sign-in stays as it was.
 */
export async function fixtureSessionFor(
  config: FixtureAuthConfig,
  phoneNational: string,
  isAllowed: (phoneNational: string) => boolean = isE2eFixturePhone,
): Promise<Session> {
  if (!isAllowed(phoneNational)) {
    throw new Error(`refusing to sign in ${phoneNational}: not an e2e fixture phone`);
  }
  const admin = serviceClient(config);
  const id = await fixtureUserIdByPhone(admin, phoneNational);
  const { data: found, error: userError } = await admin.auth.admin.getUserById(id);
  if (userError || !found.user) {
    throw new Error(`e2e sign-in: auth user for ${phoneNational} not found`);
  }
  const existingEmail = found.user.email;
  if (existingEmail && !existingEmail.endsWith(FIXTURE_EMAIL_DOMAIN)) {
    throw new Error(`refusing to sign in ${phoneNational}: the account has a real email address`);
  }
  // Own namespace: Google fixtures use e2e+<slot>, and their cleanup deletes by address.
  const email = existingEmail || `e2e-login+${phoneNational}${FIXTURE_EMAIL_DOMAIN}`;
  const password = fixturePassword(phoneNational, config.serviceKey);
  const auth = sessionlessClient(config);

  if (existingEmail) {
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (data.session) return data.session;
    if (error?.code !== "invalid_credentials") {
      throw new Error(`e2e could not sign ${phoneNational} in: ${error?.message ?? "no session"}`);
    }
  }
  const { error: setError } = await admin.auth.admin.updateUserById(id, {
    email,
    password,
    email_confirm: true,
  });
  if (setError) {
    throw new Error(`e2e could not set ${phoneNational}'s sign-in: ${setError.message}`);
  }
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`e2e could not sign ${phoneNational} in: ${error?.message ?? "no session"}`);
  }
  return data.session;
}

/**
 * A brand-new made-up visitor (spec 4.3): Google-provided the same way the e2e Google
 * fixtures are, because registration requires a Google provider assertion. Test databases
 * only; the next reseed removes these accounts.
 */
export async function freshVisitorSession(config: FixtureAuthConfig): Promise<Session> {
  const id = randomUUID();
  const email = `preview-visitor+${id}${FIXTURE_EMAIL_DOMAIN}`;
  const password = fixturePassword(`visitor:${id}`, config.serviceKey);
  const { error: createError } = await serviceClient(config).auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { provider: "google", providers: ["google"], preview_visitor: true },
  });
  if (createError) throw new Error(`preview visitor could not be created: ${createError.message}`);
  const { data, error } = await sessionlessClient(config).auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) throw new Error("preview visitor could not sign in");
  return data.session;
}

const ADMIN_PERSONA_PHONE = "509000001"; // canonical super_admin (scripts/seed-staging.mjs)
const DELEGATE_PERSONA_SLUG = "giorgi-maisuradze"; // first roster entry, always approved

function national(phone: string): string {
  return phone.replace(/^\+?995/, "");
}

/** The seed account behind each signed-in persona. Throws when the seed is missing. */
export async function resolvePersonaPhone(
  config: FixtureAuthConfig,
  persona: "admin" | "delegate" | "member",
): Promise<string> {
  if (persona === "admin") return ADMIN_PERSONA_PHONE;
  const db = serviceClient(config);
  const { data: delegates, error: delegateError } = await db
    .from("delegates")
    .select("id, slug, status");
  if (delegateError || !delegates) throw new Error("persona lookup: delegates unavailable");

  if (persona === "delegate") {
    const delegate = delegates.find(
      (d) => d.slug === DELEGATE_PERSONA_SLUG && d.status === "approved",
    );
    if (!delegate) throw new Error("persona lookup: seed delegate missing");
    const { data, error } = await db
      .from("profiles")
      .select("phone")
      .eq("id", delegate.id)
      .single();
    if (error || !data?.phone) throw new Error("persona lookup: seed delegate has no phone");
    return national(data.phone);
  }

  const delegateIds = new Set(delegates.map((d) => d.id));
  const { data: members, error } = await db
    .from("profiles")
    .select("id, phone")
    .eq("status", "active_member")
    .like("phone", "+995500%")
    .order("phone")
    .limit(50);
  if (error || !members) throw new Error("persona lookup: members unavailable");
  const member = members.find((m) => !delegateIds.has(m.id) && m.phone);
  if (!member?.phone) throw new Error("persona lookup: no active seed member");
  return national(member.phone);
}
