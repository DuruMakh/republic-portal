import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { fixtureSessionFor } from "../lib/fixture-auth";
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
 * A seeded fixture account's session, by email + password — no SMS. The sign-in itself,
 * and the list of phones e2e may sign in as, live in lib/fixture-auth.ts (shared with the
 * preview test sign-in); this wrapper adds the e2e environment gate.
 */
export async function fixtureSession(phoneNational: string): Promise<Session> {
  assertE2eFixtureEnvironment();
  const { url, key: anonKey } = publicSupabaseConfig();
  const { key: serviceKey } = serviceConfig();
  return fixtureSessionFor({ url, anonKey, serviceKey }, phoneNational);
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
