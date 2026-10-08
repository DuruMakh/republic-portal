import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_CONFIRM_WORD } from "./account-deletion";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261009140000_account_deletion.sql"),
  "utf8",
);
const fn = (name: string): string => {
  const start = sql.indexOf(`create function public.${name}(`);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("end $$;", start));
};

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

  it("opens the audit log only for the erasure scrub, never for a client", () => {
    const trigger = sql.slice(
      sql.indexOf("create or replace function public.audit_log_immutable()"),
    );
    expect(trigger).toContain("current_setting('app.erasing', true) = 'on'");
    for (const col of ["actor_id", "target_id"]) {
      expect(trigger).toContain(`new.${col} is not distinct from old.${col}`);
    }
    expect(trigger).toContain("raise exception 'audit_log is append-only';");
    expect(fn("erase_account")).toContain("perform set_config('app.erasing', 'on', true);");
    expect(fn("erase_account")).toContain("perform set_config('app.erasing', 'off', true);");
  });
});
