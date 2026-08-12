# Authentication entry-flow redesign

**Date:** 2026-08-12  
**Status:** owner-selected direction, awaiting written-spec approval  
**Visual direction:** the selected “Three-Step Civic Registration” concept

## 1. Outcome

Replace the sparse Google sign-in and registration screens with one coherent,
guided experience that looks native to the Kronika design system.

The redesign must make three things immediately clear:

1. Google is the only normal way to identify yourself.
2. Existing members go straight to their cabinet and do not verify a phone
   again.
3. A first-time supporter completes one additional phone-verification step and
   then enters the cabinet.

This is a presentation and usability change. It does not change the shipped
Google, Supabase, Verify.ge, registration, referral, or security behavior.

## 2. Core product decision

The product keeps two public destinations because they express different user
intent:

- `/login` is reached from “შესვლა”;
- `/join` is reached from “შემოგვიერთდი”.

Both destinations use the same Google identity action and the same visual
language. The system, not the visitor, decides what happens after Google:

- a registered member goes to the correct cabinet destination;
- a Google user without a profile continues on `/join` to phone verification;
- an interrupted first-time registration resumes at the correct step.

There is no email field, password field, SMS login, or “new versus existing
user” choice.

## 3. Registration flow

### Step 1 — Google

The `/join` opening state shows:

- the existing public masthead and page sheet;
- a full-width three-part progress row: Google, phone, cabinet;
- a small current-step label;
- one clear heading and one short explanation;
- one conventional white Google button with the official multicolour Google G;
- a short desktop-side note explaining the two remaining outcomes;
- a quiet sentence explaining that an existing member can use the same button.

The page must not use a large enclosing card. Structure comes from whitespace,
type, and the existing Kronika rules.

### Step 2 — Personal details and phone

After Google succeeds, the same page shell remains in place and the second
progress item becomes active.

The main area shows the existing first-name, last-name, and phone fields. The
side note explains that the phone is used only for a one-time registration
code. Submitting valid details sends the Verify.ge code.

When the code has been sent, the progress row stays on the phone step. The main
area changes to the existing six-digit verification control, shows the verified
destination number, and keeps the existing change-number and resend behavior.
It must not appear to be a new or unrelated page.

### Step 3 — Cabinet

After the code is accepted and registration succeeds, the existing behavior
continues: the visitor goes directly to `/me`. The progress row's third label
therefore describes the destination as the cabinet; there is no extra ceremony
page or artificial delay.

If registration has a recoverable failure after phone proof, the page keeps the
verified state and offers the existing retry action without sending another
SMS.

## 4. Login flow

`/login` uses the same page composition, Google button, proportions, and
supporting language, but it does not pretend the visitor must complete three
registration steps.

It presents Google as the single sign-in action and explains the routing in one
short sentence:

- registered members enter their cabinet;
- first-time visitors are taken to the short phone-verification flow.

If the Google callback reports an error, the existing safe Georgian error text
appears next to the action and the retry remains obvious.

## 5. Visual system

The implementation uses the shipped Kronika system rather than copying the
generated image literally:

- existing `PageSheet`, public `Masthead`, footer, fonts, and colour tokens;
- paper background, warm ink, and one civic-red accent;
- square corners and printed rules; no gradients, floating cards, or decorative
  shadows;
- an asymmetric desktop layout with a wide task area and a narrow explanatory
  rail;
- a single-column mobile layout with the explanatory rail moved below the
  primary action;
- large, obvious controls and the existing red keyboard-focus treatment.

The generated mock's invented logo, malformed Georgian copy, decorative phone
and door drawings, and non-product navigation are not carried into the app.
Only its hierarchy, progress treatment, and spacious editorial composition are
the visual reference.

## 6. Components and scope

The smallest maintainable implementation is:

- one shared authentication-page shell for page title, progress, main content,
  and explanatory rail;
- one registration-progress component driven by the existing Google join
  phases;
- an updated `GoogleAuthButton` with an official local Google G asset and a
  provider-appropriate white treatment;
- the existing `GoogleJoinForm`, `GoogleLogin`, `Field`, and
  `PhoneVerification` behavior placed inside the new shell;
- a style-guide example only if the provider button becomes a reusable visual
  component.

No database, migration, server-action, environment-variable, provider, or
deployment configuration changes belong to this redesign.

## 7. Responsive and accessibility rules

- Desktop reference viewport: 1440 × 1024.
- Mobile verification viewport: 390 × 844.
- The main action remains visible without horizontal scrolling.
- Progress is conveyed by text and `aria-current`, not colour alone.
- The Google button has an accessible name, visible focus, disabled/pending
  state, and a minimum 46-pixel target height.
- All form labels remain visible.
- Errors remain adjacent to the action or field that can resolve them.
- Reduced-motion users receive no animated layout transition.

## 8. Verification

### Automated

- Tests prove `/login` and `/join` retain their existing routing and security
  behavior.
- Component tests prove the correct progress state for Google, details, code,
  retry, and successful routing states.
- Existing phone-verification and registration tests remain green.
- Type checking, lint, Georgian mixed-script scan, formatting, and the full unit
  suite pass.

### Visual and interaction QA

- Compare the app at 1440 × 1024 with the selected visual direction.
- Verify `/login` and every visible `/join` state at desktop and 390 × 844.
- Exercise the main controls, keyboard focus, validation, error, pending, change
  number, resend, and retry states.
- Confirm no browser-console errors.
- Open an isolated preview for owner review. Production remains unchanged until
  the normal PR, CI, preview sign-off, and merge process is complete.

## 9. Out of scope

- changing Google or Verify.ge integration behavior;
- changing phone uniqueness or identity-linking rules;
- adding email, password, SMS login, or another provider;
- redesigning the public masthead, footer, cabinet, or other site pages;
- adding a standalone registration-success page;
- production deployment or merge before owner preview approval.
