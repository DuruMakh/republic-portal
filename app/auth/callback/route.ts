import { NextResponse } from "next/server";
import { safeAuthNext } from "@/lib/auth";
import { deriveDestination } from "@/lib/cabinet";
import type { CabinetState } from "@/lib/funnel";
import { localePath, stripLocale } from "@/lib/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";

function redirectTo(origin: string, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, origin));
}

function isJoinPath(path: string): boolean {
  const unprefixed = stripLocale(path);
  return unprefixed === "/join" || unprefixed.startsWith("/join?");
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeAuthNext(url.searchParams.get("next"));
  const locale = /^\/en(?:\/|[?#]|$)/.test(next) ? "en" : "ka";
  const destinationFor = (path: string) => localePath(path, locale);
  const retryPath = (error: string) => {
    const query = new URLSearchParams({ error });
    if (isJoinPath(next) && next.includes("?")) query.set("next", next);
    return destinationFor(`/login?${query.toString()}`);
  };

  if (!code) return redirectTo(url.origin, retryPath("oauth_callback"));

  let supabase;
  try {
    supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectTo(url.origin, retryPath("oauth_callback"));
  } catch {
    return redirectTo(url.origin, retryPath("oauth_callback"));
  }

  try {
    const { data, error } = await supabase.rpc("cabinet_state");
    if (error || data === null) {
      return redirectTo(url.origin, retryPath("account_lookup"));
    }

    const state = data as unknown as CabinetState;
    const destination = state.exists ? deriveDestination(state) : isJoinPath(next) ? next : "/join";
    return redirectTo(url.origin, destinationFor(destination));
  } catch {
    return redirectTo(url.origin, retryPath("account_lookup"));
  }
}
