import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** How long a dev code stays servable — and the cutoff the inbox is pruned at. */
const CODE_TTL_MS = 60 * 60 * 1000;
/** The hook writes the code asynchronously of the request, so the inbox is polled. */
const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 500;

export async function GET(request: NextRequest) {
  const env = process.env.NEXT_PUBLIC_APP_ENV;
  if (!(env === "development" || env === "preview")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const admin = createAdminClient();
  const stripped = phone.replace(/^\+/, "");
  const withPlus = `+${stripped}`;

  // Phase 2 hardening (spec §4.4, decision #6): this endpoint must never be an
  // account-takeover oracle for the registration/login OTP flows. Withhold the code
  // for ANY existing profile — 'registered' (a real account carrying a name, personal
  // ID and cabinet), 'profile_completed', and 'active_member' alike. A registered
  // account needs the same protection completed/active already had.
  //
  // Safe for genuine NEW signups: register() inserts the profile row only AFTER OTP
  // verification, so a brand-new registration has NO row at OTP time and its on-screen
  // code still renders; only already-existing accounts are protected.
  //
  // Both phone formats are matched so a format mismatch can never fail OPEN.
  // .limit(1) is safe: profiles.phone is UNIQUE and every write path (register, seed) pins +E.164 format — at most one row can match.
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .in("phone", [withPlus, stripped])
    .limit(1);
  if (profileErr) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  // Audit §18.2: the answer is REMEMBERED, never returned here. Returning early on a
  // known account made the endpoint an account-existence oracle for any anonymous
  // stranger — a fast refusal meant "this number has an account", a slow one meant it
  // does not, and that gap survived making the two bodies identical. Every failure now
  // walks the same path at the same cost.
  const profileExists = Boolean(profiles?.[0]);

  // The inbox is read the same number of times whatever the answer will be. Only a
  // request that is actually going to be served a code may leave the loop early —
  // withholding must cost the full budget, because an attacker can put a code in the
  // inbox for any number simply by triggering a send.
  let otp: string | null = null;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    const { data } = await admin
      .from("dev_otp_inbox")
      .select("otp, created_at")
      // hook stores phone without '+'; match both formats
      .in("phone", [withPlus, stripped])
      // freshness is enforced on the read itself, so an expired code can never be
      // served even if pruning has not run (and cannot race it)
      .gte("created_at", new Date(Date.now() - CODE_TTL_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (!profileExists && data && data.length > 0) {
      otp = data[0]!.otp;
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (otp === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Hygiene, moved behind the outcome that proves a real send: dropping expired codes
  // used to run on every request, before any check, which let an unauthenticated
  // stranger drive an unbounded service-role DELETE (audit §18.3). No failure path
  // touches a privileged write now, and this one still prunes on every real signup.
  await admin
    .from("dev_otp_inbox")
    .delete()
    .lt("created_at", new Date(Date.now() - CODE_TTL_MS).toISOString());
  return NextResponse.json({ otp });
}
