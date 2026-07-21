import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // opportunistic hygiene: drop codes older than an hour (Phase 0 minor)
  await admin
    .from("dev_otp_inbox")
    .delete()
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

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
  if (profiles?.[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // hook stores phone without '+'; retry briefly because the hook runs async of the request
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await admin
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", [withPlus, stripped])
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return NextResponse.json({ otp: data[0]!.otp });
    await new Promise((r) => setTimeout(r, 500));
  }
  return NextResponse.json({ error: "no otp" }, { status: 404 });
}
