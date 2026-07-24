/**
 * The dev_otp_inbox poll, re-expressed as ESM JavaScript for scripts that run
 * outside Playwright. This is a deliberate duplicate of
 * e2e/otp-helpers.ts's readFreshInboxOtp: that file is TypeScript imported by
 * Playwright only, and this script must not reach across that boundary.
 * Consolidating every copy of this idiom is a pre-existing tidy-up already
 * tracked separately (.superpowers/sdd/progress.md, decision D-A) — out of
 * scope for the security audit.
 */
import { db } from "./actors.mjs";

/** THE dev_otp_inbox poll: newest row for the phone, no older than sentAt. */
export async function readFreshInboxOtp(phoneNational, sentAt) {
  const forms = [`+995${phoneNational}`, `995${phoneNational}`];
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", forms)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (row && new Date(row.created_at).getTime() >= sentAt) return row.otp;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no fresh OTP in dev_otp_inbox for ${phoneNational}`);
}
