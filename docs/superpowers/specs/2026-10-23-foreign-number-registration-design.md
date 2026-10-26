# Foreign phone numbers at registration

## Outcome and agreed scope

People who live abroad can register with their foreign mobile number. Today every layer accepts
only Georgian mobiles (`+9955XXXXXXXX`), and Verify.ge cannot deliver abroad: on 2026-10-22 a
test send to a Dutch number failed on both SMS and WhatsApp, while the same key delivered to a
Georgian number (and silently sent SMS when WhatsApp was asked for).

Owner decisions (2026-10-23/25): **Georgian numbers stay on Verify.ge, unchanged. Twilio Verify
handles foreign numbers only, SMS only.** No monthly fee; $0.05 per successful code plus the
SMS. WhatsApp is out of scope: Twilio requires our own WhatsApp sender and Meta business
account, and its SMS fallback is a sales-only pilot.

Twilio is proven: the owner's account is upgraded with a $20 prepaid balance, its business
profile is approved (2026-10-25), and a Verify service "Respublika" exists. A test code to
+31 654 798 014 was **delivered** on 2026-10-25 at $0.1143 for the SMS. Keys and the service ID
are in the local `.env.local` (`TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`,
`TWILIO_API_KEY_SECRET`, `TWILIO_VERIFY_SERVICE_SID`); production gets them in Vercel at release.

Membership does not change: it still needs a Georgian personal ID number, so foreigners can be
supporters; citizens abroad can become members.

## Approach

**Number rules (`lib/`).** Replace the Georgian-only normaliser at the registration boundary
with one that returns `{ phone, country }` for a Georgian mobile or for a mobile from an allowed
country, else a reason (`invalid` / `country_not_supported`). Parsing uses libphonenumber-js
(recorded in DECISIONS.md): the `+1` calling code alone mixes the US and Canada with
Caribbean islands that are classic SMS-fraud targets, so the country must come from the number
plan, not the prefix. The allow-list is a constant in code, changed by PR.

**Proposed allow-list (owner to confirm):** EU and EEA countries, United Kingdom, Switzerland,
United States, Canada, Israel, Turkey, Ukraine. Russia is left out by default (expensive routes,
and an owner call on its own).

**Sending.** `+995` goes to Verify.ge exactly as today, and never to Twilio. Any other allowed
number goes to a new `twilio` provider (Verify v2 REST over `fetch`, no SDK; API key + secret +
service ID from env vars). Each challenge already stores its provider, so checking a code uses
that provider instead of the single global `PHONE_VERIFICATION_PROVIDER`. Without the Twilio
env vars, foreign numbers get "not supported yet", so the code can ship before production is
configured. The local/CI `test` provider serves both kinds of numbers.

**Database (one migration).** Relax the phone check on the two verification tables to E.164,
allow provider `twilio`, and add a site-wide brake to the send reservation: at most
**100 foreign sends per 24 hours** (proposed, owner to confirm). Per-user and per-number limits
stay as they are. Georgian sends do not count toward the brake.

**Money brake at Twilio.** Prepaid balance with auto-recharge off, so the most we can ever lose
is the balance. Twilio's fraud guard stays on. Its Verify geo-permissions allow SMS only to the
countries on our allow-list; Georgia stays blocked there, since Georgian numbers never use
Twilio.

**Screens and text (Georgian and English).** The phone hint says numbers from abroad are
entered with the country code (e.g. `+49 …`); errors distinguish "wrong number" from
"this country isn't supported yet"; the hint under the field stops naming Verify.ge and says
"the SMS service". The privacy notice already covers an SMS provider and processing in the US,
so it needs no change. Foreign numbers display in international format in the cabinet and
admin pages, and the admin "grant role by phone" form accepts them too. The old phone-OTP
sign-in (not used in production) stays Georgian-only.

## Verification and delivery

1. Failing tests first: number rules (Georgian, allowed foreign, `+1` Caribbean refused, junk),
   provider routing (`+995` never reaches Twilio), the Twilio client against recorded responses,
   the database checks and the site-wide brake.
2. All five repository checks, build, and a local browser journey registering with a foreign
   number through the test provider; desktop and mobile screenshots in both languages.
3. One real registration from the local copy through Twilio to a foreign number the owner can
   reach, plus one Georgian registration through Verify.ge to show it is unchanged.
4. One PR with the migration and the code, one review, owner sign-off in chat, merge; then apply
   the migration to production, add the Twilio env vars in Vercel from `.env.local`, and check
   respublika.ge.

Owner's part: confirm the country list and the daily brake; at release, switch on the agreed
countries in Twilio's Verify geo-permissions (console only, the agent has no access to it).
