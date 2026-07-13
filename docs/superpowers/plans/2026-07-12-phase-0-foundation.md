# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production skeleton of the "ქართული რესპუბლიკა" platform: repo + CI, Vercel/Supabase environments, Next.js app with route groups, ported design system, database schema + migrations, phone-OTP auth with dev-mode delivery, PWA shell, and the contract documents.

**Architecture:** One Next.js (App Router) app; domain logic in `lib/` (pure TS); Supabase for Postgres/auth/storage with RLS; migrations via Supabase CLI (no Docker — staging cloud project is the dev database); Vercel for hosting with per-PR previews pointed at staging.

**Tech Stack:** Next.js ≥15 + React ≥19 + TypeScript 5 (strict), Tailwind CSS 4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest + Testing Library, Playwright, Serwist (PWA), GitHub Actions, `supabase` CLI via npx.

**Spec:** `docs/superpowers/specs/2026-07-12-republic-portal-production-design.md` — binding. UX reference: `prototype/index.html` (after Task 1).

## Global Constraints

- **Install latest stable versions.** Versions in this plan are floors. If a newer major (e.g., Next 16) changes an API shown here, adapt via official migration docs; do not pin backwards.
- TypeScript `strict: true`; no `any`, no `@ts-ignore` (use `@ts-expect-error` with a reason comment if truly unavoidable).
- Domain logic lives in `lib/` as pure functions — no React/Next imports there.
- All UI text is Georgian. Palette tokens (from prototype): brand `#C8102E`, ink `#12141C`, muted `#5B616E`, surface `#F6F7F9`, line `#E4E7EC`, gold `#C9A24B`.
- Secrets never committed. `.env.local` is git-ignored; `.env.example` documents variable names only.
- Schema changes ONLY via files in `supabase/migrations/`.
- Commits: conventional style (`feat:`, `chore:`, `test:`, `docs:`), each task ends committed.
- Owner (human) steps are marked **[OWNER]** — the AI pauses and gives the owner exact click-by-click instructions, then verifies the result before continuing.
- Working directory: repo root (the git worktree created for execution). Commands are cross-shell (`npm`, `npx`, `git`, `gh`).

---

### Task 1: Owner accounts + CLI auth **[OWNER]**

No files. Deliverable: authenticated `gh` CLI; Supabase + Vercel accounts exist; credentials collected.

- [ ] **Step 1: GitHub.** Ask owner: if no GitHub account, create one at github.com (free). Then run `gh auth login` (choose GitHub.com → HTTPS → login via browser); owner completes the browser flow.
- [ ] **Step 2: Verify.** Run: `gh auth status`. Expected: `Logged in to github.com`.
- [ ] **Step 3: Supabase.** Owner creates account at supabase.com (free, sign in with GitHub is easiest) and creates **two projects** in org, region **eu-central-1 (Frankfurt)**:
  - `republic-portal-staging`
  - `republic-portal-prod`
  For each, owner saves the database password when shown. Then from **Project Settings → API**, owner copies for each project: Project URL, `anon` key, `service_role` key.
- [ ] **Step 4: Vercel.** Owner creates account at vercel.com (free Hobby, sign in with GitHub). Nothing else yet — repo connection happens in Task 11.
- [ ] **Step 5: Record locally.** Create `.env.local` at repo root (git-ignored later in Task 2 — verify before any commit that `.env.local` is never staged) with the STAGING values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
SUPABASE_SERVICE_ROLE_KEY=<staging service_role key>
NEXT_PUBLIC_APP_ENV=development
```

Keep prod values + both DB passwords in the owner's password manager, not in files.

### Task 2: Archive the prototype

**Files:**
- Move: `index.html` → `prototype/index.html`; `server.js` → `prototype/server.js`
- Create: `prototype/README.md`

- [ ] **Step 1: Move files**

```bash
mkdir -p prototype
git mv index.html prototype/index.html
git mv server.js prototype/server.js
```

- [ ] **Step 2: Create `prototype/README.md`**

```markdown
# Prototype (reference only)

`index.html` is the approved 20-screen interactive prototype — the UX contract for the
production app (screens, flows, statuses, visual system). It is not deployed.
Open by double-click, or `node server.js` (port 5599).
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: archive prototype as UX reference"
```

### Task 3: Next.js app scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/(public)/page.tsx`, `app/globals.css`, `.claude/launch.json`

**Interfaces:**
- Produces: design tokens as Tailwind utilities (`bg-brand`, `text-ink`, `text-muted-fg`, `bg-surface`, `border-line`, `text-gold`, `bg-ok/warn/danger/info`), fonts `font-sans` (Noto Sans Georgian), `font-serif` (Noto Serif Georgian). All later UI tasks consume these.

- [ ] **Step 1: `package.json`** (then `npm install` resolves latest stable)

```json
{
  "name": "republic-portal",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/ssr": "^0.6.0",
    "@supabase/supabase-js": "^2.47.0",
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "server-only": "^0.0.1",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@serwist/next": "^9.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.3.0",
    "jsdom": "^26.0.0",
    "prettier": "^3.4.0",
    "serwist": "^9.0.0",
    "sharp": "^0.33.0",
    "supabase": "^2.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Run: `npm install`. Expected: lockfile created, no errors.

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "prototype"]
}
```

- [ ] **Step 3: configs**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

`postcss.config.mjs`:

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`eslint.config.mjs`:

```js
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: [".next/**", "node_modules/**", "prototype/**", "public/sw.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
```

(If `@eslint/eslintrc` is missing after install: `npm install -D @eslint/eslintrc`.)

`.prettierrc`:

```json
{ "semi": true, "singleQuote": false, "printWidth": 100 }
```

`.gitignore`:

```
node_modules/
.next/
out/
.env*
!.env.example
*.tsbuildinfo
next-env.d.ts
test-results/
playwright-report/
public/sw.js
supabase/.temp/
.vercel/
```

`.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_ENV=development
```

- [ ] **Step 4: `app/globals.css`** — Tailwind 4 + prototype tokens

```css
@import "tailwindcss";

@theme {
  --color-brand: #c8102e;
  --color-brand-dark: #a30d26;
  --color-ink: #12141c;
  --color-muted-fg: #5b616e;
  --color-surface: #f6f7f9;
  --color-line: #e4e7ec;
  --color-gold: #c9a24b;
  --color-ok: #188038;
  --color-warn: #b45309;
  --color-danger: #b3261e;
  --color-info: #1a73e8;
  --font-sans: var(--font-noto-sans-georgian), "Sylfaen", "Segoe UI", system-ui, sans-serif;
  --font-serif: var(--font-noto-serif-georgian), "Sylfaen", Georgia, serif;
}

body {
  @apply bg-white text-ink font-sans antialiased;
}
```

- [ ] **Step 5: `app/layout.tsx`** — fonts + shell

```tsx
import type { Metadata } from "next";
import { Noto_Sans_Georgian, Noto_Serif_Georgian } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-sans-georgian",
});
const notoSerif = Noto_Serif_Georgian({
  subsets: ["georgian"],
  variable: "--font-noto-serif-georgian",
});

export const metadata: Metadata = {
  title: "ქართული რესპუბლიკა",
  description: "სამოქალაქო პლატფორმა",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body className={`${notoSans.variable} ${notoSerif.variable}`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: `app/(public)/page.tsx`** — placeholder home proving tokens work

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="font-serif text-5xl font-bold text-brand">ქართული რესპუბლიკა</h1>
      <p className="mt-4 text-lg text-muted-fg">პლატფორმა მშენებლობის პროცესშია.</p>
    </main>
  );
}
```

- [ ] **Step 7: `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "portal-dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

- [ ] **Step 8: Verify.** Run `npm run typecheck` (expected: exit 0), `npm run lint` (exit 0), then start the `portal-dev` preview server and load `http://localhost:3000` — expected: red serif "ქართული რესპუბლიკა" heading in Georgian font.
- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with design tokens and Georgian fonts"
```

### Task 4: Contract documents

**Files:**
- Create: `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `DESIGN.md`

- [ ] **Step 1: `CLAUDE.md`**

```markdown
# CLAUDE.md — working rules for this repo

## What this is
Production app for "ქართული რესპუბლიკა" (Georgian civic platform).
Spec: docs/superpowers/specs/2026-07-12-republic-portal-production-design.md
UX contract: prototype/index.html. Decisions log: DECISIONS.md (append-only).

## Process (non-negotiable)
- Every feature: spec → plan (docs/superpowers/plans/) → TDD → code review (Claude + /codex review)
  → /qa on preview → OWNER sign-off on the Vercel preview link → merge.
- Owner writes zero code and reads no code. All evidence for sign-off must be
  plain-language + screenshots + a preview URL.
- Never merge with failing CI. Never push directly to main.

## Code rules
- TypeScript strict. No `any`, no `@ts-ignore`.
- Domain logic = pure functions in `lib/` (no React/Next imports). UI components in
  `components/`. Route groups: app/(public), app/(member), app/(delegate), app/(admin).
- All user-facing text in Georgian. Reuse design-system components (DESIGN.md) — never
  restyle ad hoc.
- Validation with zod at every boundary (form + API). Server is the source of truth.
- Database: schema changes only via supabase/migrations/. Never mutate data by hand.
- Auth: Supabase only. Authorization checked server-side on every mutation + RLS in DB.
  Client-side checks are UX, not security.
- Admin mutations must write to audit_log.
- Secrets only in env vars. `.env.local` is never committed.

## Forbidden patterns
- Storing derivable values (e.g., supporter counts) as editable columns.
- Fetching with service-role key in any code path reachable without a server-side role check.
- Skipping the failing-test step of TDD. Copy-pasting components instead of extracting.
- Adding dependencies without recording why in DECISIONS.md.
```

- [ ] **Step 2: `ARCHITECTURE.md`**

```markdown
# Architecture

One Next.js App Router app. Public pages server-rendered (SEO/OG); cabinets/admin are
authed client views. Supabase = Postgres + phone-OTP auth + storage, RLS on everything.
Vercel hosts; every PR gets a preview deployment pointed at the STAGING Supabase project.

## Layout
- app/(public|member|delegate|admin)/ — route groups per area; each protected group has a
  layout.tsx that enforces auth + role server-side.
- lib/ — pure domain logic (validation, status derivation, ranking). Unit-tested.
- lib/supabase/ — client factories: client.ts (browser, anon), server.ts (SSR, cookies),
  admin.ts (service-role, server-only).
- components/ — design-system components (see DESIGN.md).
- supabase/migrations/ — the only way schema changes.
- e2e/ — Playwright; critical flows must stay green.

## Environments
- production: republic-portal-prod Supabase + Vercel production.
- staging: republic-portal-staging Supabase + all Vercel previews + local dev + CI e2e.

## Auth flow
Phone → supabase.auth.signInWithOtp → Send-SMS hook (Postgres fn) delivers code:
dev/staging writes to dev_otp_inbox (surfaced on-screen); production will call a Georgian
SMS provider (Phase 6). verifyOtp creates the session (cookie via @supabase/ssr middleware).

## Status derivation
Member/delegate statuses and supporter counts are always computed from source tables
(payments, memberships) by functions in lib/ — never stored as editable state.
```

- [ ] **Step 3: `DECISIONS.md`**

```markdown
# Decisions (append-only ADR log)

## ADR-001 (2026-07-12): Stack = Next.js + TypeScript + Supabase + Vercel
AI is the only engineer → choose the stack AI is most fluent in. Supabase gives Postgres,
phone-OTP auth with pluggable SMS hook, storage, RLS. Vercel gives per-PR previews (the
owner sign-off mechanism). Alternatives: Django (fights PWA/interactive funnel), SvelteKit
(less AI fluency).

## ADR-002 (2026-07-12): PWA-first mobile; Capacitor wrap later
One codebase. Store apps only when presence matters — no rewrite required.

## ADR-003 (2026-07-12): v1 payments are manual bank transfers
Finance admin records transfers matched by per-member reference codes; statuses derive
from recorded payments. A gateway later is just another `source` value.

## ADR-004 (2026-07-12): Staged OTP delivery
Send-SMS hook architecture from day one; dev/staging delivers to dev_otp_inbox
(on-screen); production switches the hook to a Georgian SMS provider before launch.

## ADR-005 (2026-07-12): No Docker; staging cloud project is the dev database
Owner machine stays simple. Migrations via supabase CLI against staging, then prod.
Unit tests never touch the DB (pure lib/); e2e runs against staging.

## ADR-006 (2026-07-12): Personal IDs rely on platform at-rest encryption + RLS + audit
Column-level encryption deferred; revisit at Phase 6 /cso audit before public launch.
```

- [ ] **Step 4: `DESIGN.md`**

```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md ARCHITECTURE.md DECISIONS.md DESIGN.md
git commit -m "docs: add contract documents (conventions, architecture, ADRs, design system)"
```

### Task 5: Unit-test infra + first domain module (TDD)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `lib/validation.ts`, `lib/validation.test.ts`

**Interfaces:**
- Produces: `validatePersonalId(value: string): boolean` (exactly 11 digits); `normalizeGeorgianPhone(value: string): string | null` (returns E.164 `+9955XXXXXXXX` for Georgian mobiles, null if invalid). Consumed by the funnel (Phase 2) and login (Task 10).

- [ ] **Step 1: `vitest.config.ts` + `vitest.setup.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  esbuild: { jsx: "automatic" },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Write failing tests — `lib/validation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { normalizeGeorgianPhone, validatePersonalId } from "./validation";

describe("validatePersonalId", () => {
  it("accepts exactly 11 digits", () => {
    expect(validatePersonalId("01001012345")).toBe(true);
  });
  it("rejects wrong length, letters, spaces", () => {
    expect(validatePersonalId("0100101234")).toBe(false);
    expect(validatePersonalId("010010123456")).toBe(false);
    expect(validatePersonalId("0100101234a")).toBe(false);
    expect(validatePersonalId("01001 12345")).toBe(false);
    expect(validatePersonalId("")).toBe(false);
  });
});

describe("normalizeGeorgianPhone", () => {
  it("normalizes local mobile formats to E.164", () => {
    expect(normalizeGeorgianPhone("555 12 34 56")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("595123456")).toBe("+995595123456");
    expect(normalizeGeorgianPhone("+995 555 123 456")).toBe("+995555123456");
    expect(normalizeGeorgianPhone("995555123456")).toBe("+995555123456");
  });
  it("rejects non-mobile or malformed numbers", () => {
    expect(normalizeGeorgianPhone("032 2 123456")).toBeNull();
    expect(normalizeGeorgianPhone("12345")).toBeNull();
    expect(normalizeGeorgianPhone("+15551234567")).toBeNull();
    expect(normalizeGeorgianPhone("")).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure.** Run: `npm run test`. Expected: FAIL — cannot resolve `./validation`.
- [ ] **Step 4: Implement `lib/validation.ts`**

```ts
export function validatePersonalId(value: string): boolean {
  return /^\d{11}$/.test(value);
}

/**
 * Georgian mobile numbers: 9 digits starting with 5 (e.g. 5XX XXX XXX).
 * Accepts local, 995-prefixed, and +995-prefixed input with any spacing.
 * Returns E.164 (+9955XXXXXXXX) or null.
 */
export function normalizeGeorgianPhone(value: string): string | null {
  const digits = value.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  let national: string;
  if (digits.startsWith("995")) national = digits.slice(3);
  else national = digits;
  if (!/^5\d{8}$/.test(national)) return null;
  return `+995${national}`;
}
```

- [ ] **Step 5: Run to verify pass.** Run: `npm run test`. Expected: all tests PASS.
- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts vitest.setup.ts lib/validation.ts lib/validation.test.ts
git commit -m "feat: unit-test infrastructure and phone/personal-id validation (TDD)"
```

### Task 6: Design-system components + styleguide

**Files:**
- Create: `components/Button.tsx`, `components/Card.tsx`, `components/StatCard.tsx`, `components/Pill.tsx`, `components/Field.tsx`, `components/Stepper.tsx`, `components/design-system.test.tsx`, `app/(public)/styleguide/page.tsx`

**Interfaces:**
- Produces (exact props consumed by ALL later UI work):
  - `Button({ variant?: "primary"|"ghost"|"danger", ...native button props })`
  - `Card({ title?: string, children })`
  - `StatCard({ label: string, value: number|string })`
  - `Pill({ status: "draft"|"profile_completed"|"active_member"|"pending"|"approved"|"rejected" })` — renders the Georgian label itself
  - `Field({ label: string, error?: string, ...native input props })`
  - `Stepper({ current: 1|2|3 })`

- [ ] **Step 1: Write failing tests — `components/design-system.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Field } from "./Field";
import { Pill } from "./Pill";
import { StatCard } from "./StatCard";
import { Stepper } from "./Stepper";

describe("Button", () => {
  it("renders primary variant with brand styling by default", () => {
    render(<Button>გაგრძელება</Button>);
    const btn = screen.getByRole("button", { name: "გაგრძელება" });
    expect(btn.className).toContain("bg-brand");
  });
  it("renders danger variant", () => {
    render(<Button variant="danger">წაშლა</Button>);
    expect(screen.getByRole("button", { name: "წაშლა" }).className).toContain("bg-danger");
  });
});

describe("Pill", () => {
  it("maps status to Georgian label", () => {
    render(<Pill status="active_member" />);
    expect(screen.getByText("აქტიური წევრი")).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("shows label and value", () => {
    render(<StatCard label="აქტიური წევრი" value={1700} />);
    expect(screen.getByText("1700")).toBeInTheDocument();
    expect(screen.getByText("აქტიური წევრი")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("links label to input and shows error text", () => {
    render(<Field label="ტელეფონი" name="phone" error="სავალდებულოა" />);
    expect(screen.getByLabelText("ტელეფონი")).toBeInTheDocument();
    expect(screen.getByText("სავალდებულოა")).toBeInTheDocument();
  });
});

describe("Stepper", () => {
  it("marks the current step", () => {
    render(<Stepper current={2} />);
    expect(screen.getByText("2").getAttribute("aria-current")).toBe("step");
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npm run test`. Expected: FAIL — modules not found.
- [ ] **Step 3: Implement the six components**

`components/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  ghost: "bg-transparent text-ink border border-line hover:bg-surface",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
```

`components/Card.tsx`:

```tsx
import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-6 shadow-sm">
      {title ? <h3 className="mb-4 text-base font-bold text-ink">{title}</h3> : null}
      {children}
    </section>
  );
}
```

`components/StatCard.tsx`:

```tsx
export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-6 text-center shadow-sm">
      <div className="text-4xl font-bold text-brand">{value}</div>
      <div className="mt-1 text-sm text-muted-fg">{label}</div>
    </div>
  );
}
```

`components/Pill.tsx`:

```tsx
type Status =
  | "draft"
  | "profile_completed"
  | "active_member"
  | "pending"
  | "approved"
  | "rejected";

const config: Record<Status, { label: string; className: string }> = {
  draft: { label: "მონახაზი", className: "bg-surface text-muted-fg" },
  profile_completed: { label: "პროფილი შევსებულია", className: "bg-info/10 text-info" },
  active_member: { label: "აქტიური წევრი", className: "bg-ok/10 text-ok" },
  pending: { label: "განხილვის პროცესში", className: "bg-warn/10 text-warn" },
  approved: { label: "დამტკიცებული", className: "bg-ok/10 text-ok" },
  rejected: { label: "უარყოფილი", className: "bg-danger/10 text-danger" },
};

export function Pill({ status }: { status: Status }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
```

`components/Field.tsx`:

```tsx
import { useId, type InputHTMLAttributes } from "react";

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-brand ${
          error ? "border-danger" : "border-line"
        }`}
        {...props}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
```

`components/Stepper.tsx`:

```tsx
const labels = ["კონტაქტი", "პროფილი", "წევრობა"] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-4">
      {labels.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                active ? "bg-brand text-white" : done ? "bg-ok text-white" : "bg-surface text-muted-fg"
              }`}
            >
              {step}
            </span>
            <span className={`text-sm ${active ? "font-semibold text-ink" : "text-muted-fg"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Run to verify pass.** Run: `npm run test`. Expected: all PASS.
- [ ] **Step 5: `app/(public)/styleguide/page.tsx`** — visible gallery for owner review

```tsx
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Pill } from "@/components/Pill";
import { StatCard } from "@/components/StatCard";
import { Stepper } from "@/components/Stepper";

export default function StyleguidePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <h1 className="font-serif text-3xl font-bold text-brand">დიზაინ-სისტემა</h1>
      <Card title="ღილაკები">
        <div className="flex gap-3">
          <Button>ძირითადი</Button>
          <Button variant="ghost">მეორადი</Button>
          <Button variant="danger">საშიში</Button>
        </div>
      </Card>
      <Card title="სტატუსები">
        <div className="flex flex-wrap gap-2">
          <Pill status="draft" />
          <Pill status="profile_completed" />
          <Pill status="active_member" />
          <Pill status="pending" />
          <Pill status="approved" />
          <Pill status="rejected" />
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="დამტკიცებული დელეგატი" value={112} />
        <StatCard label="აქტიური წევრი" value={1700} />
      </div>
      <Card title="ფორმის ველი">
        <Field label="ტელეფონის ნომერი" name="phone" placeholder="5XX XX XX XX" />
      </Card>
      <Card title="სტეპერი">
        <Stepper current={2} />
      </Card>
    </main>
  );
}
```

(`Field` uses `useId` — if the build complains about a server component, add `"use client";` as the first line of `Field.tsx`.)

- [ ] **Step 6: Verify visually.** With the `portal-dev` preview server running, load `http://localhost:3000/styleguide`. Expected: all components render, Georgian labels, brand red primary button.
- [ ] **Step 7: Commit**

```bash
git add components app/\(public\)/styleguide
git commit -m "feat: port design-system components from prototype with tests + styleguide"
```

### Task 7: PWA shell

**Files:**
- Create: `app/manifest.ts`, `scripts/generate-icons.mjs`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `app/sw.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Icon generator — `scripts/generate-icons.mjs`**

```js
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#C8102E"/>
  <text x="50%" y="54%" font-family="Noto Sans Georgian, Sylfaen, sans-serif"
        font-size="220" font-weight="700" fill="#FFFFFF"
        text-anchor="middle" dominant-baseline="middle">ქრ</text>
</svg>`;

mkdirSync("public/icons", { recursive: true });
await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");
console.log("icons written");
```

Run: `node scripts/generate-icons.mjs`. Expected: `icons written`, three PNGs exist.

- [ ] **Step 2: `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ქართული რესპუბლიკა",
    short_name: "რესპუბლიკა",
    description: "სამოქალაქო პლატფორმა",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#C8102E",
    lang: "ka",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- [ ] **Step 3: Serwist service worker.** `app/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist, type PrecacheEntry } from "serwist";

declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
```

(If Serwist's current docs differ — check https://serwist.pages.dev — follow the docs, keep `swSrc`/`swDest` paths.)

- [ ] **Step 4: Verify.** Run: `npm run build`. Expected: build succeeds, `public/sw.js` generated. Run `npm run typecheck`. Expected: exit 0. (If `tsc` complains about `app/sw.ts` worker types, add `"webworker"` to tsconfig `lib` array.)
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: PWA shell (manifest, icons, Serwist service worker)"
```

### Task 8: GitHub repo + CI **[OWNER for repo settings]**

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/pull_request_template.md`

- [ ] **Step 1: `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.STAGING_SUPABASE_SERVICE_ROLE_KEY }}
      NEXT_PUBLIC_APP_ENV: preview
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
        if: hashFiles('playwright.config.ts') != ''
      - run: npm run e2e
        if: hashFiles('playwright.config.ts') != ''
        env: { CI: "true" }
```

- [ ] **Step 2: `.github/pull_request_template.md`**

```markdown
## რა შეიცვალა / What changed

## Preview
Vercel preview: <!-- link appears automatically -->

## Owner sign-off
- [ ] Owner clicked through the preview and approved

## Quality
- [ ] TDD followed (tests written first)
- [ ] Claude review + /codex review passed
```

- [ ] **Step 3: Create the private repo and push.** Run:

```bash
git add .github
git commit -m "chore: CI pipeline and PR template"
gh repo create republic-portal --private --source=. --push
```

Expected: repo created, branch pushed. (This pushes the current branch; merge to `main` per the finishing-a-development-branch skill, then `git push -u origin main`.)

- [ ] **Step 4: CI secrets.** Run (values from `.env.local`):

```bash
gh secret set STAGING_SUPABASE_URL --body "<staging url>"
gh secret set STAGING_SUPABASE_ANON_KEY --body "<staging anon key>"
gh secret set STAGING_SUPABASE_SERVICE_ROLE_KEY --body "<staging service role key>"
```

- [ ] **Step 5 [OWNER]: Branch protection.** Owner, on github.com → repo → Settings → Branches → Add branch ruleset: name `main-protection`, target `main`, enable "Require a pull request before merging" and "Require status checks to pass" → select `quality`. (The e2e steps are guarded by `hashFiles('playwright.config.ts')` and skip harmlessly until Task 10 adds Playwright.)
- [ ] **Step 6: Verify.** Run: `gh run watch` on the latest run (or `gh run list`). Expected: `quality` green on the pushed branch (e2e steps skipped until Task 10).

### Task 9: Database schema + migrations (staging, then prod)

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/migrations/<timestamp>_initial_schema.sql`, `supabase/migrations/<timestamp>_seed_regions.sql`, `scripts/verify-schema.mjs`

**Interfaces:**
- Produces tables consumed by all later phases: `profiles`, `delegates`, `memberships`, `payments`, `admin_roles`, `audit_log`, `regions`, `cities`, `dev_otp_inbox`; enums `member_status`, `delegate_status`; function `public.send_sms_hook(jsonb)`. (Tables for polls/news/events are added in Phase 5 migrations — intentionally not created now.)

- [ ] **Step 1: Init + link.** Run:

```bash
npx supabase init
npx supabase link --project-ref <staging-ref>
```

(`<staging-ref>` = subdomain of the staging URL. The CLI asks for the staging DB password — owner supplies it interactively.)

- [ ] **Step 2: Create migration.** Run: `npx supabase migration new initial_schema`, then fill the generated file:

```sql
-- Enums
create type member_status as enum ('draft', 'profile_completed', 'active_member');
create type delegate_status as enum ('pending', 'approved', 'rejected');

-- Reference data
create table regions (
  id serial primary key,
  name_ka text not null unique
);
create table cities (
  id serial primary key,
  region_id int not null references regions(id),
  name_ka text not null,
  unique (region_id, name_ka)
);

-- People
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text unique,
  personal_id text unique check (personal_id ~ '^\d{11}$'),
  birth_date date,
  region_id int references regions(id),
  city_id int references cities(id),
  employment text,
  status member_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table delegates (
  id uuid primary key references profiles(id) on delete cascade,
  status delegate_status not null default 'pending',
  referral_code text not null unique,
  bio text,
  photo_url text,
  tc_accepted_at timestamptz not null,
  verified_at timestamptz,
  verified_by uuid references profiles(id)
);

create table memberships (
  id bigserial primary key,
  member_id uuid not null references profiles(id) on delete cascade,
  delegate_id uuid references delegates(id),  -- null = "ცენტრალური მოძრაობა"
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index one_active_membership on memberships (member_id) where ended_at is null;

create table payments (
  id bigserial primary key,
  member_id uuid not null references profiles(id),
  amount_gel numeric(10,2) not null check (amount_gel > 0),
  paid_at date not null,
  bank_reference text,
  source text not null default 'manual',
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table admin_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('super_admin', 'verifier', 'finance', 'editor')),
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Append-only audit log
create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();

-- updated_at maintenance
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Dev OTP delivery (Send-SMS auth hook writes here in dev/staging)
create table dev_otp_inbox (
  id bigserial primary key,
  phone text not null,
  otp text not null,
  created_at timestamptz not null default now()
);

create function public.send_sms_hook(event jsonb) returns jsonb
language plpgsql security definer as $$
begin
  insert into dev_otp_inbox (phone, otp)
  values (event->'user'->>'phone', event->'sms'->>'otp');
  return '{}'::jsonb;
end $$;
grant execute on function public.send_sms_hook to supabase_auth_admin;
revoke execute on function public.send_sms_hook from authenticated, anon, public;
grant insert on dev_otp_inbox to supabase_auth_admin;
grant usage, select on sequence dev_otp_inbox_id_seq to supabase_auth_admin;

-- RLS: enabled everywhere; minimal Phase-0 policies (admin flows get policies in Phase 4)
alter table regions enable row level security;
alter table cities enable row level security;
alter table profiles enable row level security;
alter table delegates enable row level security;
alter table memberships enable row level security;
alter table payments enable row level security;
alter table admin_roles enable row level security;
alter table audit_log enable row level security;
alter table dev_otp_inbox enable row level security;

create policy "regions readable by all" on regions for select using (true);
create policy "cities readable by all" on cities for select using (true);
create policy "approved delegates are public" on delegates for select using (status = 'approved');
create policy "own profile readable" on profiles for select using (auth.uid() = id);
create policy "own profile updatable" on profiles for update using (auth.uid() = id);
create policy "own memberships readable" on memberships for select using (auth.uid() = member_id);
create policy "own payments readable" on payments for select using (auth.uid() = member_id);
-- audit_log, admin_roles, dev_otp_inbox: no client policies (service-role/hook only)
```

**Before applying:** verify the Send-SMS hook payload shape against current Supabase docs (https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook — WebFetch it). The insert must match the documented `event` JSON (expected: `user.phone` and `sms.otp`). Adjust if docs differ.

- [ ] **Step 3: Seed migration.** Run `npx supabase migration new seed_regions`, fill:

```sql
insert into regions (name_ka) values
  ('თბილისი'), ('აჭარა'), ('იმერეთი'), ('კახეთი'), ('ქვემო ქართლი'),
  ('სამეგრელო-ზემო სვანეთი'), ('სამცხე-ჯავახეთი'), ('გურია'),
  ('მცხეთა-მთიანეთი'), ('რაჭა-ლეჩხუმი და ქვემო სვანეთი'), ('შიდა ქართლი');

insert into cities (region_id, name_ka)
select r.id, c.name from regions r
join (values
  ('თბილისი', 'თბილისი'),
  ('აჭარა', 'ბათუმი'), ('აჭარა', 'ქობულეთი'), ('აჭარა', 'ხულო'),
  ('იმერეთი', 'ქუთაისი'), ('იმერეთი', 'ზესტაფონი'), ('იმერეთი', 'სამტრედია'), ('იმერეთი', 'ჭიათურა'),
  ('კახეთი', 'თელავი'), ('კახეთი', 'გურჯაანი'), ('კახეთი', 'სიღნაღი'), ('კახეთი', 'ყვარელი'),
  ('ქვემო ქართლი', 'რუსთავი'), ('ქვემო ქართლი', 'მარნეული'), ('ქვემო ქართლი', 'ბოლნისი'), ('ქვემო ქართლი', 'გარდაბანი'),
  ('სამეგრელო-ზემო სვანეთი', 'ზუგდიდი'), ('სამეგრელო-ზემო სვანეთი', 'ფოთი'), ('სამეგრელო-ზემო სვანეთი', 'სენაკი'), ('სამეგრელო-ზემო სვანეთი', 'მესტია'),
  ('სამცხე-ჯავახეთი', 'ახალციხე'), ('სამცხე-ჯავახეთი', 'ბორჯომი'), ('სამცხე-ჯავახეთი', 'ახალქალაქი'),
  ('გურია', 'ოზურგეთი'), ('გურია', 'ლანჩხუთი'), ('გურია', 'ჩოხატაური'),
  ('მცხეთა-მთიანეთი', 'მცხეთა'), ('მცხეთა-მთიანეთი', 'დუშეთი'), ('მცხეთა-მთიანეთი', 'სტეფანწმინდა'),
  ('რაჭა-ლეჩხუმი და ქვემო სვანეთი', 'ამბროლაური'), ('რაჭა-ლეჩხუმი და ქვემო სვანეთი', 'ონი'), ('რაჭა-ლეჩხუმი და ქვემო სვანეთი', 'ცაგერი'), ('რაჭა-ლეჩხუმი და ქვემო სვანეთი', 'ლენტეხი'),
  ('შიდა ქართლი', 'გორი'), ('შიდა ქართლი', 'ხაშური'), ('შიდა ქართლი', 'ქარელი'), ('შიდა ქართლი', 'კასპი')
) as c(region, name) on r.name_ka = c.region;
```

- [ ] **Step 4: Apply to staging.** Run: `npx supabase db push`. Expected: both migrations applied without error.
- [ ] **Step 5: Verification script — `scripts/verify-schema.mjs`**

```js
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, key);

const { count: regionCount, error: e1 } = await db
  .from("regions")
  .select("*", { count: "exact", head: true });
if (e1) throw e1;
if (regionCount !== 11) throw new Error(`expected 11 regions, got ${regionCount}`);

const { count: cityCount, error: e2 } = await db
  .from("cities")
  .select("*", { count: "exact", head: true });
if (e2) throw e2;
if (cityCount < 30) throw new Error(`expected ≥30 cities, got ${cityCount}`);

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: leak } = await anon.from("dev_otp_inbox").select("*").limit(1);
if (leak && leak.length > 0) throw new Error("RLS FAILURE: anon can read dev_otp_inbox");

console.log(`OK: ${regionCount} regions, ${cityCount} cities, RLS holding`);
```

Run: `node --env-file=.env.local scripts/verify-schema.mjs`. Expected: `OK: 11 regions, ... RLS holding`.

- [ ] **Step 6: Apply to prod.** Run: `npx supabase link --project-ref <prod-ref>` (owner supplies prod DB password), `npx supabase db push`, then re-link staging: `npx supabase link --project-ref <staging-ref>`.
- [ ] **Step 7: Commit**

```bash
git add supabase scripts/verify-schema.mjs
git commit -m "feat: initial database schema, RLS, seed data, dev OTP hook"
```

### Task 10: Auth skeleton + e2e infrastructure **[OWNER for dashboard toggles]**

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `app/(public)/login/page.tsx`, `app/api/dev/otp/route.ts`, `app/(member)/layout.tsx`, `app/(member)/me/profile/page.tsx`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/login.spec.ts`

**Interfaces:**
- Consumes: `normalizeGeorgianPhone` from `lib/validation.ts` (Task 5); `Button`, `Field` from Task 6; `dev_otp_inbox` + `send_sms_hook` from Task 9.
- Produces: `createClient()` (browser), `createServerSupabase()` (RSC/route handlers), `createAdminClient()` (service-role, server-only), middleware session refresh. Protected-layout pattern that Phases 2–4 copy.

- [ ] **Step 1 [OWNER]: Enable phone auth + hook (staging first, then prod).** Owner, in the Supabase dashboard for `republic-portal-staging`:
  1. Authentication → Sign In / Up → Phone: **enable**.
  2. Authentication → Hooks → "Send SMS hook" → **Postgres function** → schema `public`, function `send_sms_hook` → enable.
  3. Authentication → Rate Limits: raise SMS/OTP limit to a value comfortable for testing (e.g., 100/hour).
  Repeat all three for `republic-portal-prod` later at Phase 6 (not now — prod keeps phone auth disabled until launch hardening).
- [ ] **Step 2: Supabase client factories**

`lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

`lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions instead
          }
        },
      },
    }
  );
}
```

`lib/supabase/admin.ts`:

```ts
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

`lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  await supabase.auth.getUser();
  return response;
}
```

`middleware.ts` (repo root):

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)"],
};
```

- [ ] **Step 3: Login page — `app/(public)/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Card } from "@/components/Card";
import { createClient } from "@/lib/supabase/client";
import { normalizeGeorgianPhone } from "@/lib/validation";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string>();
  const [devOtp, setDevOtp] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(undefined);
    const normalized = normalizeGeorgianPhone(phoneInput);
    if (!normalized) {
      setError("შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (err) {
      setError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(normalized);
    setPhase("otp");
    if (process.env.NEXT_PUBLIC_APP_ENV !== "production") {
      const res = await fetch(`/api/dev/otp?phone=${encodeURIComponent(normalized)}`);
      if (res.ok) setDevOtp((await res.json()).otp);
    }
  }

  async function verify() {
    setError(undefined);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setBusy(false);
    if (err) {
      setError("კოდი არასწორია");
      return;
    }
    router.push("/me/profile");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <Card title="შესვლა">
        {phase === "phone" ? (
          <div className="flex flex-col gap-4">
            <Field
              label="ტელეფონის ნომერი"
              name="phone"
              placeholder="5XX XX XX XX"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              error={error}
            />
            <Button onClick={requestOtp} disabled={busy}>
              კოდის მიღება
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field
              label="SMS კოდი"
              name="otp"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              error={error}
            />
            {devOtp ? (
              <p className="rounded-lg bg-surface p-3 text-sm text-muted-fg" data-testid="dev-otp">
                სატესტო კოდი: <strong>{devOtp}</strong>
              </p>
            ) : null}
            <Button onClick={verify} disabled={busy}>
              დადასტურება
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Dev OTP endpoint — `app/api/dev/otp/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const admin = createAdminClient();
  // hook stores phone without '+'; retry briefly because the hook runs async of the request
  const stripped = phone.replace(/^\+/, "");
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await admin
      .from("dev_otp_inbox")
      .select("otp, created_at")
      .in("phone", [phone, stripped])
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return NextResponse.json({ otp: data[0]!.otp });
    await new Promise((r) => setTimeout(r, 500));
  }
  return NextResponse.json({ error: "no otp" }, { status: 404 });
}
```

- [ ] **Step 5: Protected area placeholder.** `app/(member)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <div className="mx-auto max-w-4xl px-6 py-10">{children}</div>;
}
```

`app/(member)/me/profile/page.tsx`:

```tsx
import { Card } from "@/components/Card";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <Card title="ჩემი პროფილი">
      <p className="text-sm text-muted-fg" data-testid="profile-phone">
        ტელეფონი: {user?.phone ?? "—"}
      </p>
      <p className="mt-2 text-sm text-muted-fg">პროფილის სრული ფუნქციონალი მალე დაემატება.</p>
    </Card>
  );
}
```

- [ ] **Step 6: Playwright config + tests**

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`e2e/smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("home renders in Georgian", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ქართული რესპუბლიკა" })).toBeVisible();
});

test("styleguide renders design system", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("button", { name: "ძირითადი" })).toBeVisible();
  await expect(page.getByText("აქტიური წევრი").first()).toBeVisible();
});

test("member area redirects anonymous users to login", async ({ page }) => {
  await page.goto("/me/profile");
  await expect(page).toHaveURL(/\/login/);
});
```

`e2e/login.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const TEST_PHONE = "599123123"; // staging-only; hook delivers OTP to dev_otp_inbox

test("phone OTP login end-to-end (dev delivery)", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ტელეფონის ნომერი").fill(TEST_PHONE);
  await page.getByRole("button", { name: "კოდის მიღება" }).click();
  const devOtp = page.getByTestId("dev-otp");
  await expect(devOtp).toBeVisible({ timeout: 15_000 });
  const otp = (await devOtp.locator("strong").innerText()).trim();
  await page.getByLabel("SMS კოდი").fill(otp);
  await page.getByRole("button", { name: "დადასტურება" }).click();
  await expect(page).toHaveURL(/\/me\/profile/);
  await expect(page.getByTestId("profile-phone")).toContainText("995599123123");
});
```

- [ ] **Step 7: Run e2e locally.** Run: `npx playwright install chromium` then `npm run e2e`. Expected: 4 tests pass. (Requires `.env.local` staging values; if login test fails on OTP delivery, check the hook is enabled — Step 1 — and inspect `dev_otp_inbox` rows in the Supabase table editor.)
- [ ] **Step 8: Run all gates.** Run: `npm run typecheck && npm run lint && npm run test && npm run build`. Expected: all exit 0.
- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: phone-OTP auth skeleton with dev delivery, protected layout, e2e suite"
```

### Task 11: Vercel connection + deployments **[OWNER]**

No repo files (Vercel is configured via dashboard). Deliverable: production URL live; PR previews working against staging.

- [ ] **Step 1 [OWNER]: Import repo.** Owner, on vercel.com → Add New → Project → Import `republic-portal` (grant Vercel access to the GitHub repo when prompted). Framework preset: Next.js — accept defaults. Click Deploy (first build may fail until env vars are set — that's fine).
- [ ] **Step 2 [OWNER]: Environment variables.** Project → Settings → Environment Variables:
  - Scope **Production**: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` = **prod** project values; `NEXT_PUBLIC_APP_ENV` = `production`.
  - Scope **Preview** (and **Development**): same variables = **staging** values; `NEXT_PUBLIC_APP_ENV` = `preview`.
- [ ] **Step 3: Redeploy + verify production.** Trigger redeploy (Deployments → ⋯ → Redeploy). Expected: build succeeds; `https://republic-portal-<owner>.vercel.app/` shows the Georgian home page; `/styleguide` renders; `/login` on production shows NO test-code box (env is production; OTP endpoint 404s — full login stays dark until Phase 6 enables prod phone auth).
- [ ] **Step 4: Verify PR preview flow.** Push a trivial branch (e.g., change home page copy), open a PR: `gh pr create --fill`. Expected: Vercel bot comments a preview URL; preview `/login` DOES show the dev test-code box and full login works against staging. This preview-link-in-PR is the owner's sign-off mechanism from now on.
- [ ] **Step 5 [OWNER]: Enable branch protection now** (per Task 8 Step 5) if it wasn't enabled yet — CI is fully green at this point.
- [ ] **Step 6: Merge the test PR** once owner approves it in the PR (their first real sign-off), or close it if the copy change isn't wanted.

### Task 12: Phase 0 wrap-up

**Files:**
- Create: `README.md`, `CHANGELOG.md`

- [ ] **Step 1: `README.md`**

```markdown
# ქართული რესპუბლიკა — platform

Production app. Owner + AI collaboration; see CLAUDE.md for working rules,
ARCHITECTURE.md for structure, DECISIONS.md for the ADR log, DESIGN.md for UI rules.

## Quickstart (AI sessions)
1. `npm install`
2. `.env.local` from `.env.example` (staging values — ask owner's password manager)
3. `npm run dev` → http://localhost:3000 (or the `portal-dev` launch config)
4. Gates: `npm run typecheck && npm run lint && npm run test && npm run e2e`

## Environments
- Production: Vercel production + republic-portal-prod Supabase (phone auth OFF until Phase 6)
- Staging: all PR previews + local dev + CI → republic-portal-staging Supabase

## Deploy
Merge to main → Vercel auto-deploys production. Migrations: `npx supabase db push`
(staging first, then prod). Never edit schema outside supabase/migrations/.
```

- [ ] **Step 2: `CHANGELOG.md`**

```markdown
# Changelog

## 0.1.0 — Phase 0: Foundation
- Next.js + TypeScript app with Georgian design system (tokens, 6 components, /styleguide)
- Supabase schema v1: profiles, delegates, memberships, payments, admin_roles, audit_log
  (append-only), regions/cities seed, RLS everywhere
- Phone-OTP auth with dev-mode delivery (Send-SMS hook → dev_otp_inbox)
- PWA shell (manifest, icons, service worker)
- CI (typecheck, lint, format, unit, build, e2e) + branch-protected main
- Vercel: production + per-PR previews pointed at staging
```

- [ ] **Step 3: Final verification sweep.** Run the full local gate (`npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build && npm run e2e`), confirm CI green on GitHub, production URL renders, one PR preview demonstrated. Use superpowers:verification-before-completion.
- [ ] **Step 4: Commit, PR, owner sign-off**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: README and changelog for Phase 0"
```

Open the Phase 0 PR (if work was on a branch throughout, this is the existing PR), post the preview URL + plain-language summary of everything the owner can click (home, /styleguide, /login flow on preview), and request owner sign-off. Merge only after approval. Tag: `git tag v0.1.0 && git push --tags`.

---

## Self-review notes (completed)

- **Spec coverage:** repo+CI (T8), environments (T1/T9/T11), app skeleton + route groups (T3/T10), design system (T3/T6), schema+migrations (T9), auth skeleton with dev OTP (T10), PWA (T7), contract docs (T4), owner human tasks (T1, T8.5, T10.1, T11). Polls/news/events tables intentionally deferred to Phase 5 (noted in T9 interfaces).
- **Known judgment calls:** send-SMS hook payload shape must be verified against live Supabase docs (explicit step in T9); Serwist API drift handled by doc pointer (T7); branch-protection timing note (T8 Step 5) avoids a red-CI deadlock.
