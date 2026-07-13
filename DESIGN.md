# Design system (ported from prototype/index.html)

Registers: PUBLIC pages = bold patriotic (brand red, serif display headlines).
CABINETS/ADMIN = calm utilitarian (neutral surfaces; red only for primary actions).

Tokens (Tailwind @theme in app/globals.css): brand #C8102E, brand-dark #A30D26,
ink #12141C, muted-fg #5B616E, surface #F6F7F9, line #E4E7EC, gold #C9A24B,
ok #188038, warn #B45309, danger #B3261E, info #1A73E8.
Fonts: font-sans = Noto Sans Georgian (UI); font-serif = Noto Serif Georgian (public
headlines only). lang="ka" everywhere.

Components (components/): Button (primary|ghost|danger), Card, StatCard, Pill
(status colors), Field (label+input+error), Stepper (3-step funnel).
Live gallery: /styleguide. Never restyle ad hoc — extend the component instead.
Status pill mapping: draft=muted, profile_completed=info, active_member=ok,
pending=warn, approved=ok, rejected=danger.
