import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { assertE2eFixtureEnvironment } from "./cleanup-helpers";

const APP_BASE_URL = "http://localhost:3000";

function publicSupabaseConfig(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("e2e needs public Supabase URL and anon key");
  return { url, key };
}

/** Install a real @supabase/ssr cookie session without exposing either token. */
export async function installSupabaseSession(
  page: Page,
  session: Pick<Session, "access_token" | "refresh_token">,
): Promise<void> {
  assertE2eFixtureEnvironment();
  const { url, key } = publicSupabaseConfig();
  const serialized = new Map<string, string>();
  const setAll: SetAllCookies = (cookiesToSet) => {
    for (const cookie of cookiesToSet) serialized.set(cookie.name, cookie.value);
  };
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => [...serialized].map(([name, value]) => ({ name, value })),
      setAll,
    },
  });

  const { error } = await supabase.auth.setSession(session);
  if (error) throw new Error("e2e could not install the Supabase session");
  await page.context().addCookies(
    [...serialized].map(([name, value]) => ({
      name,
      value,
      url: APP_BASE_URL,
    })),
  );
}

/** THE service-role client for e2e seeding and fixture sign-in (staging only). */
export function serviceClient(): SupabaseClient {
  const { url, key } = serviceConfig();
  return createClient(url, key, { auth: { persistSession: false } });
}

function serviceConfig(): { url: string; key: string } {
  assertE2eFixtureEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("e2e needs staging service credentials");
  return { url, key };
}

function sessionlessClient(): SupabaseClient {
  const { url, key } = publicSupabaseConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

/**
 * Phones e2e may sign in as: the per-run 55 block (journeys, phase-4 users) and the
 * four canonical admins scripts/seed-staging.mjs creates for e2e (50900000{1..4}).
 * Nobody else — in particular not the owner's real staging account, nor the three
 * smoke accounts scripts/sweep-staging-e2e.mjs keeps for the owner inside the 55 block.
 */
const FIXTURE_LOGIN_PHONE = /^(55\d{7}|50900000[1-4])$/;
const OWNER_SMOKE_PHONES = new Set(["551234567", "551234568", "551234569"]);
const FIXTURE_EMAIL_DOMAIN = "@example.invalid";

/**
 * Stable per phone (so overlapping CI runs agree on it and never reset each other's
 * password) and unguessable without the service-role key, which already grants
 * everything this password does.
 */
function fixturePassword(phoneNational: string, serviceKey: string): string {
  const digest = createHmac("sha256", serviceKey)
    .update(`e2e-login:${phoneNational}`)
    .digest("hex")
    .slice(0, 32); // 128 bits; keeps the password well under GoTrue's 72-byte cap
  return `E2e-${digest}!Aa1`;
}

async function fixtureUserIdByPhone(db: SupabaseClient, phoneNational: string): Promise<string> {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .in("phone", [`+995${phoneNational}`, `995${phoneNational}`]);
  if (error || !data || data.length !== 1) {
    throw new Error(
      `e2e sign-in: profile lookup for ${phoneNational} failed: ${error?.message ?? `rows=${data?.length}`}`,
    );
  }
  return data[0]!.id as string;
}

/**
 * A seeded fixture account's staging session, by email + password — no SMS.
 *
 * Phone-OTP sign-in spent staging's shared hourly SMS budget, so overlapping CI runs
 * ran it dry and every sign-in failed. The first sign-in gives the account a
 * placeholder email and a derived password; later ones just use them. The password is
 * never re-set once it works: changing it would end the sessions of a concurrent run
 * signed in as the same canonical admin. Phone sign-in stays as it was.
 */
export async function fixtureSession(phoneNational: string): Promise<Session> {
  assertE2eFixtureEnvironment();
  if (!FIXTURE_LOGIN_PHONE.test(phoneNational) || OWNER_SMOKE_PHONES.has(phoneNational)) {
    throw new Error(`refusing to sign in ${phoneNational}: not an e2e fixture phone`);
  }
  const admin = serviceClient();
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
  const password = fixturePassword(phoneNational, serviceConfig().key);
  const auth = sessionlessClient();

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

/** A Supabase client acting as the signed-in account, for calling its RPCs directly. */
export async function clientFor(session: Session): Promise<SupabaseClient> {
  assertE2eFixtureEnvironment();
  const client = sessionlessClient();
  const { error } = await client.auth.setSession(session);
  if (error) throw new Error("e2e could not start a client session");
  return client;
}

/**
 * Programmatic seeded-account login: a fixture session (fixtureSession), installed as
 * the browser's cookie session, then the cabinet. No SMS and no login UI involved.
 */
export async function loginAs(
  page: Page,
  phoneNational: string,
  landing: RegExp = /\/(me|delegate|admin)(\/|\?|#|$)/,
): Promise<void> {
  await installSupabaseSession(page, await fixtureSession(phoneNational));
  await page.goto("/me");
  await expect(page).toHaveURL(landing, { timeout: 15_000 });
}
