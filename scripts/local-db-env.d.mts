/** Builds `.env.development.local` from `supabase status -o env` output (see local-db-env.mjs). */
export function localEnvFile(statusOutput: string): string;
