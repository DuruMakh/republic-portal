# Google sign-in and Verify.ge phone verification — design

**Date:** 2026-08-11
**Owner decision pass:** this conversation
**Changes:** the authentication and initial registration portions of
`2026-07-12-republic-portal-production-design.md` and
`2026-07-21-progressive-registration-design.md`. All cabinet, membership,
delegate and admin authorization rules remain unchanged.

## 1. Outcome

Google becomes the only ordinary sign-in method. SMS no longer creates a login
session and is not required every time someone returns. Verify.ge is used only
to prove that a signed-in person controls the Georgian mobile number they add
during registration.

Supabase Auth remains the source of the user's identity, session and database
permissions. Verify.ge is a narrowly scoped phone-verification service, not a
replacement authentication system.

The design deliberately leaves room for later SMS checks — for example, when a
phone number changes or a sensitive action needs confirmation — but does not
build those cases now.

## 2. Owner decisions

1. **Google only for normal sign-in.** There is no email-link, password or SMS
   login in this release.
2. **Verify.ge for registration phone proof.** A user verifies a phone only
   after a valid Google/Supabase session exists.
3. **SMS is purpose-specific.** It is not the platform's primary identity or
   session mechanism.
4. **The provider must be replaceable.** Verify.ge is the first implementation
   behind a small server-only phone-verification contract.
5. **No webhook in v1.** The synchronous send/verify API is sufficient. The
   public Verify.ge documentation does not define webhook events, payloads or
   signature verification, and webhooks are a Growth-plan feature rather than a
   Starter-plan requirement.
6. **Verify.ge Starter is already active.** Real Georgian phone numbers can be
   used during owner-approved preview and production smoke tests.

## 3. User journeys

### 3.1 Returning registered user

1. The user selects `Google-ით შესვლა`.
2. Supabase redirects to Google and exchanges the callback code for a Supabase
   session using the server-side PKCE callback.
3. `cabinet_state()` finds the existing profile and the app routes to the
   correct cabinet exactly as it does today.
4. No SMS is sent.

### 3.2 First registration

1. The visitor selects `Google-ით გაგრძელება` on `/join`.
2. Google succeeds and Supabase creates or restores the Google-backed session.
3. The visitor returns to `/join`, enters first name, last name and Georgian
   mobile number, then requests a code.
4. A server action confirms the Supabase user and their Google provider,
   validates the normalized `+9955XXXXXXXX` number, applies rate limits and asks
   Verify.ge to send a six-digit code valid for five minutes.
5. The user enters the code. A second server action verifies that the challenge
   belongs to the current Supabase user, then asks Verify.ge to validate it.
6. On success, the server attaches that exact phone to the same Supabase Auth
   user with `phone_confirm: true`. The browser refreshes the Supabase session.
7. The existing `register()` RPC copies the verified phone from `auth.users`
   into `profiles` and creates the registration record.
8. The user reaches `/me`.

The Google session is created before phone verification. Verify.ge never mints
or replaces the Supabase session.

### 3.3 Interrupted registration

A Google user may leave after sign-in, after requesting a code or after the
phone was confirmed but before `register()` succeeds. Returning to `/join`
resumes from the safest valid state:

- Google session but no confirmed phone: show the registration and phone proof
  flow.
- Confirmed phone but no profile: skip another SMS and retry `register()`.
- Existing profile: route to the cabinet.

### 3.4 Phone already belongs to another account

Supabase Auth and `profiles.phone` remain unique. If a successfully verified
phone is already attached to another user, registration stops with an honest
Georgian message that the number is already in use. The system does not merge,
overwrite or transfer accounts automatically.

## 4. Google authentication

The browser starts `supabase.auth.signInWithOAuth({ provider: "google" })` and
sets a relative post-login destination. A new `/auth/callback` route validates
that destination, exchanges the PKCE code for a cookie-backed session and then
routes through `cabinet_state()`:

- existing profile → derived cabinet destination;
- no profile → `/join`;
- invalid callback or exchange failure → a Georgian retry screen.

Production and testing Supabase projects each get their own Google OAuth web
client so the existing environment separation is preserved. Their stable site
URLs and approved preview callback URLs are added to the Supabase redirect
allow lists. Google receives only the standard `openid`, email and profile
scopes; the app does not request access to Gmail, contacts, Drive or other
Google data.

Hosted production exposes Google as the only signup/login provider. Supabase
phone sign-in is disabled there. A database guard also requires a matching
`auth.identities` row with `provider = 'google'` before a new profile can be
registered; client-editable user metadata is never trusted for this decision.

## 5. Verify.ge boundary

The app uses a server-only `PhoneVerificationProvider` contract with two
operations:

- send a challenge for a normalized phone and purpose;
- verify the user-entered code for that challenge.

The first implementation calls Verify.ge's REST API directly. Only the adapter
knows Verify.ge field names and error responses. The registration UI and domain
logic use provider-neutral results, so a future Georgian provider can replace
Verify.ge without changing the user journey or Supabase identity model.

Only the phone number, SMS channel, six-digit length, five-minute lifetime and
an idempotency value are sent. The user's Google email, name, profile data and
Supabase service credentials are never sent to Verify.ge. IP address is not
sent in v1; the app enforces its own limits.

`VERIFY_GE_API_KEY` is a server-only Vercel secret. It must never use a
`NEXT_PUBLIC_` prefix, appear in browser code, logs, test snapshots, the design
document or Git history. Missing configuration fails closed with a generic
Georgian service-unavailable message.

## 6. Challenge data

A migration adds `public.phone_verification_challenges`, following the existing
sealed-table pattern used for sensitive server-only records:

| Column | Purpose |
|---|---|
| `id` | opaque UUID returned to the current UI |
| `user_id` | Supabase user that requested the challenge |
| `phone` | normalized phone bound to the challenge |
| `purpose` | fixed to `registration` in v1 |
| `provider` | fixed to `verify_ge` in v1 |
| `provider_request_id` | Verify.ge request identifier, never exposed to the browser |
| `verify_attempts` | failed attempts counted by the app |
| `expires_at` | five-minute expiry |
| `consumed_at` | one-time-use marker |
| `created_at` | rate-limit and cleanup timestamp |

RLS is enabled and all privileges are revoked from `anon` and `authenticated`.
No client policy is added. Only server code using the service-role client may
read or write challenges, and only after `supabase.auth.getUser()` proves the
requesting Google session.

No OTP code is stored. Before inserting a new challenge, the server deletes
expired challenge rows older than 24 hours for that same user or phone. The
rate-limit indexes bound this cleanup. A global retention job is not added in
v1; if table growth later requires one, it gets its own measured change.

## 7. Server actions and security rules

Two server actions own the provider calls:

1. `sendPhoneVerificationAction(input)`
2. `verifyPhoneVerificationAction(input)`

Both validate unknown input with zod, call `getUser()` rather than trusting a
client-supplied user ID, confirm the Google provider from server-owned Auth
data, and only then create an admin client.

Rules:

- one send per user and phone per 60 seconds;
- at most five sends per user and per phone in one hour;
- at most five verification failures for one challenge;
- a challenge is bound to one user, one phone and one purpose;
- expired or consumed challenges cannot be retried;
- successful consumption is conditional, so two simultaneous requests cannot
  both complete it;
- resend creates a new challenge and invalidates the previous active one;
- provider keys, provider request IDs and raw provider errors are never logged
  or returned to the browser;
- attaching and confirming a phone uses the Supabase admin client only after
  Verify.ge success;
- registration still uses the authenticated user's `auth.uid()` and never a
  user ID supplied by the browser.

User-facing failures distinguish only what helps the person recover: invalid or
expired code, resend cooldown, too many attempts, number already used, lost
Google session and temporary service failure. All text is Georgian.

## 8. Existing system changes

- `/login` becomes one Google sign-in button and no longer accepts a phone.
- `/join` requires Google first, then keeps the existing name, phone and
  referral-code registration fields.
- The phone helper text states plainly that Verify.ge receives the number only
  to send and confirm this one-time registration code.
- Supabase's `OtpVerification` component is not reused for Verify.ge, because it
  creates and verifies Supabase phone-login sessions. A provider-neutral phone
  proof component replaces it in the join flow.
- `register()` keeps the existing verified-phone requirement and gains the
  Google-provider requirement. It still reads the phone from `auth.users` and
  never accepts it as an RPC argument.
- `cabinet_state()`, RLS ownership through `auth.uid()`, cabinet routes and admin
  authorization remain unchanged.
- The legacy dev SMS hook/inbox may remain solely for local security fixtures
  during this change, but it is not a product path and hosted production phone
  sign-in is disabled. Removing that fixture infrastructure is separate cleanup
  unless the implementation plan proves it can be removed without weakening
  the security test matrix.

## 9. Existing-account rollout gate

The old model used phone OTP as the Supabase identity. A Google sign-in for the
same person can otherwise create a second Auth user before phone verification.
Automatic account merging is explicitly forbidden in this release.

Before enabling Google-only auth in production, the release must count and
classify existing `auth.users` and `profiles`:

- if production has no real user accounts, proceed;
- reset synthetic testing fixtures under the existing guarded reset process;
- if any real phone-auth account exists, stop the release and write a separate
  owner-approved identity-migration design before changing login.

No existing profile, membership, delegate record or admin role may be silently
reassigned or deleted.

## 10. Webhooks

No Verify.ge webhook endpoint, secret or subscription is created. The active
flow receives the authoritative verification result synchronously from
`/otp/verify`, so a webhook would not decide registration success.

Webhooks may be reconsidered only when a documented event contract and signing
method are available and the product needs asynchronous delivery monitoring or
analytics. That later change gets its own design and must remain advisory: a
delayed webhook must never retroactively create a session or registration.

## 11. Verification

Implementation follows the repository's TDD rule: each behavior first receives
a failing test, then the minimum production code.

### Automated

- provider-adapter tests for send, verify, timeout, malformed response and
  redacted error mapping;
- server-action tests proving unauthenticated and non-Google callers are denied
  before any provider or service-role call;
- rate-limit, expiry, ownership, one-time consumption and duplicate-phone tests;
- callback tests for PKCE exchange, relative destination validation and error
  routing;
- registration tests proving Google → Verify.ge → confirmed phone → existing
  `register()` and retry-without-second-SMS behavior;
- database tests proving the challenge table is unreadable and unwritable by
  `anon` and `authenticated`;
- existing security, typecheck, lint, formatting and build gates remain green.

Real Google credentials and paid SMS are not used in ordinary unit/CI runs.
Provider calls are replaced by a deterministic test adapter, while the hosted
preview receives one owner-approved live smoke test.

### Preview and production evidence

1. Google sign-in succeeds on the Vercel preview and returns to `/join`.
2. A Starter-plan SMS reaches an owner-controlled Georgian number.
3. Correct code confirms the phone and creates exactly one Supabase user and
   one profile.
4. Logout and Google login return to the same cabinet without another SMS.
5. Wrong, expired and replayed codes fail with Georgian messages.
6. Browser assets and Vercel logs contain no Verify.ge key or OTP.
7. Owner receives the preview URL and plain-language evidence before merge.
8. After merge, the Vercel production deployment must be `READY`, match the
   merge commit and pass the same login/cabinet smoke check.

## 12. Out of scope

- email-link or password login;
- SMS as an ordinary login method;
- automatic merging of pre-existing phone users with new Google users;
- phone-number change, account recovery or sensitive-action SMS flows;
- WhatsApp OTP;
- Verify.ge webhooks;
- a second provider implementation;
- storing Google provider tokens or accessing Google APIs.
