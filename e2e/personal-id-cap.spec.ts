import { execFileSync, spawn } from "node:child_process";
import { expect, test } from "@playwright/test";
import { LOCAL_SUPABASE_ORIGINS } from "../lib/env";
import { cleanupUsersByPhone } from "./cleanup-helpers";
import { journeyPersonalId, journeyPhone } from "./funnel-helpers";
import { clientFor, fixtureSession, serviceClient } from "./otp-helpers";

const phones = [journeyPhone(0), journeyPhone(5), journeyPhone(6)];
const cleanup = () =>
  cleanupUsersByPhone(
    "personal-ID cap cleanup",
    phones.map((p) => `+995${p}`),
  );

test("overlapping authenticated saves share the three-conflict cap only for their account", async () => {
  // A held psql transaction is available only on the documented local Docker stack.
  expect(LOCAL_SUPABASE_ORIGINS).toContain(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const container = execFileSync(
    "docker",
    ["ps", "--filter", "publish=54322", "--format", "{{.ID}}"],
    { encoding: "utf8" },
  ).trim();
  expect(container).toMatch(/^[a-f0-9]+$/);
  const psqlArgs = [
    "exec",
    "-i",
    container,
    "psql",
    "-XqAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    "postgres",
  ];
  const sql = (query: string) =>
    execFileSync("docker", psqlArgs, { input: query, encoding: "utf8" }).trim();
  const admin = serviceClient();
  let held: ReturnType<typeof spawn> | undefined;
  let heldClosed: Promise<number | null> | undefined;
  const requests: Promise<unknown>[] = [];
  await cleanup();
  try {
    const ids: string[] = [];
    const takenId = journeyPersonalId(6);
    for (const [index, phone] of phones.entries()) {
      const { data, error } = await admin.auth.admin.createUser({
        phone: `+995${phone}`,
        phone_confirm: true,
      });
      expect(error).toBeNull();
      const id = data.user!.id;
      ids.push(id);
      const inserted = await admin.from("profiles").insert({
        id,
        phone: `+995${phone}`,
        first_name: "ვატესტ",
        last_name: "ლიმიტს",
        status: "registered",
        personal_id: index === 2 ? takenId : null,
      });
      expect(inserted.error).toBeNull();
    }
    const { data: city, error: cityError } = await admin
      .from("cities")
      .select("id, region_id")
      .order("id")
      .limit(1)
      .single();
    expect(cityError).toBeNull();
    const args = {
      p_birth_date: "1990-05-20",
      p_region_id: city!.region_id as number,
      p_city_id: city!.id as number,
      p_employment: "სტუდენტი",
      p_delegate_id: null,
      p_personal_id: takenId,
    };
    const prober = await clientFor(await fixtureSession(phones[0]!));
    const independent = await clientFor(await fixtureSession(phones[1]!));
    const conflictCount = () =>
      sql(
        `select count(*) from public.audit_log where action = 'member.personal_id_conflict' and target_id = '${ids[0]}';`,
      );
    // Both initial conflicts commit before the controlled overlap begins.
    for (let n = 0; n < 2; n++) {
      const result = await prober.rpc("become_member_save_profile", args);
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ error: "duplicate_personal_id" });
    }
    expect(conflictCount()).toBe("2");

    held = spawn("docker", psqlArgs, { stdio: "pipe" });
    heldClosed = new Promise((resolve, reject) => {
      held!.once("error", reject);
      held!.once("close", resolve);
    });
    let output = "";
    let errors = "";
    held.stdout!.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    held.stderr!.on("data", (chunk: Buffer) => {
      errors += chunk.toString();
    });
    held.stdin!.write(`begin;
      set local application_name = 'personal-id-cap-held';
      set local role authenticated;
      set local request.jwt.claim.sub = '${ids[0]}';
      select public.become_member_save_profile('1990-05-20', ${args.p_region_id}, ${args.p_city_id}, 'სტუდენტი', null, '${takenId}');
      \\echo held-ready
    `);
    await expect
      .poll(() => output, {
        timeout: 10_000,
        message: "authenticated third conflict returns while its transaction stays open",
      })
      .toContain("held-ready");
    expect(output).toContain('"duplicate_personal_id"');
    expect(errors).toBe("");
    expect(conflictCount()).toBe("2");

    let settled = 0;
    const pending = [0, 1].map(() =>
      Promise.resolve(prober.rpc("become_member_save_profile", args)).then((result) => {
        settled++;
        return result;
      }),
    );
    requests.push(...pending);
    // Old code answers both early; fixed code visibly waits on the account's row lock.
    await expect
      .poll(
        () =>
          settled === 2 ||
          Number(
            sql(
              "select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%become_member_save_profile%';",
            ),
          ) >= 2,
        { timeout: 10_000, message: "both overlap requests have reached the database" },
      )
      .toBe(true);

    // Another account can save and resume while the first account remains locked.
    const freeArgs = { ...args, p_personal_id: journeyPersonalId(5) };
    const saved = await independent.rpc("become_member_save_profile", freeArgs);
    expect(saved.error).toBeNull();
    const resumed = await independent.rpc("become_member_save_profile", {
      ...freeArgs,
      p_personal_id: takenId,
    });
    expect(resumed.error).toBeNull();
    const profile = await admin
      .from("profiles")
      .select("personal_id, birth_date")
      .eq("id", ids[1]!)
      .single();
    expect(profile.data).toEqual({ personal_id: journeyPersonalId(5), birth_date: "1990-05-20" });

    // Release before awaiting requests: fixed requests cannot finish before commit.
    held.stdin!.end("commit;\n");
    expect(await heldClosed).toBe(0);
    held = undefined;
    const results = await Promise.all(pending);
    const total = Number(conflictCount());
    console.log(`Committed personal-ID conflicts after overlap: ${total}`);
    expect(total).toBe(3);
    for (const result of results)
      expect(result.error?.message).toContain("personal_id_attempts_exceeded");
    const readOnly = await prober.rpc(
      "become_member_save_profile",
      {
        p_birth_date: args.p_birth_date,
        p_region_id: args.p_region_id,
        p_city_id: args.p_city_id,
        p_employment: args.p_employment,
        p_personal_id: takenId,
      },
      { get: true },
    );
    expect(readOnly.error?.message).toContain("read_only_transaction");
  } finally {
    if (held) {
      held.stdin!.end("rollback;\n");
      await heldClosed;
    }
    await Promise.allSettled(requests);
    await cleanup();
  }
});
