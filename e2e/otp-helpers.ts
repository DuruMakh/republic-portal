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

/** THE service-role client for e2e seeding + dev-OTP inbox reads (staging only). */
export function serviceClient(): SupabaseClient {
  assertE2eFixtureEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("e2e needs staging service credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** THE dev_otp_inbox poll: newest row for the phone, no older than sentAt. */
export async function readFreshInboxOtp(phoneNational: string, sentAt: number): Promise<string> {
  assertE2eFixtureEnvironment();
  const db = serviceClient();
  const forms = [`+995${phoneNational}`, `995${phoneNational}`];
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", forms)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row && new Date(row.created_at as string).getTime() >= sentAt) {
      return row.otp as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no fresh OTP in dev_otp_inbox for ${phoneNational}`);
}

/**
 * Programmatic seeded-account login: ask staging Auth for an OTP, read the sealed
 * staging inbox, install the returned cookie session, and open the cabinet. No
 * removed phone-login controls are involved.
 */
export async function loginAs(
  page: Page,
  phoneNational: string,
  landing: RegExp = /\/(me|delegate|admin)(\/|\?|#|$)/,
): Promise<void> {
  assertE2eFixtureEnvironment();
  const { url, key } = publicSupabaseConfig();
  const auth = createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const phone = `+995${phoneNational}`;
  let sentAt = 0;
  let sent = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    sentAt = Date.now() - 2000;
    const { error } = await auth.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    });
    if (!error) {
      sent = true;
      break;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 62_000));
  }
  if (!sent) throw new Error("e2e could not request the staging login OTP");
  const otp = await readFreshInboxOtp(phoneNational, sentAt);
  const { data, error } = await auth.auth.verifyOtp({ phone, token: otp, type: "sms" });
  if (error || !data.session) throw new Error("e2e could not verify the staging login OTP");
  await installSupabaseSession(page, data.session);
  await page.goto("/me");
  await expect(page).toHaveURL(landing, { timeout: 15_000 });
}
