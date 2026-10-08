import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "./account-deletion";

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

  it("names its decision record in both migrations", () => {
    expect(sql.slice(0, 300)).toContain("ADR-047");
    expect(hardening().slice(0, 300)).toContain("ADR-047");
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

  it("fails the apply when postgres may not delete sign-in accounts", () => {
    // erase_account (owned by postgres) ends in `delete from auth.users`
    expect(flat(check)).toContain(
      "if not has_table_privilege('postgres', 'auth.users', 'DELETE') then",
    );
  });
});
