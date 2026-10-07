import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanupPhase4Users,
  phase4PersonalId,
  phase4Phone,
  profileIdByPhone,
  serviceClient,
} from "./admin-helpers";
import { approveOwnDelegate, seedPendingDelegate, seedRegisteredMember } from "./funnel-helpers";
import { clientFor, otpSession } from "./otp-helpers";

// ADR-038: the referral figures split into supporters (signed up through the link,
// membership form not finished) and members (finished it). Nothing is stored: a
// person moves from one figure to the other when their status changes, and sign-ups
// earned before delegate approval stay counted after it.
//
// Phase-4 slots are borrowed per spec (workers=1, cleanup before and after), the
// same way delegacy.spec reuses 5 and 6.
const REFERRER = 0;
const FRIEND_A = 1; // signs up through the referrer's own M- link, then finishes the form
const FRIEND_B = 4; // signs up through the delegate link after approval

test.describe.configure({ mode: "serial" });
test.beforeAll(() => cleanupPhase4Users([REFERRER, FRIEND_A, FRIEND_B]));
test.afterAll(() => cleanupPhase4Users([REFERRER, FRIEND_A, FRIEND_B]));

async function seedReferred(slot: number, signupRefCode: string): Promise<string> {
  const phone = phase4Phone(slot);
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({
    phone: `+995${phone}`,
    phone_confirm: true,
  });
  if (error || !data.user) throw new Error(`referred user create failed: ${error?.message}`);
  try {
    await seedRegisteredMember({
      userId: data.user.id,
      phone,
      firstName: "მოწვეული",
      lastName: `ტესტი${slot}`,
      personalId: phase4PersonalId(slot),
      signupRefCode,
    });
  } catch (seedError) {
    // cleanupPhase4Users finds users through their profile, so an auth user whose
    // profile never landed would outlive the run and block this slot's next createUser
    await admin.auth.admin.deleteUser(data.user.id);
    throw seedError;
  }
  return data.user.id;
}

/**
 * The part of finishing the membership form the referral figures depend on: member
 * status, the completion stamp, and the open membership every member holds. The real
 * form also writes the profile details, tier and reference code, which no count reads.
 */
async function finishMembershipForm(id: string): Promise<void> {
  const db = serviceClient();
  const { error: pErr } = await db
    .from("profiles")
    .update({ status: "profile_completed", registration_completed_at: new Date().toISOString() })
    .eq("id", id);
  if (pErr) throw new Error(`completion update failed: ${pErr.message}`);
  const { error: mErr } = await db.from("memberships").insert({ member_id: id, delegate_id: null });
  if (mErr) throw new Error(`membership insert failed: ${mErr.message}`);
}

async function referralFigures(client: SupabaseClient, rpc: "cabinet_state" | "delegate_panel") {
  const { data, error } = await client.rpc(rpc);
  if (error) throw new Error(`${rpc} failed: ${error.message}`);
  return {
    supporters: data.referralSupporters as number,
    members: data.referralMembers as number,
    total: data.referralCount as number,
  };
}

test("supporters move to members, and earlier sign-ups survive delegate approval", async () => {
  const db = serviceClient();
  // a member who has asked to become a delegate: their own M- link is live, the
  // delegate link is not yet
  await seedPendingDelegate({
    phone: phase4Phone(REFERRER),
    firstName: "რეფერალი",
    lastName: "ტესტი",
    personalId: phase4PersonalId(REFERRER),
  });
  const referrerId = await profileIdByPhone(db, phase4Phone(REFERRER));
  const { data: own, error: ownErr } = await db
    .from("profiles")
    .select("referral_code")
    .eq("id", referrerId)
    .single();
  if (ownErr || !own) throw new Error(`own code lookup failed: ${ownErr?.message}`);
  const referrer = await clientFor(await otpSession(phase4Phone(REFERRER)));

  // someone signs up through the link: one supporter
  const friendA = await seedReferred(FRIEND_A, own.referral_code as string);
  expect(await referralFigures(referrer, "cabinet_state")).toEqual({
    supporters: 1,
    members: 0,
    total: 1,
  });

  // they finish the membership form: supporters −1, members +1
  await finishMembershipForm(friendA);
  expect(await referralFigures(referrer, "cabinet_state")).toEqual({
    supporters: 0,
    members: 1,
    total: 1,
  });

  // approval: the member counted before it stays, and a sign-up through the
  // delegate link adds to the same figures
  await approveOwnDelegate(phase4Phone(REFERRER));
  const { data: delegate, error: dErr } = await db
    .from("delegates")
    .select("referral_code")
    .eq("id", referrerId)
    .single();
  if (dErr || !delegate) throw new Error(`delegate code lookup failed: ${dErr?.message}`);
  await seedReferred(FRIEND_B, delegate.referral_code as string);

  const expected = { supporters: 1, members: 1, total: 2 };
  expect(await referralFigures(referrer, "cabinet_state")).toEqual(expected);
  expect(await referralFigures(referrer, "delegate_panel")).toEqual(expected);
});
