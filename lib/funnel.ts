export const TIERS = [5, 10, 20] as const;
export type Tier = (typeof TIERS)[number];

/** Crockford-style: no I, L, O, 0, 1 — 31 unambiguous characters. DB mirror: gen_funnel_code(). */
export const FUNNEL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface FunnelReferral {
  firstName: string;
  lastName: string;
  regionNameKa: string;
}

export interface FunnelChosenDelegate {
  id: string;
  firstName: string;
  lastName: string;
}

export type Standing = "registered" | "member";
export type CabinetRole = "member" | "delegate";
export type MembershipPhase = "profile" | "tier" | "done";
/** profiles.status after the enum rename (draft → registered). */
export type MemberStatus = "registered" | "profile_completed" | "active_member";

/**
 * cabinet_state() RPC result, discriminated on `exists`. The RPC's no-profile
 * branch returns EXACTLY `{ exists: false }`, so for a signed-in user with no
 * profile row every other field is genuinely `undefined` at runtime. Splitting
 * the union makes that illegal state unrepresentable: a consumer must narrow on
 * `exists === true` before it may read any profile field, and the compiler now
 * enforces it (finding V8 — an absent state used to crash /me/profile and
 * mis-route the wizard because the old shape declared every field present).
 */
export type CabinetState = CabinetStateAbsent | CabinetStatePresent;

/** Authenticated, but register() has not created a profile row yet. */
export interface CabinetStateAbsent {
  exists: false;
}

/** A profile row exists — cabinet_state() populates every field below. */
export interface CabinetStatePresent {
  exists: true;
  /** 'member' when registration_completed_at is set (or legacy active_member). */
  standing: Standing;
  /** Raw profiles.status — billing/profile render the active_member distinction from it. */
  status: MemberStatus;
  /** delegates-row presence — cabinet routing only, NOT an authorization signal. */
  role: CabinetRole;
  firstName: string;
  lastName: string;
  /** e.g. "010********" — first 3 digits + asterisks; own-ID display without raw exposure. */
  personalIdMasked: string;
  birthDate: string | null; // "YYYY-MM-DD"
  regionId: number | null;
  cityId: number | null;
  employment: string | null;
  tier: Tier | null;
  referenceCode: string | null;
  /** standing === "member" — kept as a flag because most call sites gate on it. */
  completed: boolean;
  delegateStatus: "pending" | "approved" | "rejected" | null;
  referral: FunnelReferral | null;
  /** Wizard step-A choice, held server-side until completion (spec §4.3). */
  pendingDelegate: FunnelChosenDelegate | null;
  chosenDelegate: FunnelChosenDelegate | null; // null = ცენტრალური მოძრაობა (or none yet)
  membershipExists: boolean;
  registrationCompletedAt: string | null;
  createdAt: string;
  admin: boolean;
  /** Present ONLY on register() responses: true = row inserted, false = pre-existing (no-op). */
  created?: boolean;
}

/** Shared server-action result shape (Tasks 6–7): register() and the wizard actions. */
export type ActionResult = { ok: true; state: CabinetState } | { ok: false; error: string };

/** Which wizard screen a registered person sees; done ⇢ member (spec §4.3). */
export function deriveMembershipPhase(state: CabinetState): MembershipPhase {
  // Defense in depth (finding V8): an absent profile has no wizard fields, so
  // without this guard the `undefined !== null` checks below would mis-derive
  // 'tier' for a nonexistent profile. Real callers narrow to a present state
  // first (page guards / the wizard's present-only prop) — this only fires on
  // the raw RPC { exists: false } payload.
  if (!state.exists) return "profile";
  if (state.completed) return "done";
  const profileSaved =
    state.birthDate !== null &&
    state.regionId !== null &&
    state.cityId !== null &&
    state.employment !== null;
  return profileSaved ? "tier" : "profile";
}

const REFERENCE_CODE_RE = new RegExp(`^GR-[${FUNNEL_CODE_ALPHABET}]{6}$`);

export function isReferenceCode(value: string): boolean {
  return REFERENCE_CODE_RE.test(value);
}

/** Loose sanity check for ?ref= values — covers new 6-char codes and seeded D00101-style. */
export function isReferralCodeCandidate(value: string): boolean {
  return /^[A-Za-z0-9-]{1,32}$/.test(value);
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  duplicate_personal_id: "ეს პირადი ნომერი უკვე რეგისტრირებულია.",
  invalid_personal_id: "პირადი ნომერი უნდა იყოს 11 ციფრი.",
  invalid_birth_date: "მიუთითე დაბადების თარიღი.",
  invalid_employment: "მიუთითე საქმიანობა.",
  invalid_city: "აირჩიე ქალაქი არჩეული მხარიდან.",
  invalid_delegate: "არჩეული დელეგატი ვერ მოიძებნა — სცადე თავიდან.",
  terms_required: "საჭიროა წესებზე თანხმობა.",
  invalid_tier: "აირჩიე საწევრო პაკეტი.",
  profile_incomplete: "ჯერ შეავსე წინა ნაბიჯები.",
  already_completed: "რეგისტრაცია უკვე დასრულებულია.",
  not_authenticated: "სესია ამოიწურა — დაადასტურე ნომერი თავიდან.",
  not_completed: "ჯერ დაასრულე რეგისტრაცია.",
  not_a_member: "ეს მოქმედება მხოლოდ წევრებისთვისაა.",
  not_a_delegate: "დელეგატის პანელი მხოლოდ დელეგატებისთვისაა.",
  invalid_role: "დაფიქსირდა შეცდომა — სცადე თავიდან.",
  invalid_name: "შეავსე სახელი და გვარი.",
  // Phase 4 admin tokens (spec §5)
  missing_role: "ამ მოქმედებისთვის საკმარისი უფლება არ გაქვს.",
  invalid_target: "ჩანაწერი ვერ მოიძებნა — განაახლე გვერდი.",
  already_voided: "ეს გადახდა უკვე გაუქმებულია.",
  duplicate_reference: "ამ საბანკო რეფერენსით გადახდა უკვე აღრიცხულია.",
  last_super_admin: "ბოლო super_admin-ის მოხსნა შეუძლებელია.",
  invalid_setting: "პარამეტრის მნიშვნელობა არასწორია.",
  invalid_slug: "მისამართის შექმნა ვერ მოხერხდა — სცადე თავიდან.",
  invalid_amount: "თანხა არასწორია.",
  invalid_date: "თარიღი არასწორია.",
  invalid_reason: "მიუთითე მიზეზი (3–500 სიმბოლო).",
  invalid_note: "შენიშვნა ძალიან გრძელია (მაქს. 500).",
  invalid_rows: "ცხრილის მონაცემები არასწორია — სცადე თავიდან.",
  unknown_code: "უცნობი კოდი",
  duplicate: "დუბლიკატი — იდენტური გადახდა უკვე აღრიცხულია.",
  // Phase 5 community tokens (spec §6). ORDER MATTERS: mapFunnelError matches by
  // substring in insertion order, so the longer `invalid_options` must precede
  // its prefix `invalid_option`; and the token is `invalid_event_dates` (NOT
  // `invalid_dates`) because Phase 4's earlier `invalid_date` entry would
  // substring-shadow it.
  already_voted: "ხმა უკვე მიცემულია.",
  poll_closed: "გამოკითხვა დახურულია.",
  rsvp_closed: "რეგისტრაცია ამ ღონისძიებაზე დახურულია.",
  invalid_options: "პასუხის ვარიანტები არასწორია (2–10, უნიკალური).",
  invalid_option: "აირჩიე პასუხი სიიდან.",
  invalid_status: "მოქმედება ამ მდგომარეობაში შეუძლებელია — განაახლე გვერდი.",
  invalid_title: "სათაური არასწორია (1–160 სიმბოლო).",
  invalid_body: "ტექსტი ცარიელია ან ძალიან გრძელია.",
  invalid_location: "ადგილმდებარეობა არასწორია (1–200 სიმბოლო).",
  invalid_event_dates: "თარიღები არასწორია.",
  invalid_question: "კითხვა არასწორია (1–300 სიმბოლო).",
  invalid_image: "სურათის შენახვა ვერ მოხერხდა.",
};

export const DUPLICATE_PERSONAL_ID_MESSAGE = ERROR_MESSAGES["duplicate_personal_id"]!;

/**
 * Mapped message for a genuinely lapsed/absent OTP session. /join routes on this
 * constant (finding V10): only this failure legitimately drops the registration
 * back to a fresh OTP — every other failure reuses the already-proven session.
 */
export const NOT_AUTHENTICATED_MESSAGE = ERROR_MESSAGES["not_authenticated"]!;

export const GENERIC_FUNNEL_ERROR = "რაღაც შეცდომა მოხდა — სცადე თავიდან.";

export function mapFunnelError(message: string | null | undefined): string {
  if (!message) return GENERIC_FUNNEL_ERROR;
  for (const [token, ka] of Object.entries(ERROR_MESSAGES)) {
    if (token === "duplicate") {
      // bare "duplicate" must match only as the WHOLE token ("duplicate",
      // "P0001: duplicate") — as a plain substring it would capture any raw
      // Postgres "duplicate key value…" (23505) and mislabel an unrelated
      // conflict as an already-recorded payment
      if (/(?:^|[\s:])duplicate$/.test(message)) return ka;
      continue;
    }
    if (message.includes(token)) return ka;
  }
  return GENERIC_FUNNEL_ERROR;
}
