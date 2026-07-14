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
