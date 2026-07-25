/**
 * Task 6, Step 2: the data that makes a probe mean something.
 *
 * Two kinds of thing live here, and they are deliberately different:
 *
 *   1. DISCOVERY (read-only, service role). Which published event, open poll,
 *      news item and audit_log row exist right now — so the depth probes can
 *      aim at a REAL row rather than a made-up uuid. A probe that filters on
 *      an id which does not exist returns zero rows for a reason that has
 *      nothing to do with the defence being tested; it would report
 *      "blocked!" while proving nothing. Every discovered row also carries
 *      its CURRENT value for the column each write probe touches, so the
 *      probe's payload can be that same value: if a write probe ever DOES get
 *      through, the row count reveals the breach while the content stays
 *      byte-identical.
 *
 *   2. CREATION (through the app's own RPCs, never a service-role insert).
 *      `event_rsvps` and `poll_votes` are guarded by "own rsvps readable" /
 *      "own votes readable", and those policies cannot be tested against
 *      actors who have never RSVP'd or voted: "A3 sees zero of A5's RSVPs" is
 *      not evidence when A5 has no RSVPs. So A5 and A7 are given one real
 *      RSVP and one real vote each, cast by themselves, through member_rsvp()
 *      and member_cast_vote() — the same doors any member uses. Both rows
 *      belong to accounts already tagged `security-audit-2026-07` in
 *      user_metadata (actors.mjs's AUDIT_TAG), so the end-of-phase reseed
 *      sweeps them with the accounts that own them.
 *
 * Idempotent throughout: member_rsvp upserts, member_cast_vote's repeat call
 * raises `already_voted` which is treated as "already satisfied".
 *
 * The service-role client is used ONLY for discovery reads here. It is never
 * handed to a probe and never writes.
 */
import { db } from "./db.mjs";
import { actorClient } from "./actors.mjs";

/** member_cast_vote's idempotent-repeat token (20260719150000_community.sql:735). */
const ALREADY_VOTED = "already_voted";

async function one(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`fixture discovery failed for ${what}: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`fixture discovery found no ${what}`);
  return data[0];
}

/**
 * Read-only reconnaissance for the depth probes. Nothing here mutates.
 */
async function discover() {
  // An event that member_rsvp() will still accept: published and not started
  // (it raises rsvp_closed on cancelled or already-started events).
  const event = await one(
    db
      .from("events")
      .select("id, title, status, starts_at")
      .eq("status", "published")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1),
    "a published, not-yet-started event",
  );

  // A poll member_cast_vote() will still accept: open, and either open-ended
  // or not past its ends_at.
  const poll = await one(
    db
      .from("polls")
      .select("id, question, status, ends_at")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(5),
    "an open poll",
  );
  const option = await one(
    db.from("poll_options").select("id, poll_id, label").eq("poll_id", poll.id).limit(1),
    `an option on poll ${poll.id}`,
  );

  const news = await one(db.from("news").select("id, title").limit(1), "a news row");
  const audit = await one(db.from("audit_log").select("id, action").limit(1), "an audit_log row");

  return {
    eventId: event.id,
    eventTitle: event.title,
    pollId: poll.id,
    pollQuestion: poll.question,
    optionId: option.id,
    newsId: news.id,
    newsTitle: news.title,
    auditId: audit.id,
    auditAction: audit.action,
  };
}

/** One RSVP + one vote, cast by the actor itself through the member RPCs. */
async function ensureParticipation(actor, label, { eventId, pollId, optionId }) {
  const client = actorClient(actor.accessToken);

  const { error: rsvpError } = await client.rpc("member_rsvp", {
    p_event_id: eventId,
    p_going: true,
  });
  if (rsvpError) throw new Error(`member_rsvp failed for ${label}: ${rsvpError.message}`);

  const { error: voteError } = await client.rpc("member_cast_vote", {
    p_poll_id: pollId,
    p_option_id: optionId,
  });
  if (voteError && voteError.message !== ALREADY_VOTED) {
    throw new Error(`member_cast_vote failed for ${label}: ${voteError.message}`);
  }
  return { rsvp: "going", vote: voteError?.message === ALREADY_VOTED ? "pre-existing" : "cast" };
}

/**
 * Returns the discovered ids/values the depth probes need, after making sure
 * A5 and A7 each own one RSVP and one vote.
 */
export async function ensureDepthFixtures(actors) {
  const found = await discover();
  const a5 = await ensureParticipation(actors.A5, "A5", found);
  const a7 = await ensureParticipation(actors.A7, "A7", found);
  return { ...found, participation: { A5: a5, A7: a7 } };
}
