# Design system (ported from prototype/index.html)

Registers: PUBLIC pages = bold patriotic (brand red, serif display headlines).
CABINETS/ADMIN = calm utilitarian (neutral surfaces; red only for primary actions).

Tokens (Tailwind @theme in app/globals.css): brand #C8102E, brand-dark #A30D26,
ink #12141C, muted-fg #5B616E, surface #F6F7F9, line #E4E7EC, navy #0E1A2B, navy-dark #16283F,
gold #C9A24B, ok #188038, warn #B45309, danger #B3261E, info #1A73E8.
Fonts: font-sans = Noto Sans Georgian (UI); font-serif = Noto Serif Georgian (public
headlines only). lang="ka" everywhere.

Components (components/): Button (primary|ghost|danger|dark|ghost-inverse), ButtonLink
(same variants as Button, styled next/link), Card, StatCard, Pill (status colors),
Field (label+input+error), Stepper (3-step funnel). DemoBanner (env-gated, non-production).
Live gallery: /styleguide. Never restyle ad hoc — extend the component instead.
Status pill mapping: draft=muted, profile_completed=info, active_member=ok,
pending=warn, approved=ok, rejected=danger.
Ghost-inverse variant (white text/border on dark) used only on navy/dark backgrounds (footer, etc).
Button/ButtonLink take size sm|md|lg (md default); size overrides must use the prop,
never padding/text classes in className (Tailwind order makes those unreliable).
Phase 1: Card gains header + padded props; Badge = generic count/label chip.

Page background is white (body bg-white); `surface` #F6F7F9 is for wells, inputs,
pills and inactive elements — matching prototype usage.

Phase 2: OtpInput (6-box SMS code entry), TierPicker (5/10/20 ₾ radiogroup),
DelegateBinding (referral card / region-filtered picker with „ცენტრალური მოძრაობა"
default). Stepper labels are the funnel's: კონტაქტი / იურ. პროფილი / საწევრო.

Phase 3: CabinetNav (role-aware cabinet tabs + გასვლა sign-out), QrCode (uqr
inline SVG, ADR-011), CopyButton, PendingExplainer (shared by /join/pending and
the pending delegate panel). Pill gains an optional `label` override (colors
stay keyed by status). TransferInstructions moved from app/(public)/join/ to
components/ — now shared by /join/done, /join/pending and /me/billing.

Phase 4: AdminNav (role-filtered admin tabs + გასვლა; dense register). Admin list
pattern: GET-form filters + server-side range pagination (50/page) + DataTable;
masked personal IDs with an audited ჩვენება reveal; bulk-preview status chips
(ok=ok-green, duplicates=warn, failures=danger); form controls share
`adminControlClasses` (components/Field.tsx). StatCard reused for admin KPIs.

Phase 5: ContentBody (paragraphs+auto-links renderer — the one renderer for
news/event bodies everywhere incl. the admin live preview), NewsCard (shared by
/news and /me/news), ContentNav (admin content sub-nav), poll bars (surface
track + brand fill, prototype me-polls parity), RSVP toggle (მოვალ ⇄ გაუქმება +
„✓ შენ მოდიხარ"). Content-status pills via contentPill() label overrides.
Cabinet nav grew to six member tabs; AdminNav gained შიგთავსი (editor +
super_admin).
