export const TIERS = [5, 10, 20] as const;
export type Tier = (typeof TIERS)[number];

/** Crockford-style: no I, L, O, 0, 1 — 31 unambiguous characters. DB mirror: gen_funnel_code(). */
export const FUNNEL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type FunnelRole = "member" | "delegate";
export type FunnelStep = "step-1" | "step-2" | "step-3" | "done" | "pending";

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

/** Mirrors the funnel_state() RPC jsonb exactly (keys are camelCase in SQL). */
export interface FunnelState {
  exists: boolean;
  role: FunnelRole;
  firstName: string;
  lastName: string;
  personalIdSet: boolean;
  birthDate: string | null; // "YYYY-MM-DD"
  regionId: number | null;
  cityId: number | null;
  employment: string | null;
  tier: Tier | null;
  referenceCode: string | null;
  completed: boolean;
  delegateStatus: "pending" | "approved" | "rejected" | null;
  referral: FunnelReferral | null;
  chosenDelegate: FunnelChosenDelegate | null; // null = ცენტრალური მოძრაობა (or none yet)
  membershipExists: boolean;
}

export function deriveFunnelStep(state: FunnelState | null): FunnelStep {
  if (!state || !state.exists) return "step-1";
  if (state.completed) return state.role === "delegate" ? "pending" : "done";
  if (!state.personalIdSet) return "step-2";
  return "step-3";
}

export function funnelRoute(step: FunnelStep): string {
  return `/join/${step}`;
}

/** Which funnel screen a state may open; anything else redirects to the derived step. */
export function canAccess(step: FunnelStep, state: FunnelState | null): boolean {
  const current = deriveFunnelStep(state);
  if (step === current) return true;
  // step 2 stays editable until completion (back navigation from step 3)
  return step === "step-2" && current === "step-3";
}

const REFERENCE_CODE_RE = /^GR-[A-HJKMNP-Z2-9]{6}$/;

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
  invalid_role: "დაფიქსირდა შეცდომა — სცადე თავიდან.",
  invalid_name: "შეავსე სახელი და გვარი.",
};

export const GENERIC_FUNNEL_ERROR = "რაღაც შეცდომა მოხდა — სცადე თავიდან.";

export function mapFunnelError(message: string | null | undefined): string {
  if (!message) return GENERIC_FUNNEL_ERROR;
  for (const [token, ka] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(token)) return ka;
  }
  return GENERIC_FUNNEL_ERROR;
}
