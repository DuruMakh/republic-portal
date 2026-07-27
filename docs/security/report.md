# Security check-up — the report

**Version 0.10.0 · 26 July 2026, revised 27 July 2026 · for the owner**

This is the whole result of the security phase, written to be read without opening a single file of
code. Anything technical is in the appendix at the end, which you do not need to read.

**Nothing on your live site has changed as a result of this work.** That was true when this report
was first written, and it is still true — but now for a different reason. The investigation itself
only looked. Since then, **six of the fourteen findings have been repaired**, and those repairs are
sitting in this work's own branch, not on your site. Your platform changes when this work is merged
and deployed, and not a moment before. Section 7 sets out exactly what has been repaired, what has
not, and which of the two states each thing is in.

---

## 1. In one page

We examined every place on the platform where the software decides whether someone is allowed to do
something, from twelve different starting positions — a stranger with no account, an ordinary
member, an approved delegate, a rejected applicant, each of the four kinds of admin, and so on.
That is 1,824 individual permission checks, plus six separate hunting passes that each attacked the
platform from a different angle, plus a final pass that reproduced every remaining question against
a running system.

**The permission model did not break anywhere.** Not once, in 1,824 checks. Specifically:

- **Nobody can promote themselves.** There is no route from a lower position to a higher one. Every
  privileged ability on the platform has exactly one way to be granted, and that one way is
  correctly guarded. Checked live: there are exactly four admins — one of each role — and the
  entire audit, including every attack, left that number at four.
- **Members cannot read each other.** No member can obtain another member's ID number, date of
  birth, or phone number. Of the twenty-four internal screens the database serves, not one carries
  an ID number, a date of birth or an employment record, and phone numbers appear in only three,
  all of them admin-only.
- **The numbers are honest.** Nothing that should be calculated is stored where someone could edit
  it — no supporter count, no total, no membership figure. Every one is worked out fresh each time
  it is shown.
- **Votes cannot be cast twice or altered.** A second vote is not "rejected" — it is impossible for
  the database to hold one. Once cast, a vote cannot be changed or deleted by anybody, and one
  member cannot see another's ballot.
- **The record of who did what cannot be tampered with.** We attacked the audit trail as a stranger,
  as an ordinary member, and as the super-admin. Nothing could be added, changed, or removed. The
  row count was identical before and after.

**Every real finding is in one place: the sign-up path. Not the vault — the front door.**

Fourteen findings were confirmed. Every one of the serious ones is about how somebody gets into the
platform in the first place, or about what the sign-up form is willing to tell a stranger. Nothing
was found wrong with what happens to people's data once they are inside.

**The tally.** 4 the audit rates Critical, 2 High, 2 Medium, 6 Low. Those words mean: *Critical* — a
person with no account at all obtains something they should not have; *High* — an ordinary account
holder crosses a line they should not; *Medium* — possible, but needs an unusual precondition or the
damage is contained; *Low* — a missing guard with no route to real harm today. Below, the findings
are ordered by **damage to the movement**, not by that label. A further eight defects were found in
the audit's own instruments; they are listed separately in section 5, because they are about the
investigation, not about the platform.

**The worst one is already yours to decide.** On 26 July you read the personal-ID squatting finding,
chose to defer it, and asked to be reminded before the site goes live to real people. It is
reported below as deferred by your decision. It is not re-argued.

**One thing you were told that was wrong, now corrected.** You were told the phone-number
disclosure was fixed. It was fixed *in the code*, and the code has never reached your site. The
site is still running the version with the flaw. That correction is section 7, and it changed how
the remaining work will be verified.

**Impact today, stated honestly and consistently throughout.** Your production address currently
serves the practice database, whose roughly 1,900 people are invented. Real-world harm from every
finding below is therefore near zero **today**. Every severity in this report describes harm **at
launch, with real members**. That is not a reason to relax and not a reason to panic; it is the
reason there is time to decide.

---

## 2. What was checked, and what that claim is worth

### 2.1 The size of the sweep

Every place where the software makes a permission decision was listed first — from the database's
own records and the application's own build output, not from memory — and then each one was tried
from each of twelve starting positions. 152 places × 12 positions = **1,824 individual checks.**
None was skipped for looking uninteresting. The full list, with the result of every check, is in the
coverage table that accompanies this report.

Then six separate hunting passes went over the same ground with fresh eyes: one looking only for
ways to promote yourself, one only for ways to read other people's data, one only for ways to
tamper with money and counts, one only at the sign-in flow, one looking for chains of two harmless
things that combine into a harmful one, and one whose only job was to audit the census itself and
find what it had assumed rather than checked.

Then a final pass took every question the earlier work had left open — 134 of the 1,824 — and
settled each one against a running system. **None of the 134 became a finding.**

### 2.2 What a "clear" result proves

A clear result answers one question: *was this person's request permitted or refused, exactly as it
should have been?* That is the first question an attacker asks, and it is the right question for a
sweep. It is **not** the same as *and did the answer contain only what it should?*

That second question is asked separately, by **1,155 individually named checks** — things like "this
member, reading this screen, must get back zero rows belonging to anybody else". **1,152 of them
hold.** The three that fail are the three sign-up-door findings, written deliberately as failing
checks so that nobody has to spot them in prose.

So "nothing broke" is a claim about both records together, never about the grid alone.

### 2.3 What a clear result does not prove — four honest limits

**One page was missing from the list entirely.** The audit found it by auditing itself: the page
that downloads the whole membership roster as a file, including — on request — ID numbers. It was
never on the list of places to check, because the list of web addresses was typed by hand rather
than read from the project. **The page itself is sound** — we checked it directly against your live
site, and both an anonymous download and an anonymous download-with-ID-numbers were refused, with
three independent guards in front of it. But the honest coverage figure is 153 places, not 152. The
method has been corrected so that this class of omission cannot recur.

**A whole category of database rule was never enumerated.** The sweep looked at permissions, at
row-level rules, and at automatic triggers. It never looked at table constraints — a fourth kind of
rule. We discovered the gap when one of our own findings died on one: a constraint nobody had read
refused a write we had confidently argued was possible. That time the gap worked in the movement's
favour. It still means the map the hunt used was incomplete in a way we can now name.

**The sweep grades the code and the practice database. It does not grade your running website.**
Nothing in the machinery fetches your live address. This is exactly how a fix came to be reported to
you as done when your site was still running the flawed version. It has been corrected as a method,
not just as an apology: after this work merges, every fix will be re-tested against the real
address.

**Some things were deliberately out of scope,** by the plan agreed at the start: custody of
passwords, keys and access tokens across all three service providers; backups and whether a restore
would work; sustained attempts to knock the site offline beyond the sign-in-code quota; personal
data retention and the legal review; and the payment gateway. One finding below (sign-out) also
carries a caveat we cannot resolve from the code alone: a setting in the hosting control panel could
already soften it, and that needs checking directly.

### 2.4 One rule that governs how everything here is stated

A request that is *permitted to run* but *changes nothing and returns nothing* is **not a hole**.
The permission layer stepped aside and the next layer held. Several results below say exactly that,
and they are deliberately not counted as findings. Where it matters — and it does — the fact that
only one layer is holding is reported in its own right, in section 4.

---

## 3. What held

Spec section 3 makes disproofs a deliverable in their own right, and they earned it: several of the
items below had been argued confidently and recorded as probable holes — three of them in the
project's own records — and each died when it was actually attempted. What follows is not filler.
It is the part of the report that says which defences you can rely on.

### 3.1 The four things that would have been the worst findings of the audit, and are not

**Anonymous strangers reading the admin screens.** The permission list really does allow anonymous
callers to read most of the internal admin screens, including the one carrying every member's phone
number. It does not work. Each of those screens asks "is the person asking an admin?" using a
routine that anonymous callers are not permitted to run, so the read dies inside the screen itself.
Confirmed twice, independently, against the live system. This had been sitting in our own records as
an unproven assumption the whole audit rested on; it is now proven.

**An ordinary member promoting themselves to super-admin.** Argued twice from the permission list,
and it looked possible: the permission to write to the admin table is genuinely granted. Attempted
live, from two different ordinary member accounts: refused outright. The admin count went four to
four.

**Erasing or forging the record of who did what.** Attempted as a stranger, as an ordinary member,
and as the super-admin — the position the record exists to constrain. Reads, edits and deletions all
returned nothing; additions were refused. 1,468 entries before, 1,468 after. The one destructive
command that would bypass the row rules entirely was chased to the end: no routine anywhere in the
database can issue it, none of them builds commands dynamically, and the web layer does not offer
it. **No route exists.**

**Live sign-in codes readable by anyone.** Earlier passes read "zero rows" from the table holding
them — but from a table that might simply have been empty, which proves nothing at all. It was
re-run against a table holding fourteen real codes: a signed-in caller sees zero of the fourteen.
Proven, not assumed.

### 3.2 Things that looked like holes and provably are not

- **One member setting themselves to a region they do not live in, paired with a city in a different
  region.** Argued from three separate layers, every one of them read correctly — and still wrong. A
  fourth kind of rule refuses the write. This finding is withdrawn entirely, not softened. (A much
  smaller residue survives and is finding 13 below.)
- **Four internal enforcement routines that anyone is technically permitted to call.** They cannot
  be called at all — not because the web layer filters them out, but because the database engine
  itself refuses, for every user including the most privileged one. Our own recommended repair for
  this was mis-stated in the notes and would have left the permission in place; that has been
  corrected so the fix wave does not inherit the error.
- **Zeroing the single setting that decides who counts as an active member** — which would have
  demoted the entire membership at once. Attempted as a member and anonymously: the command runs and
  changes nothing. The value was 30 before and 30 after.
- **Application code reaching the privileged database key without re-checking who is calling.**
  Exactly two places touch that key. Both check the caller's role first, in the correct order. One
  of them additionally refuses to accept a photograph for a delegate who has been rejected *before*
  the upload happens — a deliberate ordering choice, correctly made.
- **A delegate reading a rival delegate's team.** No route exists from a delegate to anyone else's
  team. The scoping is exactly right, character for character. (Staff roles can reconstruct it —
  see the governance decision in section 6.)
- **A rejected delegate applicant restoring themselves.** Not possible from the member's side; the
  table is fully sealed. (A single verifier can reinstate them by decision — again, section 6.)
- **Sign-in code guessing, code reuse between phones, and reusing a spent code.** All limited by the
  authentication provider itself and confirmed.
- **A dismissed admin's old session still working.** It does not. Roles are read fresh on every
  single request, so a revoked admin becomes an ordinary member on their very next click.
- **Double-counting a payment by voiding and re-recording it; re-using a referral code; back-dating
  a payment to buy extra months; two membership changes racing each other.** All chased; all clean.

### 3.3 What the sweep confirmed positively

Not "we found nothing", but "we checked and it does what it should": every one of the four admin
roles was tried against every other role's abilities, and no role reached outside its own — the
verifier cannot record a payment or read a member's ID number, finance cannot approve a delegate or
publish anything, the editor cannot record a payment or grant a role, and none of the three can
grant roles or change settings. Each of those was tried twice: once directly against the database,
and once through the application, using a real signed-in session belonging to the wrong person.

The helper routines every guard depends on were checked against the truth, per person, rather than
assumed — because if the routine that answers "is this person an admin?" ever answered wrongly,
every guard on the platform would open at once and each one would still report itself as working.

And the file-upload areas were checked for the verbs nobody thinks to check — not just "can you
upload", but "can you list" and "can you delete". All refused, for all twelve positions.

---

## 4. What was found, ordered by damage to the movement

Each entry says who can do it, what they can do, and what it means. The audit's internal identifiers
are in the appendix so anything here can be traced.

### 4.1 The deferred one

#### Finding 1 — Someone can claim a real person's government ID number, and that person can then never join

**Status: deferred by your decision, 26 July 2026. Recorded in the launch-blockers list. It is
stated here because a report that omitted it would be dishonest — not to reopen the decision.**

**Who can do it:** anyone who can make an account. Today that costs nothing at all: findings 3 and 4
below are two separate free doors.

**What they can do:** type a real citizen's eleven-digit government ID number into the ordinary
sign-up form, under any name they choose. The form checks only that the number is eleven digits —
no checksum, no proof of ownership, no check against any registry. That number is now taken, and
nothing is written to the movement's own record of events, so the act is silent.

**What it means:** the real person can never join. When they try, they are told
`ეს პირადი ნომერი უკვე რეგისტრირებულია.` — *this personal ID is already registered*, i.e. *you already signed up*. There
is no way to undo it inside the product: no admin screen releases an ID, nothing deletes a member
record, and nobody can edit an ID number. Only direct hand-editing of the live database could fix
it, which the project's own rules forbid.

And there is a sharper end. If the person who claimed the ID then applies to be a delegate, that
victim's real government ID becomes visible to any volunteer holding the verifier role, attached to
the attacker's chosen name — and the movement's permanent record files that as fact. The roster
export then carries it out as a file. For a movement facing a hostile state, that is not blocked
enrolment. It is a way to manufacture evidence about a real person who has never touched the
platform.

**How we know it is real:** the irreversibility was the part worth proving, and it was proven
exhaustively — every database change ever applied to this platform and every operation the
application can perform were enumerated. There is nothing that releases an ID number, nothing that
deletes a member record, and no permission that would let a member edit their own.

**Note the dependency:** closing the sign-in-code door does *not* fix this. The email door (finding
4) survives that change and manufactures accounts just as freely.

### 4.2 The rest, in order

#### Finding 2 — Anyone with an account can silently confirm, one name at a time and without limit, whether a named person is a member

**Who can do it:** anyone signed in. Signing in is currently free (findings 3 and 4).

**What they can do:** type a person's government ID number into the public sign-up form. The form
gives a visibly different answer depending on whether that number already belongs to a member —
"this ID is already registered" versus "an ID must be eleven digits". No tools, no technical
knowledge; it is on the screen.

**What it means:** an adversary can go down a list — employees of one company, students at one
faculty, journalists, civil servants — and learn which of them belong to this movement. Nothing is
recorded when they do it. The movement would never know it had been asked. For each individual
named, that is most of the harm of a full roster leak, delivered retail instead of wholesale, with
no breach to disclose and nothing to respond to.

**How we know it is real:** reproduced live, all three of its answers, from an account that had
never registered — and reversed so completely that nothing was left behind.

**A correction to our own threat model.** Our records said this question could only be asked once
per account, and counted that limit among the things holding the risk down. **That is not true, and
the claim has been removed.** A *yes* answer costs nothing and leaves the account fully usable, so
one account can ask an unlimited number of times. Only a *no* answer consumes the account — and that
same request is what permanently claims the ID (finding 1). Against a target list, then, the
attacker's position is: every member is confirmed silently and for free, and the first non-member is
both revealed and locked out.

#### Finding 3 — A stranger with no account can obtain a working sign-in code for a phone number they do not own

**Who can do it:** anybody on the internet.

**What they can do:** ask the site to send a sign-in code to any number that has no account yet,
then read that code straight off a public address on your own site, then use it. They now hold a
genuine session for a phone number they do not control, and can complete registration through to a
voting member — with no payment and no admin involvement.

**What it means:** members can be manufactured at scale. A manufactured member can attend-and-count
for events, vote in internal polls, and be attached to a delegate's team — either to inflate a
friendly delegate's numbers or to flood a rival's so the fraud is later blamed on them. The
movement's public headline figure and its internal votes become things an outsider can set.

**Existing members are protected** — the site withholds codes for numbers that already have an
account — so this manufactures *new* accounts. It is not takeover of anyone's existing account.

**How we know it is real:** this audit's own tooling creates all twelve of its test accounts by
exactly this route. The chain is not a theory; it is executed code in the project.

**Why it is still open:** the address exists so that you can read test codes on screen, which you
asked for on 20 July. The only complete fix is removing it, and the plan for this phase deliberately
assigned that to launch hardening rather than to this work. You are being told plainly rather than
having it quietly dropped as out-of-scope. See section 6.

#### Finding 4 — Anyone can create an account with an email address alone, instantly, with no phone number at all

**Who can do it:** anybody on the internet.

**What they can do:** sign up with an email address and password. The account is confirmed
immediately — no email is even sent, and there is no "prove you are human" step. They then hold a
session with no phone number attached, and registration accepts it: nothing requires a phone at the
point where membership is granted.

**What it means:** the platform's core assumption — *one SMS-verified phone number, one person* — is
not enforced where it matters. Everything in finding 3 follows from here as well, and this door
survives closing that one. It is also the second free route into finding 1.

**How we know it is real:** read directly from your hosted project's own live settings.

**Nobody has used it:** there are zero email accounts on the platform. The door is open and unused.

**The fix needs both halves:** turn the email door off (the application has no email sign-in screen
and never uses it) *and* require a verified phone at registration. Either one alone leaves the other
open.

#### Finding 5 — Until the fix reaches your site, the public site answers "does this phone number belong to a member?" to anyone who asks

**Who can do it:** anybody on the internet, with no account.

**What they can do:** ask about any Georgian mobile number and read the answer two different ways —
the refusal is worded differently for a number that has an account than for one that does not, and
the two take visibly different times to come back, about six seconds apart. Either channel alone is
enough; making the wording identical would not have closed the timing one.

**What it means:** the public website becomes a lookup service for the question *is this person a
member of the opposition movement?* over the whole mobile range.

**How we know it is real:** measured on your live public address, twice, on 26 July.

**Status:** a fix is written, tested and committed, and is **not on your site** — see section 7. The
fix closes this passive version completely. What remains after it is finding 3: someone who first
triggers a text message to the target can still tell the difference. That is weaker — it is noisy,
it costs a real SMS to the target, and it is rate-limited — but it is not zero, and the only
complete cure is removing the address.

**One awkward detail worth knowing:** the invented phone numbers on the practice database sit inside
a real allocated Georgian range. So today the lookup sometimes answers "yes, a member" about a real
number that merely collides with an invented one — false claims about real people rather than true
claims about real members.

#### Finding 6 — Signing out does not sign you out

**Who it affects:** everyone, and it matters most for the four admins.

**What happens:** the "log out" button clears the browser and leaves the account signed in on the
server. There is no maximum session length, no inactivity cut-off, and no way for anyone — including
you — to force a session to end. The session renews itself indefinitely.

**What it means:** an admin who logs out on a shared computer, or whose laptop is taken, is not
actually signed out, and there is no button anywhere that would make it so. If a device is seized,
the person holding it holds a working admin session for as long as they want it, and everything they
do is recorded under the real admin's name — which makes the movement's own record actively
misleading rather than merely incomplete.

**How we know:** read from the application code and the session settings.

**One caveat we cannot close from here:** the hosting control panel could already carry a maximum
session length that the settings we can read do not report. That needs checking directly before
anything is changed.

#### Finding 7 — One click by a member permanently removes an admin's ability to move that member between delegates

**Who can do it:** any member, by applying to become a delegate — including one whose application is
then rejected.

**What happens:** from that moment, no admin can reassign that member to a different delegate, ever.
The application record is never deleted, not even on rejection, and the reassignment tool refuses
anyone who has one. Meanwhile the member keeps full control of their own delegate choice. Nothing is
recorded when this happens.

**What it means:** if a delegate's team is ever inflated — by manufactured members, or by a
verifier moving people between the teams they are judging — admins cannot unwind it, member by
member, if those members have each applied for delegacy once. The asymmetry is the defect: an
earlier fix narrowed the member's side of this rule and did not narrow the admin's side with it.

**How we know:** confirmed against live data. **Six members are already in this state today**,
reached by accident rather than by anyone's intent.

#### Finding 8 — The revenue figure on the finance dashboard is what members say they intend to pay, not what they have paid

**Who can affect it:** any active member, for their own line.

**What happens:** a member can set their own monthly rate to any of the three options with no
payment and no admin involvement. The finance dashboard adds up those chosen rates and presents the
total as monthly revenue. A member can inflate their own contribution to the figure fourfold by
changing one dropdown.

**What it means:** an internal figure the movement uses to plan is not a measure of money. It is
bounded — you must already be an active member, which requires a real recorded payment — and the
**public** transparency total, the one that says how much money the movement has actually received,
is calculated from real payments and is sound. This is a truthfulness defect in one internal number,
not a way in.

#### Findings 9–14 — the six with no route to harm today

These were each attacked and each held. They are listed because in every case the margin is thinner
than it looks, and because a report that only listed live wounds would leave you unable to judge how
much is holding the platform up.

**9. The anonymous lockdown on ID numbers was never applied.** The step that hides ID numbers, dates
of birth and phone numbers from other signed-in members was applied to signed-in users only, and
never to anonymous ones. Nothing has leaked — for an anonymous caller a single row rule returns
nothing, and it does hold, verified. But for the most sensitive read on the platform an anonymous
stranger faces **one** barrier where a signed-in member faces two. That is a defect in a hardening
step (it named one kind of user where the intent plainly covered both), not an accepted default.

**10. Eleven internal screens are technically writable by anonymous strangers, and what refuses them
today is an accident.** When a stranger tries to write to the admin table, the database says *a
security rule refused you*. When a stranger tries to write through one of these eleven screens, the
database says *this screen has the wrong shape to be written through* — meaning the security check
already passed, and only the shape stopped it. Two of those screens are one real table plus a
cosmetic join to show somebody's name. Remove that join — an ordinary tidy-up no reviewer would
question — and anonymous writes into the settings table and the admin table become live. The repair
is cheap and changes no behaviour.

**11. The payments record has one lock where the audit trail has two.** Payments drive both
membership standing and every money figure, and are protected only by a row rule — there is no
"cannot be altered" enforcement of the kind the audit trail has, and a direct write to it would
leave no trace. It holds today, and a forged payment on its own promotes nobody, because standing is
written by a separate mechanism no client can reach. Two locks would have to fail, not one.

**12. The database's default permissions are wide open across the board, and one layer is doing all
the work — correctly.** On the tables holding ID numbers, the money, the admin roles and the audit
trail, the thing standing between an anonymous stranger and the asset is a single row-level rule.
Every attempt we made either failed at that rule or was permitted and changed nothing. This is the
standard posture of the platform the project is built on, so it is not automatically a defect. What
makes it worth stating is the inconsistency: this project's own history shows the team *did* tighten
permissions deliberately where it cared — the newer community tables got exactly that treatment —
and the tables holding the personal IDs, the money, the roles and the audit trail never did. The
defence was applied last where it was needed first. **This is not a breach and must not be read as
one.** It is a statement about how much depends on one rule.

**13. A member can put themselves in a different region, or in no region at all.** A member can
change their own stated region and city directly, outside the sign-up form, to any coherent pair —
or drop out of every regional count by clearing it. It shifts an internal regional breakdown that
only admins see. No boundary is crossed: it is their own record and their own declared location, and
nothing downstream grants anyone power based on region.

**14. A member controls the divisor that turns a payment into months of membership.** How many
months a payment buys is the amount divided by the member's own currently chosen monthly rate.
Finance sets the amount but cannot set the divisor at the moment of recording, so a member can
minimise it. Largely by design — the rate is meant to be self-selected — and flagged only because
finance has no way to override it.

---

## 5. Eight defects in the audit itself

These are about the investigation, not the platform. None of them is a hole in your site. They are
listed because an audit that hides its own weaknesses is worth less than one that names them, and
because they tell you how much to trust the "nothing broke" claim.

- **Four checks stated an expectation that the live system contradicted.** Found and corrected
  during the audit. The reason it mattered more than four rows: the "obvious next improvement" to
  the grading rules would have turned those four into four confident but false alarms against
  correct behaviour.
- **The roster download page was never on the list.** Covered in section 2.3. The page is sound;
  the coverage claim was not.
- **A guard meant to protect one of the grading rules turns out to check something trivial.** The
  rule it protects is true today — verified by hand across every routine in the database — but the
  guard would not notice if that stopped being true.
- **The sweep never checks how much came back from a routine, only whether it was allowed.** So if a
  delegate's "show me my team" routine ever lost its own scoping and started returning the entire
  membership, the sweep would still mark it clear. It is correct today, checked by hand. It is not
  watched.
- **A field intended to record whether an expectation was hand-verified or machine-guessed never
  varies,** so it distinguishes nothing.
- **One family of checks works by listing forbidden things rather than permitting known-safe ones,**
  so a screen returning nothing passes without proving anything, and a sensitive field nobody
  thought to list would pass silently. Not biting today.
- **A second query-and-write interface over the same data is one switch away.** It is currently off,
  and turning it on takes one click in a dashboard — no code change, no review — and it would not be
  covered by anything in this audit.
- **An existing schema self-check claims to prove something it does not.** Its success message says
  it confirmed that sign-in codes are unreadable; the branch that prints that message can never run.
  A regression on that exact table would pass the check silently.

**Also worth your confidence, in the same spirit:** three separate proposed "improvements" to the
audit's own grading were caught before they did damage — one would have manufactured nine false
alarms, one four, and one would have graded a genuine ID-disclosure hole as expected behaviour.
Each was caught by an independent reviewer re-deriving the answer from the live system rather than
accepting the reasoning.

---

## 6. Decisions only you can make

### 6.1 Fixes that would take away something a real person can do today

Nothing in this list will be done without your say-so. This is the pre-notification the process
requires, described as *who loses what*.

| The fix | Who loses what |
| --- | --- |
| **Removing the on-screen test-code box** — the only complete cure for finding 3, and the last of finding 5 | **You.** You asked for it on 20 July and it is the sole reason that door is open. Test sign-ins would need a real SMS again. Nobody else uses it. |
| **Turning off email sign-up** (finding 4) | Anyone who wanted to sign in with an email and password. **Today: nobody.** There are zero such accounts and the app has no email sign-in screen. |
| **Requiring a verified phone before registration can complete** (finding 4) | Anyone holding an account with no phone number. **Today: nobody.** |
| **Ending sessions** — a maximum length and an inactivity cut-off (finding 6) | **Every member and every admin.** They would be signed out on a schedule and have to sign in again with an SMS code. That is a real day-to-day change and it costs SMS sends. How long a session should last is your call, not the audit's. |
| **Letting admins reassign a member who has applied for delegacy** (finding 7) | **Members lose a veto they hold today** over their own delegate binding — one they almost certainly did not know they had. Six members currently hold it. |
| **Computing the revenue figure from actual payments** (finding 8) | Nobody loses an ability, but the number on the finance dashboard will drop, possibly a lot. It should. |
| **Letting finance set the rate a payment is measured against** (finding 14) | Members lose sole control over how many months a given payment buys them. |

**Fixes that take nothing away from anyone,** for contrast: withdrawing the unused write permissions
on the eleven internal screens; withdrawing anonymous access to ID numbers, dates of birth and phone
numbers; adding a cannot-be-altered lock to payments; withdrawing three unusable permissions;
validating region-and-city on direct writes; and the phone-oracle fix already written.

### 6.2 Things that cannot be closed by a repair, and need a decision

1. **Personal-ID squatting (finding 1) is a design question, not a bug.** Already deferred by you.
   When it returns, the choice is between: an admin being able to release a claimed ID — which does
   not exist today and needs its own rules about who may do it and what proof they must see — or an
   unverified, self-typed ID number no longer acting as a permanent, global lock. Both change what
   registration means. Note the sequence: making accounts cost something (findings 3 and 4) is a
   precondition, and does not close this on its own.

2. **The complete fix for the sign-up door is out of this phase's scope on purpose (finding 3).**
   Your options: accept it until launch hardening; bring that work forward now; or keep the door and
   put the test-code box behind a password. This one is live right now, which is why it is a decision
   rather than a schedule item.

3. **Session policy (finding 6).** How long should a session last? Should admins be forced to sign
   in again on a schedule? Should there be a way to end somebody's session — for instance when a
   volunteer leaves, or a device is lost? None of these has a technically correct answer; they are
   trade-offs between safety and how often people have to wait for an SMS.

4. **The admin roles read wider than their names suggest — and you were never told.** The volunteer
   given the narrowest-sounding job on the platform, recording bank transfers, can download the
   entire membership with phone numbers as a single file. Both that role and the verifier role can
   read every member's name and phone number. This is designed behaviour, not a hole, and it is the
   version of a roster leak most likely to actually happen: not a break-in, but a trusted person who
   is later pressured, or whose laptop is taken. Whether it should stay this way is yours to decide.

5. **Several decisions rest in a single pair of hands.** One verifier alone can reinstate a rejected
   delegate applicant, with no second signature and no waiting period. One verifier can approve their
   own delegate application. One editor alone can publish under the movement's name, and can cancel
   a published event in a way nothing in the product can reverse. All of these are recorded in the
   audit trail, and none is a break-in. All of them are single-handed.

6. **Encrypting ID numbers in the database was deferred on 12 July with a note to revisit "at the
   Phase 6 audit, before public launch".** This is that audit. The decision is now due.

7. **What the finance dashboard's revenue figure should say** (finding 8) — a stated intention, an
   actual receipts figure, or both side by side.

---

## 7. What is fixed, what is not, and what happens next

### 7.1 Nothing on your site has changed

The investigation was conducted against the practice database and against your public address as a
reader. It did not repair anything on your running site, and it did not touch real member data —
there is none to touch.

Repairs have since been written (7.2). **They are not on your site either.** Everything below keeps
those two states apart deliberately, because conflating them is the one mistake this report has
already had to correct once: *written and tested* is not *deployed*. Your site is built from the
main line of the project; this work sits on its own branch and has not been merged into it. Until it
is merged and deployed, your platform behaves exactly as sections 3 and 4 describe it.

### 7.2 What has been repaired, and the correction that goes with it

**Six of the fourteen findings now have repairs written and tested.** Every one of them is
**committed to this work's own branch and has never reached your site.**

| # | Finding | What the repair does |
| --- | --- | --- |
| 4 | Email sign-up enabled and auto-confirmed | The membership half is closed: no one can become a member without a verified phone number, whatever they signed up with. The email door itself is a project setting and is still open — see 7.5. |
| 5 | Anonymous phone-number membership oracle | The sign-in-code page no longer answers *"does this number have an account"* — through either of the two channels it was answering through. |
| 7 | A delegacy request permanently voided admin reassignment | Repaired. The six members already stranded by it can be moved again. |
| 9 | Anonymous access to ID numbers, birth dates and phone numbers | A stranger now holds no access of any kind to the member table — refused a layer earlier than before. |
| 10 | Eleven internal screens carried anonymous write permissions | Removed, from all twenty-four screens rather than only the eleven. |
| 11 | The payments table was defended by one layer | It now has two. A recorded payment cannot be altered or deleted, only added and voided; and a stranger holds no access to the table at all. |

**You were told the phone-number lookup was done. That was true of the code and false of your
exposure, and the correction is this:** your site has been serving the flawed version the entire
time, which we confirmed by measuring your live address — it still gives the two different answers
the fixed version cannot give. That fix, and all five beside it, reach you when this work merges.

The method has changed as a result. The verification for that fix was run against a copy on a
developer machine, never against the address you actually sign off on. Nothing in the audit's
machinery ever fetched your running site. From here, every fix is re-tested against the real address
after merge, and "fixed" stops being allowed to mean "fixed in a file".

### 7.3 What is not repaired

**Eight of the fourteen confirmed findings have no repair.** They are: the personal-ID squatting
finding you deferred by name (1); the registration form confirming to a stranger that a given
government ID number is already on the platform (2); the sign-in-code page still handing a usable
code to a stranger for a number with no account (3); sessions that never end (6); the revenue figure
being member-declared (8); and the three lowest — the wide default permissions (12), region and city
being self-assignable by direct write (13), and the member controlling their own coverage divisor
(14).

Of the eight defects in the audit's own instruments, one was corrected during the investigation
itself, and one — the roster download page that was never on the list — has been added to the
inventory in this branch, though its own checks are still unwritten and are honestly marked as such.
The remaining six are unrepaired.

**And the sentence that matters most is unchanged:** *nothing this audit found has been closed on
your running platform.* The six repairs in 7.2 are in a branch, not on your site. They take effect
on your platform the day this work is merged and deployed — and every one of them is re-tested
against your real address at that point, not before.

### 7.4 Where this now stands

You set the scope on 26 July, and that work has run: six repairs, each with a test that performs the
attack and fails before the repair exists, each reviewed on its own and then again across the whole
set together.

What remains of the process is unchanged and still yours: the practice database reseeded clean, a
preview link for you to sign off on, then the release. Nothing merges on a failing check and nothing
goes to the main line without your sign-off on that link. The decisions in section 6 that you have
not yet taken are still open, and 7.5 is the list that must be raised again before launch.

### 7.5 The reminder you asked for

Four items are deferred by decision and must be closed **before real people register**, and **all
four are still open**: the personal-ID squatting finding you deferred by name; the sign-in-code
door, which by your decision retires when the site goes live rather than being repaired; the email
sign-up door, whose code half is repaired in this branch while the project setting itself remains
yours to switch off; and sessions that never end.

The three items that sat beneath them — the anonymous write permissions, the anonymous access to the
member table, and the delegacy-request defect — are repaired in this branch. They stay on the list,
marked as repaired-but-not-deployed, until this work is merged and deployed.

The list is kept as a standing document alongside this report, and nothing may quietly drop off it:
if a phase ends without addressing an item, it stays on the list. **You asked to be reminded before
going live. This is that list, and it will be raised again the moment launch is discussed.**

---

## Appendix — technical detail and where the evidence lives

*You do not need to read this. It exists so that anyone who does read code can trace every claim
above.*

### A. Documents

| Document | What it holds |
| --- | --- |
| `docs/security/coverage.md` | Every one of the 1,824 checks, surface by surface, with the result and the reasoning. Generated from the evidence files, not written by hand. |
| `docs/security/findings.md` | The finding register: each confirmed finding with severity and evidence, and every recorded disproof. |
| `docs/security/threat-model.md` | The 23 threats, ranked by damage. The ranking is the ordering key used in section 4 above. |
| `docs/security/LAUNCH-BLOCKERS.md` | The deferred items from section 7.5. |
| `docs/security/ledger.json`, `row-scope.json`, `row-scope-app.json`, `residue.json` | Raw machine evidence: every probe result, every named assertion, and every row the audit created. |

### B. Finding identifiers

**Status** below is one of three, and the middle one is not the last one: *open* (no repair exists),
*repaired in branch* (written and tested, **committed and not deployed** — your platform is
unaffected until this work merges), and *deferred by owner*.

| Report | Register ID | Severity | Threat | Status |
| --- | --- | --- | --- | --- |
| 1 — personal-ID squatting | F13 | Critical (deferred by owner) | R1 / R15 | Deferred by owner (LB-1) |
| 2 — government-ID membership oracle at registration | DL-1 | High | R6 (and R1 retail) | Open |
| 3 — anonymous caller obtains a usable login code | F2 | Critical | R2 | Open — retires at launch per ADR-021 (LB-2) |
| 4 — email sign-up enabled and auto-confirmed | F3 | Critical | R2's consequence set | Code half repaired in branch; provider setting open (LB-3) |
| 5 — anonymous phone-number membership oracle | F1 | Critical | R2 / R6 | Repaired in branch |
| 6 — sign-out is local only; no session expiry | F4 | High | R4 | Open (LB-4) |
| 7 — delegacy request voids admin reassignment | F14 | Medium | R15 | Repaired in branch (LB-7) |
| 8 — revenue figure is member-declared | L3-1 | Medium | R14 | Open |
| 9 — anonymous column grants on ID / birth date / phone | CF4 | Low | R1 / R12 | Repaired in branch (LB-6) |
| 10 — eleven views carry anonymous write grants | F5 | Low | R7 / R9 | Repaired in branch (LB-5) |
| 11 — payments defended by one layer | L3-2 | Low | R14 | Repaired in branch |
| 12 — wide default grants, row rules alone holding | CF1 | Low | R7 / R8 | Open |
| 13 — region/city self-assignable by direct write | F15-R | Low | R15 / R22 | Open |
| 14 — member controls the coverage divisor | L3-3 | Low | R14 | Open |

Instrument defects (section 5): F11, F6, F7, F8, F9, F10, F12, CF2. Withdrawn entirely: **F15** —
refuted by a composite foreign key, and removed rather than softened.

### C. Threat-model correction made by this report

Threat R6's "Held today by" line credited *the per-session single-shot nature of `register()`*. That
control does not exist: the duplicate check raises before the insert, so a positive answer writes
nothing and leaves the session usable. The claim has been deleted from `threat-model.md` rather than
repeated. Confirmed by live reproduction of all three branches inside an aborted transaction (Pass
4).

### D. Method, in one paragraph

Twelve fixture accounts were driven to twelve genuinely distinct standings and asserted against the
database rather than merely declared. The surface list was generated from live catalog introspection
and from the build's own server-reference manifest, then reconciled — 152 surfaces, later 153.
Expectations were read from the **live** object definition in every case, never from the migration
that first created it; that rule caught two would-be false findings on its own. Pass 4's write
probes each ran inside a single statement ending in a raise, so PostgreSQL itself rolled the
experiment back rather than a teardown that could fail, and the privilege context was reproduced the
way the API gateway reproduces it. Pass 4 spent **zero SMS sends** and left **zero residue**,
verified afterwards from the database. Two acknowledged limits: Pass 4 reproduces the database's
answer rather than the gateway's framing of it, and table constraints were never introspected.

### E. Residue on the practice database

The audit created twelve disposable test members, twelve fixture actor accounts, and a set of
per-probe target rows, all tagged. Every one is listed by id in `residue.json` and is removed by the
end-of-phase reseed. The exception is audit-trail entries written by successful probes: those are
permanent by design — that permanence is one of the properties this audit verified — and they are
recorded rather than removed.
