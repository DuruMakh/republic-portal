"use server";

import { redirect } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { testSignInEnabled } from "@/lib/env";
import {
  fixtureSessionFor,
  freshVisitorSession,
  isPersonaPhone,
  resolvePersonaPhone,
  type FixtureAuthConfig,
} from "@/lib/fixture-auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { TEST_PERSONA_IDS, TEST_PERSONAS, type TestPersona } from "@/lib/test-personas";

const personaSchema = z.enum(TEST_PERSONA_IDS);

function testDatabaseConfig(): FixtureAuthConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

async function sessionFor(config: FixtureAuthConfig, persona: TestPersona): Promise<Session> {
  if (persona === "visitor") return freshVisitorSession(config);
  const phone = await resolvePersonaPhone(config, persona);
  return fixtureSessionFor(config, phone, isPersonaPhone);
}

/**
 * Preview-only one-click sign-in (spec 2026-10-08 simpler dev structure 4.3). The gate here
 * is the security: testSignInEnabled() admits only an explicit preview/development build on
 * an allow-listed test database. Hiding the panel on /login is UX.
 */
export async function testSignInAction(formData: FormData): Promise<void> {
  const config = testSignInEnabled() ? testDatabaseConfig() : null;
  if (!config) redirect("/login");
  const parsed = personaSchema.safeParse(formData.get("persona"));
  if (!parsed.success) redirect("/login");
  const persona = parsed.data;

  let signedIn = false;
  try {
    const session = await sessionFor(config, persona);
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    signedIn = !error;
  } catch {
    signedIn = false;
  }
  if (!signedIn) redirect("/login?error=test_sign_in");
  redirect(TEST_PERSONAS.find((p) => p.id === persona)?.landing ?? "/me");
}
