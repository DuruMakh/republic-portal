/**
 * Shared fixtures for the cleanup helpers' vitest suites (e2e/*.test.ts).
 *
 * Not a test file and not a journey: the name matches neither vitest's
 * `e2e/**\/*.test.ts` include nor Playwright's `**\/*.spec.ts` testMatch, so
 * neither runner collects it.
 *
 * The fakes RECORD their arguments. An earlier version ignored them, which meant
 * the phone derivation — the only logic the per-suite wrappers still own — was
 * asserted nowhere, and a fake could not tell `profiles` from `memberships`.
 */

export type PostgrestFailure = { message: string };

export interface UserCleanupScript {
  profileIds?: string[];
  lookupError?: PostgrestFailure;
  detachError?: PostgrestFailure;
  deleteUserErrors?: Record<string, PostgrestFailure>;
}

interface TableQuery {
  table: string;
  column: string;
  values: readonly string[];
}

/** Scripted stand-in for the service client used by cleanupUsersByPhone. */
export function fakeUserClient(script: UserCleanupScript = {}) {
  const selected: TableQuery[] = [];
  const deleted: TableQuery[] = [];
  const attempted: string[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({
        in: (column: string, values: string[]) => {
          selected.push({ table, column, values });
          return Promise.resolve(
            script.lookupError
              ? { data: null, error: script.lookupError }
              : { data: (script.profileIds ?? []).map((id) => ({ id })), error: null },
          );
        },
      }),
      delete: () => ({
        in: (column: string, values: string[]) => {
          deleted.push({ table, column, values });
          return Promise.resolve({ data: null, error: script.detachError ?? null });
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: (id: string) => {
          attempted.push(id);
          return Promise.resolve({ data: null, error: script.deleteUserErrors?.[id] ?? null });
        },
      },
    },
  };
  return {
    client,
    /** ids passed to auth.admin.deleteUser, in call order */
    attempted,
    /** every .select().in(...) — table, column and the values actually queried */
    selected,
    /** every .delete().in(...) — guards against detaching the wrong table/column */
    deleted,
    /** the phone list cleanupUsersByPhone resolved, i.e. what the wrapper derived */
    phonesQueried: () => selected.flatMap((q) => [...q.values]),
  };
}

/** Scripted content client: per-table delete outcomes plus the LIKE patterns used. */
export function fakeContentClient(errors: Record<string, PostgrestFailure> = {}) {
  const likes: { table: string; column: string; pattern: string }[] = [];
  const client = {
    from: (table: string) => ({
      delete: () => ({
        like: (column: string, pattern: string) => {
          likes.push({ table, column, pattern });
          return Promise.resolve({ data: null, error: errors[table] ?? null });
        },
      }),
    }),
  };
  return { client, likes };
}
