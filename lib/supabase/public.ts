import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PublicDelegate } from "@/lib/ranking";
import type { Database } from "./types";

export interface PublicStats {
  approved_delegates: number;
  active_members: number;
}

export interface Region {
  id: number;
  name_ka: string;
}

function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function fetchPublicDelegates(): Promise<PublicDelegate[]> {
  const { data, error } = await publicClient()
    .from("public_delegates")
    .select("*")
    .returns<PublicDelegate[]>();
  if (error) throw new Error(`public_delegates: ${error.message}`);
  return data ?? [];
}

export async function fetchDelegateBySlug(slug: string): Promise<PublicDelegate | null> {
  const { data, error } = await publicClient()
    .from("public_delegates")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicDelegate>();
  if (error) throw new Error(`public_delegates by slug: ${error.message}`);
  return data;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const { data, error } = await publicClient()
    .from("public_stats")
    .select("*")
    .single<PublicStats>();
  if (error) throw new Error(`public_stats: ${error.message}`);
  if (!data) throw new Error("public_stats: empty response");
  return data;
}

export async function fetchRegions(): Promise<Region[]> {
  const { data, error } = await publicClient()
    .from("regions")
    .select("id, name_ka")
    .order("id")
    .returns<Region[]>();
  if (error) throw new Error(`regions: ${error.message}`);
  return data ?? [];
}
