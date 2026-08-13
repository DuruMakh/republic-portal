# Authentication Entry-Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse Google login and registration screens with the approved guided Kronika experience while preserving every existing Google, Supabase, Verify.ge, registration, referral, and redirect behavior.

**Architecture:** Add one reusable editorial auth shell and one semantic three-step progress component, then place the existing login and registration state machines inside that shell. Keep `GoogleJoinForm` as the owner of all auth/phone state and keep `GoogleAuthButton` as the owner of OAuth; this change only reorganizes presentation and provider branding. The official Google mark is stored locally, and the public layout, `PageSheet`, `Masthead`, footer, fields, OTP control, and server actions remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, Tailwind CSS 4, Supabase Auth, Verify.ge, Vitest, Testing Library, Playwright/in-app browser QA.

## Global Constraints

- Use the existing Kronika paper, ink, civic-red, type, square-corner, and printed-rule system from `DESIGN.md`; do not copy the generated mock's invented logo, navigation, drawings, malformed copy, or fake icons.
- `/login` and `/join` remain separate intent pages, but both use the same Google identity action and visual language.
- `/login` must not imply that every returning member has three registration steps.
- `/join` shows Google, phone, and cabinet progress; `loading`/`google` map to Google, while `form`/`otp`/`retry` map to phone. Successful registration still redirects immediately to `/me` with no new success page.
- Existing members still route to their derived cabinet destination without another phone verification.
- No database, migration, server action, provider, environment-variable, callback, referral, uniqueness, security, or deployment behavior changes.
- No email, password, SMS-login, additional provider, or new dependency.
- All user-facing copy is Georgian except the provider name `Google`; splice Georgian bytes from approved project sources and run both Georgian integrity gates.
- The Google control uses Google's current official standard-colour mark, a white fill, `#747775` one-pixel boundary, an accessible name, visible focus, `aria-busy`, disabled state, and a minimum 46-pixel target.
- Desktop QA viewport is exactly `1440 x 1024`; mobile QA viewport is exactly `390 x 844`.
- Every implementation task follows RED → confirm the intended failure → minimal GREEN → focused verification → commit.
- Do not deploy, push, merge, or alter production. The result stops at a local isolated preview for owner review.

## File map

**New focused units**

- `components/AuthEntryShell.tsx` — shared editorial page composition: optional progress, heading, action area, and explanatory rail.
- `components/AuthEntryShell.test.tsx` — semantic and responsive-contract coverage for the shell.
- `components/AuthProgress.tsx` — fixed Google/phone/cabinet progress semantics and visual state.
- `components/AuthProgress.test.tsx` — current/completed/upcoming step coverage.
- `public/brand/google-g.png` — centre-cropped, unmodified official Google mark from Google's pre-approved Android + Web light-square asset.
- `design-qa.md` — reference-versus-app visual QA record whose final line is `final result: passed`.

**Modified existing units**

- `components/GoogleAuthButton.tsx` and `components/GoogleAuthButton.test.tsx` — provider-correct white button while preserving OAuth behavior and safe errors.
- `app/(public)/login/GoogleLogin.tsx` and `app/(public)/login/login.test.tsx` — shared shell without registration progress.
- `app/(public)/join/GoogleJoinForm.tsx` and `app/(public)/join/JoinForm.test.tsx` — shared shell, phase-driven progress, and phase-aware explanatory rail without changing the state machine.
- `app/(public)/styleguide/page.tsx` — living examples for the new auth shell primitives and provider button.

---

### Task 1: Shared editorial shell and semantic registration progress

**Files:**
- Create: `components/AuthEntryShell.tsx`
- Create: `components/AuthEntryShell.test.tsx`
- Create: `components/AuthProgress.tsx`
- Create: `components/AuthProgress.test.tsx`

**Interfaces:**
- Consumes: `Eyebrow({ children })` from `components/Eyebrow.tsx` and existing Kronika colour/type utilities.
- Produces: `AuthEntryShell(props)` with `eyebrow`, `title`, `intro`, `asideTitle`, `aside`, optional `progress`, and `children` slots.
- Produces: `AuthProgress({ currentStep })`, where `currentStep` is exactly `"google" | "phone" | "cabinet"`.

- [ ] **Step 1: Write failing progress tests**

Create `components/AuthProgress.test.tsx` with concrete assertions for all three labels and the phone state:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProgress } from "./AuthProgress";

describe("AuthProgress", () => {
  it("marks one text-labelled registration step as current", () => {
    render(<AuthProgress currentStep="phone" />);

    expect(screen.getByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeInTheDocument();
    expect(screen.getByText("Google").closest("li")).toHaveAttribute("data-state", "complete");
    expect(screen.getByText("ტელეფონი").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("კაბინეტი").closest("li")).toHaveAttribute("data-state", "upcoming");
  });

  it("uses text and aria-current rather than colour alone", () => {
    render(<AuthProgress currentStep="google" />);

    expect(screen.getByText("Google").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write failing shell tests**

Create `components/AuthEntryShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthEntryShell } from "./AuthEntryShell";
import { AuthProgress } from "./AuthProgress";

describe("AuthEntryShell", () => {
  it("keeps the task and explanation in one labelled page without a card wrapper", () => {
    render(
      <AuthEntryShell
        eyebrow="წევრის რეგისტრაცია"
        title="შემოგვიერთდი ერთ წუთში"
        intro="მხოლოდ ძირითადი მონაცემები — დანარჩენს კაბინეტში ნახავ."
        progress={<AuthProgress currentStep="google" />}
        asideTitle="როგორ მუშაობს"
        aside={<p>შემდეგი ნაბიჯი</p>}
      >
        <button>Google-ით გაგრძელება</button>
      </AuthEntryShell>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("aria-labelledby", "auth-entry-title");
    expect(screen.getByRole("heading", { name: "შემოგვიერთდი ერთ წუთში" })).toHaveAttribute(
      "id",
      "auth-entry-title",
    );
    expect(screen.getByRole("complementary")).toHaveAccessibleName("როგორ მუშაობს");
    expect(screen.getByTestId("auth-entry-action").className).not.toContain("shadow");
  });

  it("allows login to use the composition without registration progress", () => {
    render(
      <AuthEntryShell
        eyebrow="პირადი კაბინეტი"
        title="შესვლა"
        intro="Google-ით შესვლა"
        asideTitle="პირველად ხარ?"
        aside={<p>წევრის რეგისტრაცია</p>}
      >
        <button>Google-ით შესვლა</button>
      </AuthEntryShell>,
    );

    expect(screen.queryByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeNull();
  });
});
```

- [ ] **Step 3: Run the focused tests and capture RED**

Run:

```powershell
npm.cmd exec -- vitest run components/AuthProgress.test.tsx components/AuthEntryShell.test.tsx
```

Expected: FAIL because both modules are absent. Record the command, exit code, and missing-module failure before writing implementation code.

- [ ] **Step 4: Implement the minimal progress component**

Create `components/AuthProgress.tsx` with this fixed data model and semantic shape:

```tsx
export type AuthProgressStep = "google" | "phone" | "cabinet";

const STEPS: ReadonlyArray<{ id: AuthProgressStep; number: string; label: string }> = [
  { id: "google", number: "01", label: "Google" },
  { id: "phone", number: "02", label: "ტელეფონი" },
  { id: "cabinet", number: "03", label: "კაბინეტი" },
];

export function AuthProgress({ currentStep }: { currentStep: AuthProgressStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol
      aria-label="რეგისტრაციის ნაბიჯები"
      className="grid grid-cols-3 border-y border-ink"
    >
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            data-state={state}
            className="group flex min-w-0 items-center gap-2 border-r border-hairline px-2 py-3 last:border-r-0 sm:gap-3 sm:px-4"
          >
            <span className="font-serif text-[0.76rem] font-bold text-brand">{step.number}</span>
            <span className="truncate text-[0.72rem] font-bold tracking-[.04em] text-muted-fg group-data-[state=current]:text-ink sm:text-[0.8rem]">
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

During implementation, put the state-dependent text class on the `li`/descendant using Tailwind's group/data syntax so the current label is visibly ink and the tests' `data-state` contract remains exact.

- [ ] **Step 5: Implement the minimal shared shell**

Create `components/AuthEntryShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

export function AuthEntryShell({
  eyebrow,
  title,
  intro,
  progress,
  children,
  asideTitle,
  aside,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  intro: ReactNode;
  progress?: ReactNode;
  children: ReactNode;
  asideTitle: ReactNode;
  aside: ReactNode;
}) {
  return (
    <main
      aria-labelledby="auth-entry-title"
      className="mx-auto w-full max-w-[1120px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12 lg:pb-24 lg:pt-16"
    >
      {progress ? <div className="mb-10 sm:mb-14">{progress}</div> : null}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <section className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 id="auth-entry-title" className="mt-2 max-w-3xl font-serif text-4xl font-bold leading-[1.15] text-ink sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[1rem] leading-7 text-muted-fg">{intro}</p>
          <div data-testid="auth-entry-action" className="mt-8 max-w-2xl border-t-2 border-ink pt-7 sm:mt-10 sm:pt-8">
            {children}
          </div>
        </section>
        <aside aria-labelledby="auth-aside-title" className="border-t border-hairline pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
          <h2 id="auth-aside-title" className="font-serif text-lg font-bold text-ink">
            {asideTitle}
          </h2>
          <div className="mt-3 text-sm leading-6 text-muted-fg">{aside}</div>
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run GREEN and quality checks**

Run:

```powershell
npm.cmd exec -- vitest run components/AuthProgress.test.tsx components/AuthEntryShell.test.tsx
npm.cmd run typecheck
npm.cmd exec -- prettier --check components/AuthProgress.tsx components/AuthProgress.test.tsx components/AuthEntryShell.tsx components/AuthEntryShell.test.tsx
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit Task 1**

```powershell
git add components/AuthProgress.tsx components/AuthProgress.test.tsx components/AuthEntryShell.tsx components/AuthEntryShell.test.tsx
git commit -m "feat: add guided auth entry shell"
```

---

### Task 2: Official Google provider button and design-system sample

**Files:**
- Create: `public/brand/google-g.png`
- Modify: `components/GoogleAuthButton.tsx`
- Modify: `components/GoogleAuthButton.test.tsx`
- Modify: `app/(public)/styleguide/page.tsx`

**Interfaces:**
- Consumes: unchanged `safeAuthNext(nextPath)` and Supabase `signInWithOAuth({ provider: "google" })` behavior.
- Produces: unchanged `GoogleAuthButton({ nextPath, label })` public API with provider-correct visuals, `aria-busy`, and the official local mark at `/brand/google-g.png`.

- [ ] **Step 1: Extend provider-button tests and capture RED**

Add one test to `components/GoogleAuthButton.test.tsx` without altering the three existing OAuth tests:

```tsx
it("renders the official mark in a full-width accessible provider control", () => {
  render(<GoogleAuthButton nextPath="/join" label="Google-ით გაგრძელება" />);

  const button = screen.getByRole("button", { name: "Google-ით გაგრძელება" });
  expect(button).toHaveAttribute("aria-busy", "false");
  expect(button.className).toContain("min-h-[48px]");
  expect(button.className).toContain("bg-white");
  expect(button.className).toContain("border-[#747775]");
  const mark = screen.getByTestId("google-mark");
  expect(mark).toHaveAttribute("alt", "");
  expect(mark.getAttribute("src")).toContain("google-g.png");
});
```

Run:

```powershell
npm.cmd exec -- vitest run components/GoogleAuthButton.test.tsx
```

Expected: the new visual/asset assertions fail while all existing OAuth behavior assertions pass.

- [ ] **Step 2: Derive the local mark from Google's current pre-approved bundle**

Use Google's official bundle and crop only the 40-by-40 centre mark from the 80-by-80 `@2x` light square; do not redraw, recolour, trace, or simplify it:

```powershell
$assetZip = Join-Path $env:TEMP 'republic-google-signin-assets.zip'
$assetDir = Join-Path $env:TEMP 'republic-google-signin-assets'
Invoke-WebRequest -Uri 'https://developers.google.com/static/identity/images/signin-assets.zip' -OutFile $assetZip
Expand-Archive -LiteralPath $assetZip -DestinationPath $assetDir -Force
$sourceAsset = Join-Path $assetDir 'Android + Web\PNG @2x\Light\Theme=Light, Show text=No, Shape=Square, Platform=Android+Web@2x.png'
New-Item -ItemType Directory -Force 'public\brand'
node -e "require('sharp')(process.argv[1]).extract({left:20,top:20,width:40,height:40}).png().toFile(process.argv[2])" $sourceAsset 'public\brand\google-g.png'
```

Verify the produced file is `40 x 40`, has alpha/white background preserved around the standard-colour mark, and is not a hand-made SVG.

- [ ] **Step 3: Implement the provider-correct control**

Keep `startGoogleOAuth()` byte-for-byte behaviorally equivalent. Replace only the rendered generic `Button` with a direct button and `next/image` mark:

```tsx
import Image from "next/image";

<button
  type="button"
  onClick={startGoogleOAuth}
  disabled={pending}
  aria-busy={pending}
  className="relative inline-flex min-h-[48px] w-full items-center justify-center border border-[#747775] bg-white px-12 text-[0.9rem] font-semibold text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa] disabled:pointer-events-none disabled:opacity-60"
>
  <Image
    src="/brand/google-g.png"
    alt=""
    aria-hidden="true"
    data-testid="google-mark"
    width={20}
    height={20}
    className="absolute left-3"
  />
  <span>{label}</span>
</button>
```

Remove only the now-unused generic `Button` import. Keep the existing safe Georgian error immediately below the control.

- [ ] **Step 4: Add the living style-guide example**

In `app/(public)/styleguide/page.tsx`, import both `AuthProgress` and `GoogleAuthButton`, then add them inside the existing buttons card under a Georgian auth label:

```tsx
<div className="border-t border-hairline pt-4">
  <div className="mb-3 text-xs font-semibold text-muted-fg">ავტორიზაციის ნაკადი</div>
  <AuthProgress currentStep="phone" />
  <div className="mt-4 max-w-md">
    <GoogleAuthButton nextPath="/join" label="Google-ით გაგრძელება" />
  </div>
</div>
```

Do not add a dependency or a new general-purpose button variant; this treatment belongs only to Google.

- [ ] **Step 5: Run GREEN and quality checks**

```powershell
npm.cmd exec -- vitest run components/GoogleAuthButton.test.tsx
npm.cmd run typecheck
npm.cmd run lint
node scripts/ka-gate.mjs --diff 350cbe4 components/GoogleAuthButton.tsx components/GoogleAuthButton.test.tsx 'app/(public)/styleguide/page.tsx'
npm.cmd run ka:scan
npm.cmd exec -- prettier --check components/GoogleAuthButton.tsx components/GoogleAuthButton.test.tsx 'app/(public)/styleguide/page.tsx'
git diff --check
```

Expected: all commands exit `0`; the original OAuth target, referral preservation, pending lock, and safe error tests remain green.

- [ ] **Step 6: Commit Task 2**

```powershell
git add public/brand/google-g.png components/GoogleAuthButton.tsx components/GoogleAuthButton.test.tsx 'app/(public)/styleguide/page.tsx'
git commit -m "feat: polish Google auth provider control"
```

---

### Task 3: Apply the approved flow to login and every registration phase

**Files:**
- Modify: `app/(public)/login/GoogleLogin.tsx`
- Modify: `app/(public)/login/login.test.tsx`
- Modify: `app/(public)/join/GoogleJoinForm.tsx`
- Modify: `app/(public)/join/JoinForm.test.tsx`

**Interfaces:**
- Consumes: `AuthEntryShell`, `AuthProgress`, unchanged `GoogleAuthButton`, `Field`, `PhoneVerification`, and the existing `GoogleJoinPhase` state machine.
- Produces: `/login` with the shared editorial composition and no progress list.
- Produces: `/join` with `currentStep="google"` for `loading`/`google`, and `currentStep="phone"` for `form`/`otp`/`retry`.

- [ ] **Step 1: Add failing login layout tests**

Extend the Google-mode test in `app/(public)/login/login.test.tsx` with the approved presentation contract:

```tsx
expect(screen.getByRole("heading", { name: "შესვლა" })).toBeInTheDocument();
expect(screen.queryByRole("list", { name: "რეგისტრაციის ნაბიჯები" })).toBeNull();
expect(screen.getByRole("complementary")).toHaveAccessibleName("პირველად ხარ?");
expect(screen.getByText("Google-ით შედიხარ უსაფრთხოდ და სწრაფად.")).toBeInTheDocument();
```

- [ ] **Step 2: Add failing phase-progress tests**

Import `within` from Testing Library in `app/(public)/join/JoinForm.test.tsx`, then add a small helper:

```tsx
function expectCurrentRegistrationStep(label: "Google" | "ტელეფონი") {
  const progress = screen.getByRole("list", { name: "რეგისტრაციის ნაბიჯები" });
  expect(within(progress).getByText(label).closest("li")).toHaveAttribute("aria-current", "step");
}
```

Add/assert these exact states in the existing flow tests:

```tsx
// Signed out Google gate
expectCurrentRegistrationStep("Google");
expect(screen.getByRole("complementary")).toHaveAccessibleName("როგორ მუშაობს");
expect(screen.getByText("ნაბიჯი 1 — წევრის რეგისტრაცია")).toBeInTheDocument();

// Signed-in profile form
expectCurrentRegistrationStep("ტელეფონი");
expect(screen.getByText("ნაბიჯი 2 — ტელეფონის დადასტურება")).toBeInTheDocument();

// OTP after successful send
expectCurrentRegistrationStep("ტელეფონი");

// Retry after verified-phone registration failure
expectCurrentRegistrationStep("ტელეფონი");
```

Also assert that the existing successful registration test still calls `replace("/me")`, proving there is no added completion page.

- [ ] **Step 3: Run the focused tests and capture RED**

```powershell
npm.cmd exec -- vitest run 'app/(public)/login/login.test.tsx' 'app/(public)/join/JoinForm.test.tsx'
```

Expected: existing behavioral tests pass; new shell, complementary-region, and progress assertions fail.

- [ ] **Step 4: Place login inside the shared shell**

Replace the sparse `<main>`/bordered card in `GoogleLogin.tsx` with:

```tsx
<AuthEntryShell
  eyebrow="პირადი კაბინეტი"
  title="შესვლა"
  intro="Google-ით შედიხარ უსაფრთხოდ და სწრაფად."
  asideTitle="პირველად ხარ?"
  aside={
    <p>
      Google-ის შემდეგ მოკლე რეგისტრაციას დაასრულებ და ტელეფონის ნომერს მხოლოდ ერთხელ
      დაადასტურებ.
    </p>
  }
>
  <div className="flex max-w-xl flex-col gap-4">
    <GoogleAuthButton nextPath="/join" label="Google-ით შესვლა" />
    {errorMessage ? (
      <p role="alert" className="text-sm font-semibold text-danger">
        {errorMessage}
      </p>
    ) : null}
  </div>
</AuthEntryShell>
```

The callback error map and `/join` next path remain untouched.

- [ ] **Step 5: Place all join phases inside one persistent shell**

In `GoogleJoinForm.tsx`:

1. Replace the direct `Eyebrow` import with `AuthEntryShell` and `AuthProgress`.
2. Derive presentation only:

```tsx
const phoneStep = phase === "form" || phase === "otp" || phase === "retry";
const currentStep = phoneStep ? "phone" : "google";
```

3. Replace only the outer `<main>` and bright bordered card with:

```tsx
<AuthEntryShell
  eyebrow={
    phoneStep ? "ნაბიჯი 2 — ტელეფონის დადასტურება" : "ნაბიჯი 1 — წევრის რეგისტრაცია"
  }
  title="შემოგვიერთდი ერთ წუთში"
  intro="Google-ით იწყებ, ტელეფონის ნომერს კი მხოლოდ ერთხელ ადასტურებ."
  progress={<AuthProgress currentStep={currentStep} />}
  compact={phoneStep}
  asideTitle={phoneStep ? "რატომ ტელეფონი?" : "როგორ მუშაობს"}
  aside={
    phoneStep ? (
      <p>
        ნომერზე მიიღებ ერთჯერად SMS კოდს. შემდეგ შესვლისთვის მხოლოდ Google დაგჭირდება.
      </p>
    ) : (
      <ol className="flex list-decimal flex-col gap-2 pl-4">
        <li>Google-ით უსაფრთხოდ შედიხარ.</li>
        <li>ახალი წევრი ერთხელ ადასტურებს ტელეფონის ნომერს.</li>
        <li>შემდეგ პირდაპირ პირად კაბინეტში გადადიხარ.</li>
      </ol>
    )
  }
>
  {notice ? (
    <p
      className="mb-5 border-l-2 border-brand bg-surface px-4 py-3 text-sm text-ink"
      data-testid="join-notice"
    >
      {notice}
    </p>
  ) : null}

  {phase === "loading" ? (
    <p role="status" className="text-sm text-muted-fg">
      მონაცემები იტვირთება…
    </p>
  ) : null}

  {phase === "google" ? (
    <div className="flex max-w-xl flex-col gap-4">
      <GoogleAuthButton nextPath={nextPath} label="Google-ით გაგრძელება" />
      {formError ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {formError}
        </p>
      ) : null}
    </div>
  ) : null}

  {phase === "otp" && challenge ? (
    <div className="flex max-w-xl flex-col gap-4">
      <PhoneVerification
        phone={phone}
        challengeId={challenge.challengeId}
        expiresAt={challenge.expiresAt}
        onChallengeChanged={setChallenge}
        onVerified={afterPhoneVerified}
      />
      <Button variant="ghost" size="sm" onClick={changePhone}>
        ნომრის შეცვლა
      </Button>
    </div>
  ) : null}

  {phase === "form" || phase === "retry" ? (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="სახელი"
          name="firstName"
          placeholder="მაგ. ნინო"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={errors.firstName}
        />
        <Field
          label="გვარი"
          name="lastName"
          placeholder="მაგ. ბერიძე"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={errors.lastName}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Field
          label="ტელეფონის ნომერი"
          name="phone"
          inputMode="tel"
          placeholder="+995 5XX XX XX XX"
          value={phoneInput}
          onChange={(event) => setPhoneInput(event.target.value)}
          error={errors.phone}
          disabled={phase === "retry"}
        />
        <p className="text-xs text-muted-fg">
          {phase === "retry"
            ? "ნომერი დადასტურებულია"
            : "Verify.ge ნომერს მიიღებს მხოლოდ რეგისტრაციის ერთჯერადი კოდის გასაგზავნად და დასადასტურებლად."}
        </p>
      </div>
      {formError ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {formError}
        </p>
      ) : null}
      <Button onClick={phase === "retry" ? submitRetry : submitForm} disabled={busy} size="lg">
        {phase === "retry" ? "დარეგისტრირება" : "კოდის მიღება"}
      </Button>
    </div>
  ) : null}
</AuthEntryShell>
```

Keep every existing branch, handler, validation message, retry rule, resend rule, and redirect intact. Make only these presentation adjustments inside those branches:

- remove the old `bg-paper-bright` enclosing card and its shadow;
- keep the notice square with a left civic-red rule instead of `rounded-lg`;
- in phone continuation states, start directly with the form/OTP action and omit the repeated eyebrow, title, intro, explanatory rail, divider, and personal-details heading;
- keep all field labels and the short Verify.ge disclosure;
- keep the OTP and change-number controls in the same shell;
- keep the action width at `max-w-2xl` and avoid horizontal overflow.

- [ ] **Step 6: Run GREEN and all auth regression tests**

```powershell
npm.cmd exec -- vitest run components/AuthProgress.test.tsx components/AuthEntryShell.test.tsx components/GoogleAuthButton.test.tsx 'app/(public)/login/login.test.tsx' 'app/(public)/join/JoinForm.test.tsx' components/PhoneVerification.test.tsx components/OtpVerification.test.tsx
npm.cmd run typecheck
npm.cmd run lint
node scripts/ka-gate.mjs --diff 350cbe4 components/AuthEntryShell.tsx components/AuthEntryShell.test.tsx components/AuthProgress.tsx components/AuthProgress.test.tsx components/GoogleAuthButton.tsx components/GoogleAuthButton.test.tsx 'app/(public)/login/GoogleLogin.tsx' 'app/(public)/login/login.test.tsx' 'app/(public)/join/GoogleJoinForm.tsx' 'app/(public)/join/JoinForm.test.tsx' 'app/(public)/styleguide/page.tsx'
npm.cmd run ka:scan
npm.cmd exec -- prettier --check components/AuthEntryShell.tsx components/AuthEntryShell.test.tsx components/AuthProgress.tsx components/AuthProgress.test.tsx components/GoogleAuthButton.tsx components/GoogleAuthButton.test.tsx 'app/(public)/login/GoogleLogin.tsx' 'app/(public)/login/login.test.tsx' 'app/(public)/join/GoogleJoinForm.tsx' 'app/(public)/join/JoinForm.test.tsx' 'app/(public)/styleguide/page.tsx'
git diff --check
```

Expected: every command exits `0`; auth flow tests prove unchanged routing and SMS behavior.

- [ ] **Step 7: Commit Task 3**

```powershell
git add 'app/(public)/login/GoogleLogin.tsx' 'app/(public)/login/login.test.tsx' 'app/(public)/join/GoogleJoinForm.tsx' 'app/(public)/join/JoinForm.test.tsx'
git commit -m "feat: guide Google registration flow"
```

---

### Task 4: Full verification and isolated owner preview

**Files:**
- Create: `design-qa.md`
- Do not modify: auth backend, migrations, environment configuration, Vercel project settings, or production.

**Interfaces:**
- Consumes: the selected reference at `C:\Users\Mylaptop\.codex\generated_images\019fec9a-f183-7152-8403-5da9abc17830\exec-ec98c101-3aad-49aa-bd1a-0703a43a4ef7.png`.
- Produces: a running local preview, desktop/mobile screenshots, interaction evidence, console-error check, and `design-qa.md` ending with `final result: passed`.

- [ ] **Step 1: Run the complete automated gate**

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run ka:scan
npm.cmd run format:check
git diff --check
```

Expected: all commands exit `0`. If repository-wide formatting exposes a pre-existing unrelated failure, record it separately and still require all touched files to pass; do not edit unrelated files.

- [ ] **Step 2: Start the isolated local app with testing/Preview configuration**

Use the already-linked Vercel Preview/testing project only. Do not use the production Supabase project or production secrets. Start on an unused fixed port, preferring:

```powershell
npm.cmd exec -- vercel dev --listen 4173
```

If the linked CLI cannot supply Preview values, refresh a gitignored local Preview env file and start Next directly:

```powershell
npm.cmd exec -- vercel env pull .env.auth-design.local --environment=preview --yes
node --env-file=.env.auth-design.local node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 4173
```

Expected: `http://127.0.0.1:4173/login` and `/join` return `200`; production remains unchanged.

- [ ] **Step 3: Perform desktop design QA at exactly 1440 x 1024**

Use the in-app browser and compare the app side-by-side with the selected image. Verify:

- real public masthead, page sheet, and footer remain unchanged;
- the progress row reads Google / ტელეფონი / კაბინეტი and uses a printed rule;
- the heading/action zone is wide, the explanatory rail is narrow, and there is no giant enclosing card;
- the official Google mark is sharp, standard-colour, white-backed, and not stretched;
- `/login` shares the same composition but has no three-step registration list;
- no invented logo, fake illustration, rounded floating card, gradient, decorative shadow, or malformed Georgian appears.

Capture desktop screenshots of `/login` and the signed-out `/join` state.

- [ ] **Step 4: Exercise registration states and interactions**

Using testing/staging only, verify and capture:

- Google gate current step;
- signed-in first-time user form with phone current step;
- validation errors beside fields;
- OTP screen with phone current step, normalized destination, resend, and change-number actions;
- safe service/invalid-code error placement;
- verified-phone retry without a second SMS;
- successful route to `/me` without an added success page;
- keyboard traversal and visible focus;
- no browser-console errors.

Do not automate Google's own account page; install or reuse a testing Supabase session through the repository's existing E2E helpers when a state must be reached safely.

- [ ] **Step 5: Perform mobile QA at exactly 390 x 844**

Verify `/login`, signed-out `/join`, form, and OTP states at `390 x 844`:

- no horizontal scroll;
- all three progress labels remain readable;
- the provider button remains at least 46 pixels high;
- the explanatory rail stacks below the primary task;
- labels, errors, OTP cells, resend, and change-number actions remain reachable;
- public mobile masthead/CTA behavior is unchanged.

- [ ] **Step 6: Write the design QA record**

Create `design-qa.md` with this concrete structure and replace each evidence value with the actual captured result:

```markdown
# Auth Entry Flow Design QA

- Reference: selected Three-Step Civic Registration image
- Local preview: http://127.0.0.1:4173
- Desktop: 1440 x 1024
- Mobile: 390 x 844

## Compared states

- /login: passed
- /join Google: passed
- /join personal details: passed
- /join OTP: passed
- /join retry: passed

## Interaction and accessibility

- Keyboard focus: passed
- Pending/disabled provider state: passed
- Validation and safe errors: passed
- Change number/resend/retry: passed
- Console errors: none

## Differences from reference

- Retained the real Republic masthead and footer.
- Replaced generated-image copy and drawings with approved product copy and semantic text.
- Preserved immediate cabinet routing instead of adding a completion screen.

final result: passed
```

- [ ] **Step 7: Re-run touched-file checks and commit QA evidence**

```powershell
npm.cmd exec -- prettier --check design-qa.md
git diff --check
git status --short
git add design-qa.md
git commit -m "test: verify auth entry design"
```

- [ ] **Step 8: Hand the local preview to the owner**

Report in plain language:

- the exact local preview URL;
- which screens and states were verified;
- the exact commit at the tip of `codex/google-verify-auth`;
- that production, Vercel deployment, Supabase, and backend auth behavior were not changed;
- that the next gate is owner visual approval before push/PR Preview work.
