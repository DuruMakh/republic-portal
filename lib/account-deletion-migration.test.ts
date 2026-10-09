import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "./account-deletion";
import { latestDefinition } from "./security/migration-model";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261009140000_account_deletion.sql"),
  "utf8",
);
const HARDENING = "supabase/migrations/20261009150000_account_deletion_hardening.sql";
/** The second migration, read when a test needs it so a missing file fails by name. */
const hardening = (): string => {
  expect(existsSync(resolve(process.cwd(), HARDENING)), `${HARDENING} exists`).toBe(true);
  return readFileSync(resolve(process.cwd(), HARDENING), "utf8");
};
const FOLLOWUPS_FILE = "20261009160000_account_deletion_followups.sql";
const FOLLOWUPS = `supabase/migrations/${FOLLOWUPS_FILE}`;
/** The third migration (the re-review's follow-ups), read the same way. */
const followups = (): string => {
  expect(existsSync(resolve(process.cwd(), FOLLOWUPS)), `${FOLLOWUPS} exists`).toBe(true);
  return readFileSync(resolve(process.cwd(), FOLLOWUPS), "utf8");
};
const RACES_FILE = "20261009170000_account_deletion_races.sql";
const RACES = `supabase/migrations/${RACES_FILE}`;
/** The fourth migration (fix round 1: the rest of the race class, hourly purge). */
const races = (): string => {
  expect(existsSync(resolve(process.cwd(), RACES)), `${RACES} exists`).toBe(true);
  return readFileSync(resolve(process.cwd(), RACES), "utf8");
};
const fn = (name: string): string => {
  const start = sql.indexOf(`create function public.${name}(`);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("end $$;", start));
};

/** SQL on one line, so a statement can be pinned whatever its line breaks. */
const flat = (text: string): string => text.replace(/\s+/g, " ");

describe("account deletion migration", () => {
  it("checks the same confirmation word as the app", () => {
    expect(fn("delete_my_account")).toContain(
      `if p_confirm is distinct from '${ACCOUNT_DELETION_CONFIRM_WORD}' then`,
    );
  });

  it("keeps erase_account away from every client role", () => {
    expect(sql).toContain(
      "revoke execute on function public.erase_account(uuid) from public, anon, authenticated;",
    );
    expect(sql).not.toMatch(/grant execute on function public\.erase_account/);
  });

  it("grants the two wrappers to signed-in users only", () => {
    for (const sig of ["delete_my_account(text)", "admin_delete_member(uuid, text)"]) {
      expect(sql).toContain(`grant execute on function public.${sig} to authenticated;`);
      expect(sql).toContain(`revoke execute on function public.${sig} from public, anon;`);
    }
  });

  it("refuses staff before touching anything", () => {
    const body = fn("erase_account");
    const staff = body.indexOf("raise exception 'staff_account'");
    const firstWrite = body.search(/\b(update|insert into|delete from)\s/);
    expect(staff).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(staff);
    expect(body).toContain("when foreign_key_violation then");
    expect(body).toContain("raise exception 'staff_history'");
  });

  it("keeps votes anonymously and one vote per member", () => {
    expect(sql).toContain("alter table public.poll_votes alter column member_id drop not null;");
    expect(sql).toMatch(/references public\.profiles\(id\) on delete set null;/);
    expect(sql).toContain("add constraint poll_votes_one_per_member unique (poll_id, member_id);");
  });

  it("keeps counting anonymous votes in the results members see", () => {
    // poll_option_counts used count(v.member_id), which skips a vote whose member is gone
    const start = sql.indexOf("create or replace view public.poll_option_counts as");
    expect(start, "poll_option_counts is redefined").toBeGreaterThan(-1);
    const view = sql.slice(start, sql.indexOf(";", start));
    expect(view).toContain("count(v.option_id)::int as votes");
    expect(view).not.toContain("count(v.member_id)");
  });

  it("scrubs the personal names the audit inserts store under other targets", () => {
    const body = fn("erase_account");
    // payment rows target the payment id and carry the member under details.memberId
    expect(body).toContain("details ->> 'memberId' = p_user_id::text");
    // member.reassign rows of other members name a delegate under fromName / toName
    for (const [id, name] of [
      ["fromDelegateId", "fromName"],
      ["toDelegateId", "toName"],
    ]) {
      expect(body).toContain(`details ->> '${id}' = p_user_id::text`);
      expect(body).toContain(`(details - '${name}')`);
    }
  });

  it("strips every key that holds a person's name, including the slug made from it", () => {
    const decl = /v_personal_keys constant text\[\]\s*:=\s*array\[([^\]]*)\]/.exec(
      fn("erase_account"),
    );
    expect(decl, "v_personal_keys is declared").not.toBeNull();
    const keys = [...decl![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    // delegate.approve stores slug = the delegate's name transliterated (lib/slug.ts)
    for (const key of ["name", "memberName", "slug"]) expect(keys).toContain(key);
    // 'note' is free text in other actions; it is removed only from delegate.reject rows
    expect(keys).not.toContain("note");
  });

  it("removes the admin's free-text note from a rejected applicant's row", () => {
    expect(flat(fn("erase_account"))).toContain(
      "update public.audit_log set details = (details - 'note') || jsonb_build_object('erased', true) " +
        "where target_id = p_user_id::text and action = 'delegate.reject';",
    );
  });

  it("marks every audit row about the person erased, even one with no personal key", () => {
    // no `?|` filter on the target_id case: member.personal_id_conflict has null details
    expect(flat(fn("erase_account"))).toContain(
      "update public.audit_log set details = (coalesce(details, '{}'::jsonb) - v_personal_keys) " +
        "|| jsonb_build_object('erased', true) where target_id = p_user_id::text;",
    );
  });

  it("opens the audit log only for the erasure scrub, never for a client", () => {
    // the trigger function's own body, not everything after it in the file
    const start = sql.indexOf("create or replace function public.audit_log_immutable()");
    expect(start, "audit_log_immutable is redefined").toBeGreaterThan(-1);
    const trigger = sql.slice(start, sql.indexOf("end $$;", start));
    expect(trigger).toContain("current_setting('app.erasing', true) = 'on'");
    // the setting alone is not enough: only the owner of erase_account (looked up in the
    // catalog when the trigger runs) may use it, so service_role setting it gets nowhere
    expect(flat(trigger)).toContain(
      "and current_user = (select r.rolname from pg_catalog.pg_proc p " +
        "join pg_catalog.pg_roles r on r.oid = p.proowner " +
        "where p.oid = 'public.erase_account(uuid)'::pg_catalog.regprocedure)",
    );
    // only details may change: every other column must come out exactly as it went in
    for (const col of ["actor_id", "target_id"]) {
      expect(trigger).toContain(`new.${col} is not distinct from old.${col}`);
    }
    for (const col of ["id", "action", "target_type", "created_at"]) {
      expect(trigger).toContain(`new.${col} = old.${col}`);
    }
    expect(trigger).toContain("raise exception 'audit_log is append-only';");
    expect(fn("erase_account")).toContain("perform set_config('app.erasing', 'on', true);");
    expect(fn("erase_account")).toContain("perform set_config('app.erasing', 'off', true);");
  });
});

/** The erase_account body the hardening migration restates (it supersedes the first one). */
const hardenedErase = (): string => {
  const text = hardening();
  const start = text.indexOf(
    "create or replace function public.erase_account(p_user_id uuid) returns jsonb",
  );
  expect(start, "erase_account is restated").toBeGreaterThan(-1);
  return text.slice(start, text.indexOf("end $$;", start));
};

/** Code only: `--` comments removed, then on one line. */
const code = (text: string): string => flat(text.replace(/--[^\n]*/g, " "));

describe("account deletion migration comments", () => {
  it("says what really keeps clients out of the audit log", () => {
    // staging shows the client roles hold the default table grants on audit_log; row level
    // security with no policy and the trigger's owner lock are what stop them
    expect(sql).not.toContain("Clients hold");
    expect(flat(sql)).toContain("row level security with no policy");
  });

  it("names its decision record in every account deletion migration", () => {
    expect(sql.slice(0, 300)).toContain("ADR-049");
    expect(hardening().slice(0, 300)).toContain("ADR-049");
    expect(followups().slice(0, 300)).toContain("ADR-049");
    expect(races().slice(0, 300)).toContain("ADR-049");
  });
});

describe("account deletion hardening migration (20261009150000)", () => {
  it("restates erase_account with the same signature, result and definer settings", () => {
    const body = code(hardenedErase());
    expect(body).toContain(
      "create or replace function public.erase_account(p_user_id uuid) returns jsonb " +
        "language plpgsql volatile security definer set search_path = '' as $$",
    );
    expect(body).toContain("return jsonb_build_object('photoUrl', v_photo_url);");
  });

  it("keeps every step of the first version, from the photo to the sign-in account", () => {
    const first = code(fn("erase_account"));
    const from = first.indexOf("select photo_url into v_photo_url");
    const to = first.indexOf("delete from auth.users where id = p_user_id;");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const steps = first
      .slice(from, to)
      .split(";")
      .map((step) => step.trim())
      .filter(Boolean);
    expect(steps.length).toBeGreaterThan(10);
    const hardened = code(hardenedErase());
    for (const step of steps) expect(hardened).toContain(`${step};`);
    expect(hardened).toContain("delete from auth.users where id = p_user_id;");
  });

  it("locks the person's profile and delegate rows before the staff check", () => {
    // a concurrent reassignment, delegate change or approval either finishes first or waits
    const body = code(hardenedErase());
    const target = body.indexOf("raise exception 'invalid_target'");
    const profile = body.indexOf("perform 1 from public.profiles where id = p_user_id for update;");
    const delegate = body.indexOf(
      "perform 1 from public.delegates where id = p_user_id for update;",
    );
    const staff = body.indexOf("raise exception 'staff_account'");
    expect(target).toBeGreaterThan(-1);
    expect(profile).toBeGreaterThan(target);
    expect(delegate).toBeGreaterThan(profile);
    expect(staff).toBeGreaterThan(delegate);
    const firstWrite = body.search(/\b(update public\.|insert into |delete from )/);
    expect(firstWrite).toBeGreaterThan(staff);
  });

  it("deletes the person's votes in polls still running, after locking those polls", () => {
    // erasure frees the phone and personal ID: a re-registered person must not vote twice
    const body = code(hardenedErase());
    const lock = body.indexOf(
      "perform 1 from public.polls p where p.id in (select v.poll_id from public.poll_votes v " +
        "where v.member_id = p_user_id) order by p.id for share;",
    );
    // the exact complement of member_cast_vote's poll_closed test
    const del = body.indexOf(
      "delete from public.poll_votes v using public.polls p where p.id = v.poll_id " +
        "and v.member_id = p_user_id and p.status = 'open' " +
        "and (p.ends_at is null or now() <= p.ends_at);",
    );
    expect(lock).toBeGreaterThan(body.indexOf("raise exception 'staff_account'"));
    expect(del).toBeGreaterThan(lock);
    expect(del).toBeLessThan(body.indexOf("delete from auth.users where id = p_user_id;"));
  });

  it("scrubs Supabase auth's own log best-effort, never blocking the erasure", () => {
    const body = code(hardenedErase());
    const block =
      /begin delete from auth\.audit_log_entries where payload ->> 'actor_id' = p_user_id::text; exception when insufficient_privilege or undefined_table then raise notice [^;]*; end;/.exec(
        body,
      );
    expect(block, "the auth log delete sits in its own exception block").not.toBeNull();
    expect(block!.index).toBeLessThan(body.indexOf("delete from auth.users where id = p_user_id;"));
  });

  it("names the blocking constraint when staff history refuses the erasure", () => {
    expect(code(hardenedErase())).toMatch(
      /when foreign_key_violation then get stacked diagnostics v_constraint = constraint_name[^;]*; raise exception 'staff_history' using detail = [^;]*v_constraint[^;]*;/,
    );
  });

  it("closes erase_account to service_role as well as the client roles", () => {
    expect(hardening()).toContain(
      "revoke execute on function public.erase_account(uuid) from public, anon, authenticated, service_role;",
    );
    for (const file of [sql, hardening()]) {
      expect(file).not.toMatch(/grant execute on function public\.erase_account/);
    }
  });

  it("closes the new vote id sequence to the client roles", () => {
    expect(hardening()).toContain(
      "revoke all on sequence public.poll_votes_id_seq from anon, authenticated;",
    );
  });

  it("keeps SMS send reservations after an erasure, without the account link", () => {
    // per-number and site-wide send limits keep counting across delete + re-register
    const text = code(hardening());
    const table = "alter table public.phone_verification_send_reservations";
    expect(text).toContain(`${table} alter column user_id drop not null;`);
    expect(text).toContain(
      `${table} drop constraint phone_verification_send_reservations_user_id_fkey;`,
    );
    expect(text).toContain(
      `${table} add constraint phone_verification_send_reservations_user_id_fkey ` +
        "foreign key (user_id) references auth.users(id) on delete set null;",
    );
  });
});

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");
const migrationFiles = (): string[] =>
  readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

/** The last definition of `name` in one migration's text, up to its `end $$;`, or null. */
const definitionIn = (text: string, name: string): string | null => {
  let start = -1;
  for (const m of text.matchAll(
    new RegExp(`create (?:or replace )?function (?:public\\.)?${name}\\(`, "g"),
  )) {
    start = m.index;
  }
  return start < 0 ? null : text.slice(start, text.indexOf("end $$;", start));
};

/**
 * The newest definition of `name` across the migrations (files apply in name order and the last
 * create-or-replace wins), optionally ignoring some files. The older pins above keep reading
 * their own files (`fn`, `hardenedErase`); the follow-up pins read what the database runs.
 */
const newestDefinition = (
  name: string,
  { except = [] as string[] } = {},
): { file: string; body: string } => {
  let newest: { file: string; body: string } | undefined;
  for (const file of migrationFiles()) {
    if (except.includes(file)) continue;
    const body = definitionIn(readFileSync(resolve(MIGRATIONS_DIR, file), "utf8"), name);
    if (body !== null) newest = { file, body };
  }
  expect(newest, `${name} is defined by some migration`).toBeDefined();
  return newest!;
};

/** The erase_account the database runs. */
const latestErase = (): string => newestDefinition("erase_account").body;

/** A definition from `returns` on: the header's name spelling (with or without `public.`) aside. */
const fromSignature = (definition: string, name: string): string =>
  definition.slice(definition.indexOf(`${name}(`));

const ERASE_HEADER =
  "create or replace function public.erase_account(p_user_id uuid) returns jsonb " +
  "language plpgsql volatile security definer set search_path = '' as $$";
const INVALID_TARGET =
  "if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) " +
  "then raise exception 'invalid_target'; end if;";
const STAFF =
  "if exists (select 1 from public.admin_roles where user_id = p_user_id) " +
  "then raise exception 'staff_account'; end if;";
const FOUND_CHECK = "if not found then raise exception 'invalid_target'; end if;";

describe("account deletion follow-ups migration (20261009160000)", () => {
  it("holds the erase_account the database runs, with the same signature and result", () => {
    expect(newestDefinition("erase_account").file).toBe(FOLLOWUPS_FILE);
    const body = code(latestErase());
    expect(body).toContain(ERASE_HEADER);
    expect(body).toContain("return jsonb_build_object('photoUrl', v_photo_url);");
  });

  it("keeps every statement of the hardened version except the team capture it replaces", () => {
    const replaced = [
      "select coalesce(array_agg(member_id), '{}') into v_team from public.memberships " +
        "where delegate_id = p_user_id and ended_at is null",
      "update public.memberships set ended_at = now() where delegate_id = p_user_id and ended_at is null",
    ];
    const hardenedSteps = code(hardenedErase())
      .split(";")
      .map((step) => step.trim())
      .filter(Boolean);
    // the two replaced statements really are in 20261009150000, so this list cannot go stale
    for (const step of replaced) expect(hardenedSteps).toContain(step);
    expect(hardenedSteps.length).toBeGreaterThan(30);
    const latest = code(latestErase());
    for (const step of hardenedSteps.filter((s) => !replaced.includes(s))) {
      expect(latest).toContain(`${step};`);
    }
    expect(latest).not.toContain(`${replaced[0]};`);
    expect(latest).not.toContain(`${replaced[1]};`);
  });

  it("pins the refusal conditions in full and the hardened key list, in both restatements", () => {
    for (const restated of [hardenedErase(), latestErase()]) {
      const body = code(restated);
      const target = body.indexOf(INVALID_TARGET);
      const staff = body.indexOf(STAFF);
      expect(target, "the invalid_target condition, whole").toBeGreaterThan(-1);
      expect(staff, "the staff_account condition, whole").toBeGreaterThan(target);
      expect(target).toBeLessThan(body.indexOf("for update;"));
      const firstWrite = body.search(/\b(update public\.|insert into |delete from )/);
      expect(firstWrite).toBeGreaterThan(staff);
      const decl = /v_personal_keys constant text\[\]\s*:=\s*array\[([^\]]*)\]/.exec(body);
      expect(decl, "v_personal_keys is declared").not.toBeNull();
      expect([...decl![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([
        "name",
        "memberName",
        "slug",
        "firstName",
        "lastName",
        "personalId",
        "phone",
        "email",
      ]);
    }
  });

  it("locks the person's own open membership row right after the profile lock", () => {
    // a concurrent delegate change or reassignment of the person finishes first or waits
    expect(code(latestErase())).toContain(
      "perform 1 from public.profiles where id = p_user_id for update; " +
        `${FOUND_CHECK} ` +
        "perform 1 from public.memberships where member_id = p_user_id and ended_at is null for update; " +
        "perform 1 from public.delegates where id = p_user_id for update; " +
        STAFF,
    );
  });

  it("builds the departing delegate's team from the rows it ends, so a move cannot collide", () => {
    // reading the team first and ending it second let a member who moved in between get a
    // second open membership (23505 on one_active_membership)
    const body = code(latestErase());
    const capture = body.indexOf(
      "with ended as ( update public.memberships set ended_at = now() " +
        "where delegate_id = p_user_id and ended_at is null returning member_id ) " +
        "select coalesce(array_agg(member_id), '{}') into v_team from ended; " +
        "insert into public.memberships (member_id, delegate_id, note) " +
        "select unnest(v_team), null::uuid, 'delegate_left';",
    );
    expect(capture).toBeGreaterThan(body.indexOf(STAFF));
    expect(capture).toBeLessThan(
      body.indexOf(
        "update public.memberships set delegate_id = null where delegate_id = p_user_id;",
      ),
    );
  });

  it("deletes the person's SMS reservations older than 24 hours before the sign-in account", () => {
    const body = code(latestErase());
    const del = body.indexOf(
      "delete from public.phone_verification_send_reservations " +
        "where user_id = p_user_id and created_at < now() - interval '24 hours';",
    );
    expect(del).toBeGreaterThan(body.indexOf(STAFF));
    expect(del).toBeLessThan(body.indexOf("delete from auth.users where id = p_user_id;"));
  });

  it("cuts at 24 hours because no send limit looks further back", () => {
    // if reserve_phone_verification_send ever counts a longer window, the erasure's 24-hour
    // delete and the daily purge would let deleting and re-registering reset that limit
    const reserve = latestDefinition("reserve_phone_verification_send");
    const SECONDS: Record<string, number> = { second: 1, minute: 60, hour: 3600, day: 86400 };
    const windows = [...reserve.matchAll(/interval '(\d+) (second|minute|hour|day)s?'/g)].map(
      (m) => Number(m[1]) * SECONDS[m[2]!]!,
    );
    expect(windows.length).toBe([...reserve.matchAll(/interval '/g)].length);
    expect(windows.length).toBeGreaterThan(0);
    expect(Math.max(...windows)).toBeLessThanOrEqual(24 * 3600);
  });

  it("purges anonymized reservations older than 24 hours daily, safe to run again", () => {
    // this file's own text; 20261009170000 reschedules the same job hourly (pinned below)
    const text = code(followups());
    const unschedule = text.indexOf(
      "select cron.unschedule(jobid) from cron.job where jobname = 'purge-anonymous-sms-reservations';",
    );
    const schedule = text.indexOf(
      "select cron.schedule( 'purge-anonymous-sms-reservations', '30 1 * * *', " +
        "$purge$delete from public.phone_verification_send_reservations " +
        "where user_id is null and created_at < now() - interval '24 hours'$purge$ );",
    );
    expect(unschedule, "an existing job of that name is removed first").toBeGreaterThan(-1);
    expect(schedule).toBeGreaterThan(unschedule);
    // the security session's send functions are theirs: this file leaves them alone
    expect(text).not.toMatch(/function (?:public\.)?(?:reserve|complete)_phone_verification/);
  });

  it.each([
    [
      "admin_approve_delegate",
      "(uuid, text)",
      "update public.delegates set status = 'approved', slug = v_slug, verified_at = now(), " +
        "verified_by = v_uid where id = p_delegate_id;",
    ],
    [
      "admin_reject_delegate",
      "(uuid, text)",
      "update public.delegates set status = 'rejected', review_note = v_note, " +
        "verified_at = now(), verified_by = v_uid where id = p_delegate_id;",
    ],
    [
      "admin_update_delegate_name",
      "(uuid, text, text)",
      "update public.profiles set first_name = v_first, last_name = v_last where id = p_delegate_id;",
    ],
  ])(
    "%s refuses a person erased meanwhile before it writes a named audit row",
    (name, signature, update) => {
      const restated = definitionIn(followups(), name);
      expect(restated, `${name} is restated in ${FOLLOWUPS_FILE}`).not.toBeNull();
      const body = code(restated!);
      const check = body.indexOf(`${update} ${FOUND_CHECK}`);
      expect(check, "the FOUND check follows the UPDATE directly").toBeGreaterThan(-1);
      expect(check).toBeLessThan(body.indexOf("insert into public.audit_log"));
      // ...and it is the definition the database runs
      expect(code(latestDefinition(name))).toContain(`${update} ${FOUND_CHECK}`);
      // otherwise the previous live definition, copied exactly
      const previous = newestDefinition(name, { except: [FOLLOWUPS_FILE] }).body;
      expect(fromSignature(body, name).replace(` ${FOUND_CHECK}`, "")).toBe(
        fromSignature(code(previous), name),
      );
      // the same grants as before: signed-in callers only
      const text = code(followups());
      expect(text).toContain(
        `grant execute on function public.${name}${signature} to authenticated;`,
      );
      expect(text).toContain(
        `revoke execute on function public.${name}${signature} from public, anon;`,
      );
      expect(text).not.toMatch(
        new RegExp(`grant execute on function public\\.${name}[^;]*\\b(?:anon|public)\\b`),
      );
    },
  );

  it("re-asserts every revoke on erase_account after restating it", () => {
    const text = code(followups());
    const revoke = text.indexOf(
      "revoke execute on function public.erase_account(uuid) from public, anon, authenticated, service_role;",
    );
    expect(revoke).toBeGreaterThan(text.indexOf(ERASE_HEADER));
    expect(text).not.toMatch(/grant execute on function public\.erase_account/);
  });
});

const PURGE_SCHEDULE =
  /select cron\.schedule\( 'purge-anonymous-sms-reservations', '([^']+)', \$purge\$([\s\S]*?)\$purge\$ \);/g;
const PURGE_UNSCHEDULE =
  "select cron.unschedule(jobid) from cron.job where jobname = 'purge-anonymous-sms-reservations';";

describe("account deletion races migration (20261009170000)", () => {
  it.each([
    [
      "admin_update_delegate_profile",
      "(uuid, text, text)",
      // the UPDATE, then the added FOUND check
      "update public.delegates set bio = v_bio, photo_url = v_photo where id = p_delegate_id; " +
        FOUND_CHECK,
      [` ${FOUND_CHECK}`],
    ],
    [
      "admin_reveal_personal_id",
      "(uuid)",
      // the read now waits for an in-flight erasure (its FOUND check was already there)
      "select * into v_profile from public.profiles where id = p_member_id for share; " +
        FOUND_CHECK,
      [" for share"],
    ],
    [
      "admin_reveal_applicant_personal_id",
      "(uuid)",
      "select * into v_profile from public.profiles where id = p_delegate_id for share; " +
        FOUND_CHECK,
      [" for share", ` ${FOUND_CHECK}`],
    ],
    [
      // its payment UPDATE could wait on the erasure's cascade, change nothing and still log
      "admin_void_payment",
      "(bigint, text)",
      "select * into v_profile from public.profiles where id = v_payment.member_id for share; " +
        FOUND_CHECK,
      [" for share", ` ${FOUND_CHECK}`],
    ],
  ])(
    "%s cannot write a named audit row for a person erased meanwhile",
    (name, signature, guard, added) => {
      const restated = definitionIn(races(), name);
      expect(restated, `${name} is restated in ${RACES_FILE}`).not.toBeNull();
      const body = code(restated!);
      const at = body.indexOf(guard);
      expect(at, "the guard, whole").toBeGreaterThan(-1);
      expect(at).toBeLessThan(body.indexOf("insert into public.audit_log"));
      // ...and it is the definition the database runs
      expect(newestDefinition(name).file).toBe(RACES_FILE);
      expect(code(latestDefinition(name))).toContain(guard);
      // otherwise the previous live definition, copied exactly: only `added`, at the guard, is new
      const previous = newestDefinition(name, { except: [RACES_FILE] }).body;
      let before = guard;
      for (const piece of added) {
        expect(before).toContain(piece);
        before = before.replace(piece, "");
      }
      expect(fromSignature(body, name).replace(guard, before)).toBe(
        fromSignature(code(previous), name),
      );
      // the same grants as before: signed-in callers only
      const text = code(races());
      expect(text).toContain(
        `grant execute on function public.${name}${signature} to authenticated;`,
      );
      expect(text).toContain(
        `revoke execute on function public.${name}${signature} from public, anon;`,
      );
      expect(text).not.toMatch(
        new RegExp(`grant execute on function public\\.${name}[^;]*\\b(?:anon|public)\\b`),
      );
    },
  );

  it("leaves no function that names a person in an audit row open to a concurrent erasure", () => {
    // Every function whose latest definition writes an audit row with a name read from a
    // profile, and why it cannot commit that row for a person erased meanwhile.
    const GUARDED = {
      // FOUND check right after the UPDATE of the person's row, which the erasure locks first
      found: [
        "admin_approve_delegate",
        "admin_reject_delegate",
        "admin_update_delegate_name",
        "admin_update_delegate_profile",
      ],
      // the profile read waits FOR SHARE behind the erasure's FOR UPDATE, then finds nothing
      share: [
        "admin_reveal_applicant_personal_id",
        "admin_reveal_personal_id",
        "admin_void_payment",
      ],
      // inserting a row that references the person takes a key-share lock on their profile,
      // which conflicts with the erasure's FOR UPDATE: it waits and fails on the foreign key,
      // or finishes first and the scrub sees its audit row
      foreignKey: {
        admin_grant_role: "insert into public.admin_roles",
        admin_reassign_member: "insert into public.memberships",
        admin_record_payment: "insert into public.payments",
        admin_record_payments_bulk: "insert into public.payments",
      },
      // the target holds a role, so the erasure refuses them (staff_account) while it exists
      staffOnly: ["admin_revoke_role"],
    };
    const named = migrationFiles()
      .flatMap((file) =>
        [
          ...readFileSync(resolve(MIGRATIONS_DIR, file), "utf8").matchAll(
            /create (?:or replace )?function (?:public\.)?([a-z_]+)\(/g,
          ),
        ].map((m) => m[1]!),
      )
      .filter((name, i, all) => all.indexOf(name) === i)
      // the audit INSERT statement itself carries a name (admin_export_members uses first_name
      // only in the rows it returns, so it is not one of these)
      .filter((name) =>
        /insert into public\.audit_log[^;]*first_name/.test(code(latestDefinition(name))),
      );
    expect(named.sort()).toEqual(
      [
        ...GUARDED.found,
        ...GUARDED.share,
        ...Object.keys(GUARDED.foreignKey),
        ...GUARDED.staffOnly,
      ].sort(),
    );
    const beforeAudit = (name: string, piece: string | RegExp) => {
      const body = code(latestDefinition(name));
      const at = typeof piece === "string" ? body.indexOf(piece) : body.search(piece);
      expect(at, `${name}: ${String(piece)}`).toBeGreaterThan(-1);
      expect(at, `${name}: before its audit insert`).toBeLessThan(
        body.indexOf("insert into public.audit_log"),
      );
    };
    // FOUND_CHECK holds no regular-expression metacharacter, so it is used as is
    for (const name of GUARDED.found) {
      beforeAudit(name, new RegExp(`update public\\.[a-z_]+ set [^;]*; ${FOUND_CHECK}`));
    }
    for (const name of GUARDED.share) {
      beforeAudit(
        name,
        new RegExp(`from public\\.profiles where id = [a-z_.]+ for share; ${FOUND_CHECK}`),
      );
    }
    for (const [name, insert] of Object.entries(GUARDED.foreignKey)) beforeAudit(name, insert);
    for (const name of GUARDED.staffOnly) {
      beforeAudit(
        name,
        "delete from public.admin_roles where user_id = p_user_id and role = p_role;",
      );
      beforeAudit(name, "if v_deleted = 0 then return; end if;");
    }
  });

  it("reschedules the purge hourly under the same name, with the same command", () => {
    const schedules = migrationFiles().flatMap((file) =>
      [...code(readFileSync(resolve(MIGRATIONS_DIR, file), "utf8")).matchAll(PURGE_SCHEDULE)].map(
        (m) => ({ file, schedule: m[1], command: m[2], at: m.index }),
      ),
    );
    expect(schedules.map((s) => s.file)).toEqual([FOLLOWUPS_FILE, RACES_FILE]);
    const [daily, hourly] = schedules;
    expect(daily!.schedule).toBe("30 1 * * *");
    // the job the database runs: an anonymized row is gone within about 25 hours
    expect(hourly!.schedule).toBe("17 * * * *");
    expect(hourly!.command).toBe(daily!.command);
    const text = code(races());
    const unschedule = text.indexOf(PURGE_UNSCHEDULE);
    expect(unschedule, "the daily job is removed first").toBeGreaterThan(-1);
    expect(unschedule).toBeLessThan(hourly!.at);
    // the security session's send functions are theirs: this file leaves them alone too
    expect(text).not.toMatch(/function (?:public\.)?(?:reserve|complete)_phone_verification/);
  });
});

describe("post-apply production schema check covers account deletion", () => {
  const check = readFileSync(
    resolve(process.cwd(), "scripts/production-db-schema-check.sql"),
    "utf8",
  );
  const FUNCTIONS = [
    "erase_account(uuid)",
    "delete_my_account(text)",
    "admin_delete_member(uuid,text)",
  ];

  it("fails the apply when a deletion function is missing", () => {
    for (const sig of FUNCTIONS) {
      expect(check).toContain(`to_regprocedure('public.${sig}') is null`);
    }
    expect(check).toContain("required account deletion function is missing");
  });

  it("fails the apply when a deletion function's EXECUTE grant drifts", () => {
    // anon: none of the three; authenticated: the two wrappers only; service_role: not erase_account
    expect(flat(check)).toContain(
      "if has_function_privilege('anon', 'public.erase_account(uuid)', 'EXECUTE') " +
        "or has_function_privilege('anon', 'public.delete_my_account(text)', 'EXECUTE') " +
        "or has_function_privilege('anon', 'public.admin_delete_member(uuid,text)', 'EXECUTE') " +
        "or has_function_privilege('authenticated', 'public.erase_account(uuid)', 'EXECUTE') " +
        "or not has_function_privilege('authenticated', 'public.delete_my_account(text)', 'EXECUTE') " +
        "or not has_function_privilege('authenticated', 'public.admin_delete_member(uuid,text)', 'EXECUTE') " +
        "or has_function_privilege('service_role', 'public.erase_account(uuid)', 'EXECUTE') then " +
        "raise exception 'account deletion function privileges drifted';",
    );
  });

  it("fails the apply when the hourly purge of anonymized SMS reservations is missing", () => {
    expect(flat(check)).toContain(
      "if not exists ( select 1 from cron.job where jobname = 'purge-anonymous-sms-reservations' " +
        "and active and schedule = '17 * * * *' " +
        "and command = 'delete from public.phone_verification_send_reservations " +
        "where user_id is null and created_at < now() - interval ''24 hours''' ) then " +
        "raise exception 'anonymized SMS reservation purge job is missing or changed';",
    );
  });

  it("fails the apply when postgres may not delete sign-in accounts", () => {
    // erase_account (owned by postgres) ends in `delete from auth.users`
    expect(flat(check)).toContain(
      "if not has_table_privilege('postgres', 'auth.users', 'DELETE') then",
    );
  });
});
