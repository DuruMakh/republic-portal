/**
 * Task 7: the argument table and the per-probe isolation scheme for the 54
 * database functions.
 *
 * ## Why an argument table exists at all
 * An argument-mismatch error is INDISTINGUISHABLE from inaccessibility at the
 * ledger level: PostgREST answers a wrong signature with PGRST202 and Postgres
 * answers an unknown one with 42883, and lib/security/verdict.ts deliberately
 * routes both to `needs-live-proof` rather than letting them clear a deny
 * expectation (see DENIED_BY_PRIVILEGE's comment there). Task 4 called every
 * function with `{}`, so 504 of its 648 function cells came back PGRST202 --
 * not a security result, a probe defect. The fix is one valid argument object
 * per function, built for a caller who SHOULD succeed, and then used unchanged
 * by all twelve actors, so the only variable across a row of the matrix is who
 * is calling.
 *
 * ## Every expectation here is derived from the LIVE catalog
 * Signatures come from `pg_get_function_identity_arguments`, gates from
 * `prosrc`, grants from `proacl` -- read on 2026-07-25 from the live staging
 * database, never from the first migration that happens to mention a function.
 * That distinction has already burned this phase three times (a view re-created
 * with a different gate, a trigger whose guarded-column list had changed, an
 * aggregate view whose predicate no longer parsed). The derivation is written
 * up per function in .superpowers/sdd/task-7-report.md and mirrored into each
 * manifest entry's `note`.
 *
 * ## The isolation scheme: one disposable target per (function, actor) pair
 * These functions really do things -- approve a delegate, record a payment,
 * close a poll, delete news. The actors who are supposed to succeed DO succeed,
 * so without isolation the twelfth probe would run against state the first
 * eleven had already chewed through, and the run would not reproduce. Postgres
 * transaction rollback is not available (each RPC is its own transaction over
 * PostgREST and the client cannot wrap it), so freshness is the mechanism:
 *
 *   1. A pool of TWELVE disposable "victim" members, one bound to each actor
 *      slot, created once and reused across runs (phones +9955090020001..0012,
 *      audit-tagged so the end-of-phase reseed sweeps them; see victimPhone()
 *      for why that block cannot collide with anything real). Actor A9's probes
 *      only ever touch victim 9, A10's only victim 10, and so on -- so the
 *      twelve actors never contend for a row even though probe.mjs runs them
 *      in PARALLEL.
 *   2. `setup()` runs immediately before each individual (function, actor)
 *      probe and re-mints the exact row that call will act on -- a pending
 *      delegate, a draft poll, an unvoided payment. Every actor therefore
 *      attacks an identical FRESH target and the twelfth result is comparable
 *      to the first.
 *   3. `teardown()` runs immediately after, and exists for one reason only: to
 *      keep a probe from changing an actor's or a fixture's standing. It never
 *      deletes evidence -- audit_log is append-only and nothing here touches
 *      it -- it only removes rows this task itself minted seconds earlier.
 *
 * Read-only functions declare `readOnly: true` (23 of the 54) and get no setup
 * at all, so the runner skips the minting cost for them. Seven more write but
 * need no PRE-minted row -- they mint their own, act on the pool victim, or
 * only append to audit_log -- and are marked `noTarget: true`. The remaining 24
 * carry a real `setup`.
 *
 * ## The one deliberate abstention, recorded rather than hidden
 *   - `request_delegacy()` for A9-A12. It would create a real `delegates` row
 *     for each of the four CANONICAL staging admins (scripts/seed-staging.mjs
 *     owns them; this audit's standing instruction is not to mutate them).
 *     Reversible in principle, but a teardown that fails over the network
 *     leaves a super_admin sitting in the delegate queue on staging. Recorded
 *     with the documented "SKIP-MUTATING" sentinel and escalated, not guessed.
 *   - Nothing else. The other 646 cells are invoked for real.
 *
 * ## The service-role client here NEVER probes
 * `db` is imported for minting and teardown only. probe.mjs still does not
 * import it (see that file's header) -- the only thing crossing this boundary
 * is a fixture id.
 */
import { db } from "./db.mjs";

/** Same tag actors.mjs stamps on every audit-created account. */
export const AUDIT_TAG = "security-audit-2026-07";

/** Everything this run minted, drained by probe.mjs into docs/security/residue.json. */
export const MINTED = [];

function record(kind, id, surface, actor, note) {
  MINTED.push({ kind, id: String(id), surface, actor, note, at: new Date().toISOString() });
}

const rand = () => Math.random().toString(36).slice(2, 10);
const slug = (p) =>
  `${p}-${Date.now().toString(36)}-${rand()}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

/** The 20-char project ref admin_set_news_image's URL regex pins uploads to. */
const PROJECT_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
  /^https:\/\/([a-z0-9]{20})\.supabase\.co.*$/,
  "$1",
);

// ---------------------------------------------------------------------------
// The disposable victim pool
// ---------------------------------------------------------------------------

const ACTOR_SLOTS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A11", "A12"];

/**
 * +9955090020001..0012 -- a deliberately synthetic block, longer than a real
 * Georgian number (+995 plus nine digits) and therefore incapable of colliding
 * with the seed roster (+99550 plus a 7-digit member index), with actors.mjs's
 * own +995509001xxx block, or with the four canonical admin phones. Verified
 * zero collisions against live auth.users before first use. These accounts
 * never receive an OTP -- they are targets, never callers -- so the
 * unreachable format costs nothing.
 */
const victimPhone = (slot) => `50900200${String(ACTOR_SLOTS.indexOf(slot) + 1).padStart(2, "0")}`;

async function findUserByPhone(phone) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.phone === `995${phone}`);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
}

/**
 * One completed member per actor slot, in a known-good baseline state:
 * registration_completed_at set, tier 10, a unique reference_code, a valid
 * region/city, exactly one open membership pointing at ცენტრალური მოძრაობა
 * (delegate_id null), no delegates row, no admin_roles row, no payments.
 *
 * Idempotent: a second run reuses the same twelve accounts and merely resets
 * them, so repeated audits do not accumulate identities.
 */
async function ensureVictim(slot, geo) {
  const phone = victimPhone(slot);
  let user = await findUserByPhone(phone);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      phone: `995${phone}`,
      phone_confirm: true,
      user_metadata: { audit_tag: AUDIT_TAG },
    });
    if (error) throw new Error(`victim mint failed for ${slot}: ${error.message}`);
    user = data.user;
    record("auth.user", user.id, "pool", slot, `disposable victim for ${slot}`);
  }

  const personalId = `909${phone.slice(-8)}`; // 11 digits, checked free on 2026-07-25
  // profiles_reference_code_check: ^GR-[A-HJKMNP-Z2-9]{6}$ -- gen_funnel_code's
  // alphabet, so no I/L/O/0/1. "SA<slot>UDT" keeps every character inside it.
  const referenceCode = `GR-SA${"BCDEFGHJKMNP"[ACTOR_SLOTS.indexOf(slot)]}UDT`;
  const { error } = await db.from("profiles").upsert(
    {
      id: user.id,
      first_name: "SECAUDIT",
      last_name: `Victim${ACTOR_SLOTS.indexOf(slot) + 1}`,
      phone: `+995${phone}`,
      personal_id: personalId,
      birth_date: "1990-01-01",
      region_id: geo.regionId,
      city_id: geo.cityId,
      employment: AUDIT_TAG,
      status: "profile_completed",
      membership_tier: 10,
      reference_code: referenceCode,
      registration_completed_at: new Date().toISOString(),
      pending_delegate_id: null,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`victim profile upsert failed for ${slot}: ${error.message}`);
  record("profiles", user.id, "pool", slot, "disposable victim profile");
  return { userId: user.id, personalId, referenceCode, slot };
}

let _pool = null;

/** Memoized: the twelve victims plus the shared read-only discoveries. */
export async function provisionFixturePool() {
  if (_pool) return _pool;

  const { data: city, error: cityError } = await db
    .from("cities")
    .select("id, region_id")
    .order("id")
    .limit(1)
    .single();
  if (cityError) throw new Error(`fixture discovery failed for a city: ${cityError.message}`);
  const geo = { cityId: city.id, regionId: city.region_id };

  const { data: today, error: todayError } = await db.rpc("tbilisi_today");
  if (todayError) throw new Error(`tbilisi_today() discovery failed: ${todayError.message}`);

  const { data: setting, error: settingError } = await db
    .from("app_settings")
    .select("key, value")
    .eq("key", "active_grace_days")
    .single();
  if (settingError) throw new Error(`app_settings discovery failed: ${settingError.message}`);

  const victims = {};
  for (const slot of ACTOR_SLOTS) victims[slot] = await ensureVictim(slot, geo);

  _pool = { victims, geo, today, graceDays: setting.value };
  return _pool;
}

// ---------------------------------------------------------------------------
// Minting helpers -- each returns the id(s) the argument builder needs
// ---------------------------------------------------------------------------

async function mint(table, row, surface, actor, note) {
  const { data, error } = await db.from(table).insert(row).select("id").single();
  if (error) throw new Error(`mint ${table} for ${surface}/${actor} failed: ${error.message}`);
  record(table, data.id, surface, actor, note);
  return data.id;
}

async function mintDelegateRow(victim, status, surface, actor, extra = {}) {
  await db.from("delegates").delete().eq("id", victim.userId);
  const { error } = await db.from("delegates").insert({
    id: victim.userId,
    referral_code: `SA${rand().toUpperCase()}`,
    tc_accepted_at: new Date().toISOString(),
    status,
    ...extra,
  });
  if (error) throw new Error(`mint delegates(${status}) for ${surface}/${actor}: ${error.message}`);
  record("delegates", victim.userId, surface, actor, `status=${status}`);
  return victim.userId;
}

const dropDelegateRow = (victim) => db.from("delegates").delete().eq("id", victim.userId);

async function mintNews(status, surface, actor) {
  return mint(
    "news",
    {
      title: `SECAUDIT ${surface} ${actor}`,
      body: AUDIT_TAG,
      visibility: "public",
      status,
      slug: status === "published" ? slug("secaudit-news") : null,
      published_at: status === "published" ? new Date().toISOString() : null,
    },
    surface,
    actor,
    `news status=${status}`,
  );
}

async function mintEvent(status, surface, actor) {
  const startsAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  return mint(
    "events",
    {
      title: `SECAUDIT ${surface} ${actor}`,
      description: AUDIT_TAG,
      location: AUDIT_TAG,
      starts_at: startsAt,
      status,
      slug: status === "published" ? slug("secaudit-event") : null,
      published_at: status === "published" ? new Date().toISOString() : null,
    },
    surface,
    actor,
    `event status=${status}`,
  );
}

async function mintPoll(status, surface, actor) {
  const pollId = await mint(
    "polls",
    {
      question: `SECAUDIT ${surface} ${actor}`,
      status,
      opened_at: status === "open" ? new Date().toISOString() : null,
    },
    surface,
    actor,
    `poll status=${status}`,
  );
  const { data, error } = await db
    .from("poll_options")
    .insert([
      { poll_id: pollId, position: 1, label: "SECAUDIT-A" },
      { poll_id: pollId, position: 2, label: "SECAUDIT-B" },
    ])
    .select("id");
  if (error) throw new Error(`mint poll_options for ${surface}/${actor}: ${error.message}`);
  for (const o of data) record("poll_options", o.id, surface, actor, "option");
  return { pollId, optionId: data[0].id };
}

/** Exactly one open membership, pointing where the caller asks. */
async function resetMembership(victim, delegateId, surface, actor) {
  await db.from("memberships").delete().eq("member_id", victim.userId);
  const id = await mint(
    "memberships",
    { member_id: victim.userId, delegate_id: delegateId },
    surface,
    actor,
    "open membership",
  );
  return id;
}

async function resetPayments(victim) {
  await db.from("payments").delete().eq("member_id", victim.userId);
}

// ---------------------------------------------------------------------------
// The argument table
// ---------------------------------------------------------------------------

const NEVER_EXECUTES =
  "no client role holds EXECUTE (live proacl); the arguments below are well-formed so that a " +
  "42501 can only mean the GRANT layer refused, never that the probe was malformed";

/**
 * One entry per function. `args(fx, ctx)` receives whatever `setup` returned
 * plus `{ actor, actors, pool }`. `readOnly: true` means no setup is minted.
 *
 * Two documentation flags, neither read by the runner (the runner keys purely
 * off whether `setup` exists): `readOnly: true` marks a function that writes
 * NOTHING at all, `noTarget: true` one that writes but needs no pre-minted row
 * (it either mints its own, or acts on the pool victim, or only appends to
 * audit_log). Mislabelling one as the other would misrepresent what the census
 * spent, so they are kept distinct.
 *
 * `skipFor` is the ONLY way a cell escapes real invocation, and it is used
 * exactly once (see the header).
 */
export const FUNCTION_SPECS = {
  // --- Group A: revoked from every client role (live proacl has no anon and
  // no authenticated entry). Real arguments supplied anyway, precisely so the
  // 42501 proves the grant layer and not a signature typo. -----------------
  active_coverage: {
    readOnly: true,
    note: NEVER_EXECUTES,
    args: (_f, c) => ({ p_member: c.pool.victims[c.actor].userId }),
  },
  active_grace_days: { readOnly: true, note: NEVER_EXECUTES, args: () => ({}) },
  active_sweep: { readOnly: true, note: NEVER_EXECUTES, args: () => ({}) },
  gen_funnel_code: { readOnly: true, note: NEVER_EXECUTES, args: () => ({ len: 6 }) },
  recompute_all_active: { readOnly: true, note: NEVER_EXECUTES, args: () => ({}) },
  recompute_member_active: {
    readOnly: true,
    note: NEVER_EXECUTES,
    args: (_f, c) => ({ p_member: c.pool.victims[c.actor].userId }),
  },
  send_sms_hook: {
    readOnly: true,
    note: NEVER_EXECUTES,
    args: () => ({ event: { user: { phone: "+995500000000" }, sms: { otp: "000000" } } }),
  },
  tbilisi_today: { readOnly: true, note: NEVER_EXECUTES, args: () => ({}) },

  // --- Group C: the four `returns trigger` functions. Zero-argument, so the
  // call below is provably well-formed; PGRST202 is PostgREST refusing to ROUTE
  // a trigger-returning function, and `select f()` is refused by Postgres
  // itself ("trigger functions can only be called as triggers", verified live
  // as the postgres superuser). ------------------------------------------
  audit_log_immutable: { readOnly: true, args: () => ({}) },
  enforce_delegate_completed: { readOnly: true, args: () => ({}) },
  protect_profile_columns: { readOnly: true, args: () => ({}) },
  set_updated_at: { readOnly: true, args: () => ({}) },

  // --- the six plain helpers' callable half + the read-only definers ------
  has_admin_role: { readOnly: true, args: () => ({ p_role: "super_admin" }) },
  has_any_admin_role: {
    readOnly: true,
    args: () => ({ p_roles: ["super_admin", "verifier", "finance", "editor"] }),
  },
  is_completed_member: { readOnly: true, args: () => ({}) },
  is_registered: { readOnly: true, args: () => ({}) },
  cabinet_state: { readOnly: true, args: () => ({}) },
  delegate_panel: { readOnly: true, args: () => ({}) },
  delegate_team: { readOnly: true, args: () => ({}) },
  delegate_team_rsvps: { readOnly: true, args: () => ({}) },

  // --- member / registration machinery -----------------------------------
  register: {
    // For A3-A12 this is a pure read: the body returns cabinet_state() the
    // moment it sees an existing profiles row. For A2 (no profile) it really
    // does create one -- which would silently promote A2 out of its declared
    // "signed in, no profile" standing and invalidate every other A2 cell in
    // this and every later task -- so the row is removed again immediately.
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { preExisted: true }; // A1 is anonymous: nothing to create, nothing to undo
      const { data } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
      return { preExisted: Boolean(data) };
    },
    args: (_fx, c) => ({
      p_first_name: "SECAUDIT",
      p_last_name: "Probe",
      p_personal_id: `908${victimPhone(c.actor).slice(-8)}`,
      p_ref_code: null,
    }),
    teardown: async (fx, c) => {
      if (fx.preExisted) return;
      const id = c.actors[c.actor].userId;
      if (!id) return;
      const { data } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
      if (!data) return;
      record("profiles", id, "function:register", c.actor, "created by probe, removed by teardown");
      await db.from("profiles").delete().eq("id", id);
    },
  },
  request_delegacy: {
    // A9-A12 are the canonical staging admins; see the header.
    skipFor: ["A9", "A10", "A11", "A12"],
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { preExisted: false };
      const { data } = await db.from("delegates").select("id").eq("id", id).maybeSingle();
      return { preExisted: Boolean(data) };
    },
    args: () => ({}),
    teardown: async (fx, c) => {
      if (fx.preExisted) return;
      const id = c.actors[c.actor].userId;
      if (!id) return;
      const { data } = await db.from("delegates").select("id").eq("id", id).maybeSingle();
      if (!data) return;
      record(
        "delegates",
        id,
        "function:request_delegacy",
        c.actor,
        "created by probe, removed by teardown",
      );
      await db.from("delegates").delete().eq("id", id);
    },
  },
  member_change_tier: {
    // The caller IS the target, so isolation is achieved by neutrality: the
    // tier each actor already holds is the tier the probe asks for.
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { tier: 10 };
      const { data } = await db
        .from("profiles")
        .select("membership_tier")
        .eq("id", id)
        .maybeSingle();
      return { tier: data?.membership_tier ?? 10 };
    },
    args: (fx) => ({ p_tier: fx.tier }),
  },
  member_change_delegate: {
    // Same neutrality trick, and it matters more here: passing the delegate the
    // caller ALREADY has takes the body's documented "same target: no-op, no
    // history row minted" branch, so even A9-A12 can be probed for real
    // without a single row changing.
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { delegateId: null };
      const { data } = await db
        .from("memberships")
        .select("delegate_id")
        .eq("member_id", id)
        .is("ended_at", null)
        .maybeSingle();
      return { delegateId: data?.delegate_id ?? null };
    },
    args: (fx) => ({ p_delegate_id: fx.delegateId }),
  },
  member_rsvp: {
    setup: async (c) => ({
      eventId: await mintEvent("published", "function:member_rsvp", c.actor),
    }),
    args: (fx) => ({ p_event_id: fx.eventId, p_going: true }),
  },
  member_cast_vote: {
    // A fresh poll per (function, actor) is what makes every actor's vote a
    // FIRST vote; a shared poll would hand the twelfth actor `already_voted`.
    setup: async (c) => mintPoll("open", "function:member_cast_vote", c.actor),
    args: (fx) => ({ p_poll_id: fx.pollId, p_option_id: fx.optionId }),
  },
  become_member_complete: {
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { tier: 10 };
      const { data } = await db
        .from("profiles")
        .select("membership_tier")
        .eq("id", id)
        .maybeSingle();
      return { tier: data?.membership_tier ?? 10 };
    },
    args: (fx) => ({ p_tier: fx.tier }),
  },
  become_member_save_profile: {
    // Only A3 (registered, not completed) can reach the write. Its five funnel
    // columns are read before and restored after, so A3 stays exactly the
    // "registered" actor every other cell assumes -- and, critically, so that
    // become_member_complete's A3 cell cannot depend on whether this one ran
    // first.
    setup: async (c) => {
      const id = c.actors[c.actor].userId;
      if (!id) return { before: null };
      const { data } = await db
        .from("profiles")
        .select("birth_date, region_id, city_id, employment, pending_delegate_id")
        .eq("id", id)
        .maybeSingle();
      return { before: data ?? null };
    },
    args: (_fx, c) => ({
      p_birth_date: "1990-01-01",
      p_region_id: c.pool.geo.regionId,
      p_city_id: c.pool.geo.cityId,
      p_employment: AUDIT_TAG,
      p_delegate_id: null,
    }),
    teardown: async (fx, c) => {
      if (!fx.before) return;
      const id = c.actors[c.actor].userId;
      const { data } = await db
        .from("profiles")
        .select("birth_date, region_id, city_id, employment, pending_delegate_id")
        .eq("id", id)
        .maybeSingle();
      if (!data) return;
      const changed = Object.keys(fx.before).some((k) => data[k] !== fx.before[k]);
      if (!changed) return;
      record(
        "profiles",
        id,
        "function:become_member_save_profile",
        c.actor,
        "funnel columns restored",
      );
      await db.from("profiles").update(fx.before).eq("id", id);
    },
  },

  // --- admin: verifier family --------------------------------------------
  admin_approve_delegate: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await mintDelegateRow(v, "pending", "function:admin_approve_delegate", c.actor);
      return { victim: v };
    },
    args: (fx) => ({ p_delegate_id: fx.victim.userId, p_slug: slug("secaudit-dg") }),
    teardown: (fx) => dropDelegateRow(fx.victim),
  },
  admin_reject_delegate: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await mintDelegateRow(v, "pending", "function:admin_reject_delegate", c.actor);
      return { victim: v };
    },
    args: (fx) => ({ p_delegate_id: fx.victim.userId, p_note: AUDIT_TAG }),
    teardown: (fx) => dropDelegateRow(fx.victim),
  },
  admin_update_delegate_profile: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await mintDelegateRow(v, "approved", "function:admin_update_delegate_profile", c.actor, {
        slug: slug("secaudit-dg"),
        verified_at: new Date().toISOString(),
      });
      return { victim: v };
    },
    args: (fx) => ({
      p_delegate_id: fx.victim.userId,
      p_bio: AUDIT_TAG,
      p_photo_url: "https://example.invalid/secaudit.jpg",
    }),
    teardown: (fx) => dropDelegateRow(fx.victim),
  },
  admin_reveal_applicant_personal_id: {
    // Returns a personal ID -- which is why the target is a SYNTHETIC victim
    // (personal_id 909........, minted by this file) and never a real member.
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await mintDelegateRow(v, "pending", "function:admin_reveal_applicant_personal_id", c.actor);
      return { victim: v };
    },
    args: (fx) => ({ p_delegate_id: fx.victim.userId }),
    teardown: (fx) => dropDelegateRow(fx.victim),
  },
  admin_reassign_member: {
    // Target must be a completed member holding an open membership and must
    // NOT be a delegate (ADR-013). The destination delegate is A7, the audit's
    // own approved delegate -- reading it changes nothing about A7.
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await dropDelegateRow(v);
      await resetMembership(v, null, "function:admin_reassign_member", c.actor);
      return { victim: v, to: c.actors.A7.userId };
    },
    args: (fx) => ({ p_member_id: fx.victim.userId, p_delegate_id: fx.to }),
    teardown: async (fx, c) => {
      await resetMembership(fx.victim, null, "function:admin_reassign_member", c.actor);
    },
  },

  // --- admin: super_admin-only family ------------------------------------
  admin_grant_role: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await db.from("admin_roles").delete().eq("user_id", v.userId);
      return { victim: v };
    },
    args: (fx) => ({ p_user_id: fx.victim.userId, p_role: "editor" }),
    // A granted role is a real admin account on staging. It is removed the
    // instant the probe returns, whatever the probe's verdict was.
    teardown: async (fx, c) => {
      record(
        "admin_roles",
        fx.victim.userId,
        "function:admin_grant_role",
        c.actor,
        "revoked by teardown",
      );
      await db.from("admin_roles").delete().eq("user_id", fx.victim.userId);
    },
  },
  admin_revoke_role: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await db.from("admin_roles").delete().eq("user_id", v.userId);
      const { error } = await db.from("admin_roles").insert({ user_id: v.userId, role: "editor" });
      if (error) throw new Error(`mint admin_roles for ${c.actor}: ${error.message}`);
      record(
        "admin_roles",
        v.userId,
        "function:admin_revoke_role",
        c.actor,
        "role=editor, target of revoke",
      );
      return { victim: v };
    },
    args: (fx) => ({ p_user_id: fx.victim.userId, p_role: "editor" }),
    teardown: (fx) => db.from("admin_roles").delete().eq("user_id", fx.victim.userId),
  },
  admin_reveal_personal_id: {
    // Writes audit_log (that IS the control on a PID reveal), but needs no
    // minted target beyond the victim the pool already holds.
    noTarget: true,
    args: (_fx, c) => ({ p_member_id: c.pool.victims[c.actor].userId }),
  },
  admin_update_setting: {
    // The only writable key, written back to the value it already holds --
    // otherwise a single probe would re-grade active/lapsed standing for the
    // entire roster (the body calls recompute_all_active()).
    noTarget: true,
    args: (_fx, c) => ({ p_key: "active_grace_days", p_value: c.pool.graceDays }),
  },

  // --- admin: finance family ---------------------------------------------
  admin_record_payment: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await resetPayments(v);
      return { victim: v };
    },
    args: (fx, c) => ({
      p_member_id: fx.victim.userId,
      p_amount_gel: 5,
      p_paid_at: c.pool.today,
      p_bank_reference: `SECAUDIT-${rand()}`,
    }),
    teardown: (fx) => resetPayments(fx.victim),
  },
  admin_record_payments_bulk: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await resetPayments(v);
      return { victim: v };
    },
    args: (fx, c) => ({
      p_rows: [{ referenceCode: fx.victim.referenceCode, amountGel: 7, paidAt: c.pool.today }],
    }),
    teardown: (fx) => resetPayments(fx.victim),
  },
  admin_void_payment: {
    setup: async (c) => {
      const v = c.pool.victims[c.actor];
      await resetPayments(v);
      const id = await mint(
        "payments",
        {
          member_id: v.userId,
          amount_gel: 5,
          paid_at: c.pool.today,
          bank_reference: `SECAUDIT-${rand()}`,
          source: "manual",
          tier_gel_at_payment: 10,
        },
        "function:admin_void_payment",
        c.actor,
        "unvoided payment, target of void",
      );
      return { victim: v, paymentId: id };
    },
    args: (fx) => ({ p_payment_id: fx.paymentId, p_reason: `${AUDIT_TAG} void probe` }),
    teardown: (fx) => resetPayments(fx.victim),
  },
  admin_export_members: {
    // p_include_ids FALSE here. The `true` variant is a SECOND, narrower gate
    // inside the same body (super_admin only) that raises the same
    // `missing_role` token AFTER finance has already been admitted -- so
    // probing it in this cell would make judge() assert a finding against A11
    // on correct, spec'd behaviour. It is probed for all twelve actors by name
    // instead: see exportIncludeIdsAssertions() in assertions.mjs.
    // p_search narrows the result to this task's own synthetic victims so the
    // probe exercises the real code path without pulling the live roster's PII
    // into the runner's memory.
    noTarget: true,
    args: () => ({ p_search: "SECAUDIT", p_region_id: null, p_status: null, p_include_ids: false }),
  },

  // --- admin: editor family ----------------------------------------------
  admin_save_news: {
    args: (_fx, c) => ({
      p_id: null,
      p_title: `SECAUDIT save_news ${c.actor}`,
      p_body: AUDIT_TAG,
      p_visibility: "public",
    }),
    noTarget: true, // p_id null: the call itself mints the row, nothing to pre-mint
  },
  admin_publish_news: {
    setup: async (c) => ({ id: await mintNews("draft", "function:admin_publish_news", c.actor) }),
    args: (fx) => ({ p_id: fx.id, p_slug: slug("secaudit-news") }),
  },
  admin_unpublish_news: {
    setup: async (c) => ({
      id: await mintNews("published", "function:admin_unpublish_news", c.actor),
    }),
    args: (fx) => ({ p_id: fx.id }),
  },
  admin_delete_news: {
    setup: async (c) => ({ id: await mintNews("draft", "function:admin_delete_news", c.actor) }),
    args: (fx) => ({ p_id: fx.id }),
  },
  admin_set_news_image: {
    setup: async (c) => ({ id: await mintNews("draft", "function:admin_set_news_image", c.actor) }),
    args: (fx) => ({
      p_id: fx.id,
      // pinned by regex to this platform's storage origin AND the upload
      // action's filename shape (uuid-epoch.ext)
      p_image_url:
        `https://${PROJECT_REF}.supabase.co/storage/v1/object/public/news-images/` +
        `${crypto.randomUUID()}-${Date.now()}.jpg`,
    }),
  },
  admin_save_event: {
    args: (_fx, c) => ({
      p_id: null,
      p_title: `SECAUDIT save_event ${c.actor}`,
      p_description: AUDIT_TAG,
      p_location: AUDIT_TAG,
      p_starts_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      p_ends_at: new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString(),
    }),
    noTarget: true, // p_id null: the call itself mints the row
  },
  admin_publish_event: {
    setup: async (c) => ({ id: await mintEvent("draft", "function:admin_publish_event", c.actor) }),
    args: (fx) => ({ p_id: fx.id, p_slug: slug("secaudit-event") }),
  },
  admin_cancel_event: {
    setup: async (c) => ({
      id: await mintEvent("published", "function:admin_cancel_event", c.actor),
    }),
    args: (fx) => ({ p_id: fx.id }),
  },
  admin_delete_event: {
    setup: async (c) => ({ id: await mintEvent("draft", "function:admin_delete_event", c.actor) }),
    args: (fx) => ({ p_id: fx.id }),
  },
  admin_save_poll: {
    args: (_fx, c) => ({
      p_id: null,
      p_question: `SECAUDIT save_poll ${c.actor}`,
      p_options: ["SECAUDIT-A", "SECAUDIT-B"],
      p_ends_at: null,
    }),
    noTarget: true, // p_id null: the call itself mints the row
  },
  admin_open_poll: {
    setup: async (c) => mintPoll("draft", "function:admin_open_poll", c.actor),
    args: (fx) => ({ p_id: fx.pollId }),
  },
  admin_close_poll: {
    setup: async (c) => mintPoll("open", "function:admin_close_poll", c.actor),
    args: (fx) => ({ p_id: fx.pollId }),
  },
  admin_delete_poll: {
    setup: async (c) => mintPoll("draft", "function:admin_delete_poll", c.actor),
    args: (fx) => ({ p_id: fx.pollId }),
  },
};

/**
 * Every `admin_*` action string the 26 admin functions write, keyed by
 * function. Used by the audit-log invariant check (assertions.mjs): a function
 * that mutates admin-visible state without leaving an audit_log row is a
 * finding regardless of its access control.
 *
 * Four entries are deliberately null -- read off the live bodies, not guessed:
 *   admin_grant_role / admin_revoke_role write NO audit row when the role was
 *   already held / already absent (`if v_inserted = 0 then return`), which the
 *   probe never hits because setup guarantees the opposite;
 *   admin_reassign_member writes none when the member is already on the target
 *   delegate (same-target no-op), also excluded by setup.
 */
export const AUDIT_ACTIONS = {
  admin_approve_delegate: "delegate.approve",
  admin_cancel_event: "event.cancel",
  admin_close_poll: "poll.close",
  admin_delete_event: "event.delete",
  admin_delete_news: "news.delete",
  admin_delete_poll: "poll.delete",
  admin_export_members: "member.export",
  admin_grant_role: "admin.grant_role",
  admin_open_poll: "poll.open",
  admin_publish_event: "event.publish",
  admin_publish_news: "news.publish",
  admin_reassign_member: "member.reassign",
  admin_record_payment: "payment.record",
  admin_record_payments_bulk: "payment.bulk_record",
  admin_reject_delegate: "delegate.reject",
  admin_reveal_applicant_personal_id: "delegate.reveal_personal_id",
  admin_reveal_personal_id: "member.reveal_personal_id",
  admin_revoke_role: "admin.revoke_role",
  admin_save_event: "event.save",
  admin_save_news: "news.save",
  admin_save_poll: "poll.save",
  admin_set_news_image: "news.set_image",
  admin_unpublish_news: "news.unpublish",
  admin_update_delegate_profile: "delegate.update_profile",
  admin_update_setting: "settings.update",
  admin_void_payment: "payment.void",
};
