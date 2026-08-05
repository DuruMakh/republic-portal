# Mobile chrome — design

Date: 2026-08-02
Status: approved (owner, brainstorming session 2026-08-02)
Reference: `geo-republic-mobile-v2.html` (owner-supplied bundled prototype, 22 screens)

## 1. Problem

The app is desktop-first responsive. It has **no mobile-specific chrome at all**: no
`viewport-fit=cover`, no `env(safe-area-inset-*)` anywhere in the tree, no sticky or fixed
navigation, no `dvh` units. On a phone the consequences are concrete:

- `Masthead` renders a 172px logo plus five nav links plus a session action plus a CTA button
  in one `overflow-x-auto` row. On a 390px screen roughly 200px remain for seven items, so the
  primary navigation is a horizontal scroll most people never discover.
- `CabinetNav` is a second horizontal scroll strip; a member has six destinations plus a
  sign-out button in it.
- The join CTA scrolls away with the header and never comes back.
- On iPhone, content runs under the home indicator because nothing reads the safe-area insets.

## 2. Scope

**Chrome and navigation only.** Page bodies are not touched — they inherit the new chrome.

The reference's page *content* already matches production closely (same design tokens, same
components, same copy), so re-deriving 22 screens would mean rewriting working code that is
backed by real auth gates, zod validation and server state the prototype fakes. The genuine
delta is navigation architecture.

**Out of scope:** every `app/(admin)` route (dense ledger tables, desk-oriented, unchanged);
desktop at `md` and above (unchanged); any page body markup.

## 3. Key finding — this is not a re-skin

The reference uses the exact Kronika tokens already in `app/globals.css`: `#9f1d35` brand,
`#1a1611` ink, `#f7f2e9` paper, `#c9bfac` line, `#e5dfd2` stone, `#efe8da` surface, `#fffdf8`
paper-bright, `#b5ab98` frame, `#3e362b` prose, `#6e6659` muted-fg, `#188038` ok. Same two Noto
Georgian families, same serif-for-numerals rule, same rules-not-shadows, same square corners.

No token changes. No palette changes. `DESIGN.md` gains furniture entries only.

## 4. Decisions

### 4.1 Scroll model — bars float over a normally scrolling page

The reference welds header and bottom bar to a `100dvh` frame and scrolls only the middle
strip. **Rejected.** Visually identical, but it permanently pins the mobile browser's own
address bar (costing ~60px of an already short screen), breaks scroll restoration on back
navigation, and disables pull-to-refresh.

**Adopted:** header is `sticky top-0`, bottom bar is `fixed bottom-0`, the document scrolls
normally. The app-shell approach in the reference is an artifact of it being a self-contained
prototype in a fixed 430px frame, not a design requirement.

### 4.2 Breakpoint — `md` (768px)

New chrome renders below `md`; at `md` and above everything is exactly as it ships today.
`md` rather than `sm` because the five-link masthead row is still cramped at 700px.

Accepted consequence: between 640px and 768px, `PageSheet`'s `sm:border-x` sheet border is
visible while the navigation is still the mobile variant. This reads as a tablet-portrait
layout and is acceptable.

### 4.3 Three headers

| Header | Left | Right |
| --- | --- | --- |
| Public | logo (link to `/`) | `მენიუ` ghost button |
| Back | `← უკან` | red small-caps context label |
| Cabinet | logo + `პირადი კაბინეტი` register tag | — |

Rules under each header follow the shipped Kronika masthead: 2px ink, 3px gap, 1px hairline for
public and cabinet; a single 2px ink rule for back.

### 4.4 Route → chrome map

| Routes | Header | Bottom bar |
| --- | --- | --- |
| `/`, `/leaderboard`, `/news`, `/events`, `/transparency`, `/support` | public | join CTA |
| `/news/[slug]`, `/events/[slug]`, `/delegates/[slug]` | back | join CTA |
| `/join`, `/join/terms`, `/login` | back | none |
| `/me/*`, `/delegate/*` | cabinet | tab bar |
| `/me/membership`, `/me/membership/done` | back | none |
| `/admin/*`, `/styleguide`, `/offline` | unchanged | unchanged |

### 4.5 Join CTA bar

Guests: `შემოგვიერთდი` primary button (46px, ink fill) over the muted line
`ერთ წუთში · გადახდის გარეშე`.

Signed-in visitors on public routes: `ჩემი კაბინეტი →` instead, no second line. Session state
comes from the same source `HeaderSessionAction` already uses.

Suppressed on `/join`, `/join/terms` and `/login` — those screens *are* the call to action.

### 4.6 Cabinet tab bar

Five slots always: four destinations plus `მეტი`. Every role behaves identically.

Selection is by **return frequency**, not by the order in `cabinetNavItems()`. A pure
`slice(0, 4)` would put billing on the bar and bury polls, which is backwards.

| Role | Tabs | `მეტი` sheet |
| --- | --- | --- |
| registered | `მთავარი` · `ღონისძიება` · `სიახლე` · `პროფილი` | utilities only |
| member | `პროფილი` · `გამოკითხვა` · `ღონისძიება` · `სიახლე` | ჩემი დელეგატი, გადახდები |
| delegate | `დელეგატის პანელი` · `გამოკითხვა` · `ღონისძიება` · `სიახლე` | პროფილი, გადახდები |

The delegate's first tab is the panel because `deriveDestination()` already sends an approved
delegate to `/delegate` on login — that is their home.

`ადმინისტრირება`, when present, always lands in the sheet: it is a rare role-switching
destination, not a daily one.

The sheet also always carries `← საჯარო` and `გასვლა`, which is why registered users get a
`მეტი` tab despite having exactly four destinations.

Tab visual: 56px tall, text only (no icons — consistent with Kronika), active state is brand
red text with a 2px brand top rule, inactive is ink. The open-polls `Badge` rides on the
`გამოკითხვა` tab.

### 4.7 Tab labels shorten to singular forms

`DESIGN.md` sets a hard minimum text size of 0.74rem (~11.8px): "No micro-print below it." The
reference's tab labels are 10.8px — **below the shipped accessibility floor**, so they cannot
be copied.

At the floor, twelve-character plurals (`ღონისძიებები`, `გამოკითხვები`) do not fit a fifth of
a 360px screen. The ten-character singulars do.

Tab bar reads `ღონისძიება`, `გამოკითხვა`, `სიახლე`. Page headings keep the plural forms
unchanged. `პროფილი`, `მთავარი` and `დელეგატის პანელი` are unchanged from `cabinetNavItems()`.

Fit must be verified at 320px, 360px and 390px during implementation. If `დელეგატის პანელი`
does not fit five-across, the delegate bar drops to four slots with the panel first — never a
smaller font.

### 4.8 Back navigation targets a fixed parent, never `router.back()`

An article opened from a shared link has no history behind it; `router.back()` would leave the
site. Each back header links to a declared parent route.

| Route | Back to | Context label |
| --- | --- | --- |
| `/news/[slug]` | `/news` | სიახლეები |
| `/events/[slug]` | `/events` | ღონისძიებები |
| `/delegates/[slug]` | `/leaderboard` | რეიტინგი |
| `/join` | `/` | რეგისტრაცია |
| `/join/terms` | `/join` | წესები |
| `/login` | `/` | შესვლა |
| `/me/membership`, `/me/membership/done` | `/me/profile` | წევრობა |

### 4.9 Full-screen public menu

`მენიუ` opens an overlay covering the sheet: the same five public nav destinations as the
desktop masthead (`მთავარი`, `რეიტინგი`, `სიახლეები`, `ღონისძიებები`, `ფინანსები`), then the
session action, with the join button pinned at the bottom. Header carries the logo and a
`დახურვა` button in the inverted (ink fill) treatment.

Escape closes it; focus is trapped while open; body scroll is locked.

### 4.10 Membership wizard drops the tab bar

`/me/membership` and `/me/membership/done` use the back header with no bottom bar. A payment
flow should not display five exits.

## 5. Architecture

### 5.1 Pure logic — `lib/mobile-nav.ts`

No React or Next imports (project code rule: domain logic is pure functions in `lib/`).

```
mobileTabs(items: CabinetNavItem[]): { tabs: CabinetNavItem[]; more: CabinetNavItem[] }
mobileBackTarget(pathname: string): { href: string; label: string } | null
mobileChrome(pathname: string): "public" | "back" | "cabinet"
```

`mobileTabs` takes the **already-computed** `cabinetNavItems()` result rather than the role, so
the polls count and the conditional admin item flow through without `cabinetNavItems()` being
touched at all. It matches on `href`, which is stable, not on label.

`cabinetNavItems()` and `cabinetRole()` are not modified.

### 5.2 New components

| Component | Contract |
| --- | --- |
| `StickyBar` | The fixed bottom container: 2px ink top rule, paper fill, `env(safe-area-inset-bottom)` padding, `md:hidden`. Both the CTA bar and the tab bar render through it, so two bottom bars can never coexist. |
| `MobileTabBar` | `{ tabs, more, hasMore }` — five 56px slots, active by `aria-current="page"`, `Badge` for counts. |
| `MobileMoreSheet` | Bottom sheet over a scrim; overflow destinations, `← საჯარო`, `გასვლა`. Escape closes, focus trapped. |
| `MobileMenu` | Full-screen public navigation overlay. |
| `MobileBackHeader` | `{ href, label }` — `← უკან` plus red context label over a 2px ink rule. |

### 5.3 Changed files

| File | Change |
| --- | --- |
| `app/layout.tsx` | Add `export const viewport` with `viewportFit: "cover"`. **Without this, every safe-area inset silently evaluates to 0** — the layout would look correct on Android and clip under the home indicator on iPhone. |
| `components/Masthead.tsx` | Below `md`, render logo + `მენიუ`; at `md` and above, byte-identical to today. Props unchanged. |
| `components/CabinetNav.tsx` | `hidden md:flex`. Props and behavior unchanged. |
| `components/PageSheet.tsx` | Bottom clearance for the fixed bar, so no individual page can forget it. |
| `app/(public)/layout.tsx` | Wire menu + CTA bar. |
| `app/(member)/layout.tsx` | Wire tab bar from the existing badged `items`. |
| `app/(delegate)/layout.tsx` | Same. Note: this layout does not wire the polls count today, so its `გამოკითხვა` tab is unbadged — existing behavior, preserved deliberately. |
| `app/(public)/styleguide/page.tsx` | Gallery entries for all new furniture (`DESIGN.md` requires this in the same change). |
| `DESIGN.md` | Furniture table entries. No token or palette changes. |
| `DECISIONS.md` | ADR recording the scroll-model choice and the singular-label decision. |

## 6. Georgian strings

**This spec is not a splice source.** Every string below must be byte-spliced from the source
named, per the standing rule that Georgian is never hand-retyped.

| String | Source |
| --- | --- |
| `გასვლა` | shipped — `components/CabinetNav.tsx` |
| `შემოგვიერთდი` | shipped — `app/(public)/layout.tsx` (`HEADER_CTA_LABEL`) |
| `← საჯარო` | shipped — `app/(member)/layout.tsx` (`BACK_TO_PUBLIC`) |
| `პირადი კაბინეტი` | shipped — `app/(member)/layout.tsx` (`CABINET_TAG`) |
| `სიახლეები`, `ღონისძიებები`, `რეიტინგი`, `მთავარი`, `ფინანსები` | shipped — `app/(public)/layout.tsx` nav array |
| `წესები` | shipped — `app/(public)/layout.tsx` (`FOOTER_TERMS_LABEL`) |
| `პროფილი`, `გადახდები`, `ჩემი დელეგატი`, `დელეგატის პანელი`, `ადმინისტრირება` | shipped — `lib/cabinet.ts` |
| `მენიუ`, `დახურვა`, `უკან`, `მეტი` | reference bundle — new to the app |
| `ღონისძიება`, `გამოკითხვა`, `სიახლე` (tab singulars) | reference bundle — new as labels |
| `ერთ წუთში · გადახდის გარეშე`, `ჩემი კაბინეტი →` | reference bundle — new |
| `რეგისტრაცია`, `შესვლა`, `წევრობა` (back labels) | shipped page headings — splice from the target pages |

Both gates run over every touched file before commit:

```
node scripts/ka-gate.mjs --diff main <files>
npm run ka:scan
```

## 7. Testing

- **Unit (vitest, TDD — failing test first):** `mobileTabs` for all three roles with and without
  the admin item, badge pass-through, and stability when `cabinetNavItems()` order changes;
  `mobileBackTarget` for every mapped route and for unmapped routes; `mobileChrome` for the full
  route map. Component tests for each new component, matching the existing `*.test.tsx` pattern.
- **e2e (Playwright, 390×844):** the three header states render on their mapped routes; the
  tab bar shows for each role with correct tabs; `მეტი` opens and closes; the menu overlay traps
  focus and closes on Escape; no page renders two bottom bars; content is never occluded by the
  fixed bar at the bottom of a scroll.
- **Regression:** at 1280px every affected route must be visually unchanged.
- CI runs five gates; `format:check` and `build` are the ones that bite.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Fixed bar occludes page content | Clearance lives in `PageSheet`, not per page |
| Safe-area insets silently 0 | The `viewport` export is a blocking first task, verified on a real iPhone-width viewport |
| Two bottom bars on one route | Both render through `StickyBar`; an e2e assertion enforces one |
| Long Georgian labels overflow the bar | Verified at 320/360/390px; fallback is four slots, never a smaller font |
| Desktop regression | `md:` prefixes only; 1280px regression pass over every affected route |

## 9. Explicitly not doing

- No changes to any page body.
- No admin changes.
- No token, palette, or type-scale changes.
- No PWA/installability work, no offline changes, no gestures (swipe-back, pull-to-refresh
  handlers) — the browser's own behaviors are retained rather than reimplemented.
- No icons in the tab bar.
