import { describe, expect, it } from "vitest";
import { localEnvFile } from "../scripts/local-db-env.mjs";

// `supabase status -o env` with the same --override-name flags CI uses (.github/workflows/ci.yml).
const status = [
  'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key"',
  'SUPABASE_SERVICE_ROLE_KEY="service-key"',
  'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
  "",
].join("\n");

describe("localEnvFile", () => {
  it("keeps only the three settings the app needs, unquoted", () => {
    const file: string = localEnvFile(status);
    expect(file).toContain("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n");
    expect(file).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key\n");
    expect(file).toContain("SUPABASE_SERVICE_ROLE_KEY=service-key\n");
    expect(file).not.toContain("DB_URL");
  });

  it("sets the same test-mode flags as the CI build", () => {
    const file: string = localEnvFile(status);
    expect(file).toContain("NEXT_PUBLIC_APP_ENV=preview\n");
    expect(file).toContain("PHONE_VERIFICATION_PROVIDER=test\n");
    expect(file).toContain("NEXT_PUBLIC_AUTH_MODE=google\n");
  });

  it("refuses an address that is not the local stack", () => {
    expect(() =>
      localEnvFile(status.replace("http://127.0.0.1:54321", "https://abc.supabase.co")),
    ).toThrow(/local/);
  });

  it("refuses when a setting is missing", () => {
    expect(() => localEnvFile(status.replace(/SUPABASE_SERVICE_ROLE_KEY.*\n/, ""))).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });
});
