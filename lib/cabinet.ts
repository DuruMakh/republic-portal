import { EMPLOYMENT_PRESETS } from "./funnel-schemas";
import type { CabinetState, CabinetStatePresent } from "./funnel";

/**
 * Post-login / guard destination (spec §3.2): cabinet for completed users,
 * funnel otherwise. `role === "delegate"` always wins (delegates have no
 * membership standing); otherwise the standing decides.
 */
export function deriveDestination(state: CabinetState | null): string {
  if (!state || !state.exists) return "/join";
  if (state.role === "delegate") return "/delegate";
  return state.standing === "member" ? "/me/profile" : "/me";
}

/**
 * Nav variant: delegates-row wins; otherwise the standing decides. Only ever
 * called for a present profile (the cabinet layouts redirect an absent state to
 * /join first), so it takes the present variant — an absent state has no role.
 */
export function cabinetRole(state: CabinetStatePresent): "registered" | "member" | "delegate" {
  if (state.role === "delegate") return "delegate";
  return state.standing === "member" ? "member" : "registered";
}

/** Cabinet navigation (spec §3.1): delegates have no membership → no „ჩემი დელეგატი“. */
export interface CabinetNavItem {
  href: string;
  label: string;
}

export function cabinetNavItems(
  role: "registered" | "member" | "delegate",
  isAdmin = false,
): CabinetNavItem[] {
  const items: CabinetNavItem[] =
    role === "delegate"
      ? [
          { href: "/me/profile", label: "პროფილი" },
          { href: "/me/billing", label: "გადახდები" },
          { href: "/me/news", label: "სიახლეები" },
          { href: "/me/events", label: "ღონისძიებები" },
          { href: "/me/polls", label: "გამოკითხვები" },
          { href: "/delegate", label: "დელეგატის პანელი" },
        ]
      : role === "member"
        ? [
            { href: "/me/profile", label: "პროფილი" },
            { href: "/me/delegate", label: "ჩემი დელეგატი" },
            { href: "/me/billing", label: "გადახდები" },
            { href: "/me/news", label: "სიახლეები" },
            { href: "/me/events", label: "ღონისძიებები" },
            { href: "/me/polls", label: "გამოკითხვები" },
          ]
        : [
            { href: "/me", label: "მთავარი" },
            { href: "/me/events", label: "ღონისძიებები" },
            { href: "/me/news", label: "სიახლეები" },
            { href: "/me/profile", label: "პროფილი" },
          ];
  // Phase 4 (spec §3.1): admins reach /admin from their own cabinet
  if (isAdmin) items.push({ href: "/admin", label: "ადმინისტრირება" });
  return items;
}

/** Select value for the employment „სხვა (მიუთითე)“ branch (never a stored value). */
export const EMPLOYMENT_OTHER = "__other";

export interface EmploymentFormValue {
  choice: string; // one of EMPLOYMENT_PRESETS, or EMPLOYMENT_OTHER
  custom: string;
}

export function employmentToForm(stored: string | null): EmploymentFormValue {
  if (stored !== null && (EMPLOYMENT_PRESETS as readonly string[]).includes(stored)) {
    return { choice: stored, custom: "" };
  }
  return { choice: EMPLOYMENT_OTHER, custom: stored ?? "" };
}

export function formToEmployment(value: EmploymentFormValue): string {
  return value.choice === EMPLOYMENT_OTHER ? value.custom.trim() : value.choice;
}

/**
 * „წევრი — 2026 წლის თებერვლიდან“: -დან month forms, hand-coded because Georgian
 * syncope (იანვარი→იანვრიდან, თებერვალი→თებერვლიდან) is irregular — same lesson
 * as Phase 1's region genitives.
 */
const MONTHS_FROM_KA = [
  "იანვრიდან",
  "თებერვლიდან",
  "მარტიდან",
  "აპრილიდან",
  "მაისიდან",
  "ივნისიდან",
  "ივლისიდან",
  "აგვისტოდან",
  "სექტემბრიდან",
  "ოქტომბრიდან",
  "ნოემბრიდან",
  "დეკემბრიდან",
] as const;

// Georgia is UTC+4 year-round (no DST). timestamptz values arrive as ISO UTC, so
// the calendar day/month must be read in Tbilisi local time — otherwise anything
// timestamped 00:00–04:00 local renders a day (and, at month/year edges, a month)
// early. Shifting by a fixed offset then reading UTC accessors keeps this
// deterministic (no ICU), the same reason formatDateKa avoids Intl.
export const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;

function toTbilisi(iso: string): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + TBILISI_OFFSET_MS);
}

export function memberSinceKa(isoTimestamp: string | null): string | null {
  if (!isoTimestamp) return null;
  const d = toTbilisi(isoTimestamp);
  if (!d) return null;
  const month = MONTHS_FROM_KA[d.getUTCMonth()];
  if (!month) return null;
  return `${d.getUTCFullYear()} წლის ${month}`;
}

/** "+9955XXXXXXXX" / "9955XXXXXXXX" → "+995 5XX XX XX XX" (prototype spacing). */
export function formatPhoneKa(phone: string | null | undefined): string {
  if (!phone) return "—";
  const m = /^\+?995(5\d{8})$/.exec(phone.replace(/\s/g, ""));
  if (!m) return phone;
  const n = m[1]!; // regex group 1 always present on match
  return `+995 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
}

/** Deterministic dd.mm.yyyy in Tbilisi time — Node/browser ICU disagreements broke ka-GE once already. */
export function formatDateKa(iso: string): string {
  const d = toTbilisi(iso);
  if (!d) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getUTCFullYear()}`;
}

/** GEL amounts are numeric(10,2); render with a fixed 2 decimals so 50.5 → „50.50". */
export function formatAmountGel(amount: number): string {
  return amount.toFixed(2);
}

export function initialsKa(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`;
}

/** Mirrors the delegate_panel() RPC jsonb exactly (spec §4.4). */
export interface DelegatePanelData {
  status: "pending" | "approved" | "rejected";
  referralCode: string | null; // withheld (null) until the delegate is approved
  activeCount: number;
  totalCount: number;
  draftCount: number;
}

export type TeamMemberStatus = "profile_completed" | "active_member";

/** Mirrors one delegate_team() RPC array element (spec §4.5). */
export interface TeamMember {
  firstName: string;
  lastName: string;
  registeredAt: string;
  status: TeamMemberStatus;
}

/** Team-table / summary-pill vocabulary (spec §3.3, §3.7); rendered via Pill's label override. */
export const TEAM_STATUS_LABELS: Record<TeamMemberStatus, string> = {
  profile_completed: "წევრი",
  active_member: "აქტიური",
};

export function paymentMethodLabel(source: string): string {
  return source === "manual" ? "გადარიცხვა" : source;
}

export function buildReferralUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/join?ref=${encodeURIComponent(code)}`;
}

/** Billing-history status cell (Phase 4: voided payments stay visible, honestly). */
export function paymentStatusKa(voidedAt: string | null): {
  label: string;
  pillStatus: "active_member" | "rejected";
} {
  return voidedAt === null
    ? { label: "დადასტურებული", pillStatus: "active_member" }
    : { label: "გაუქმებული", pillStatus: "rejected" };
}
