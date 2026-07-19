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

export interface PublicNewsItem {
  id: string;
  slug: string;
  title: string;
  body: string;
  image_url: string | null;
  published_at: string;
}

export async function fetchPublicNews(): Promise<PublicNewsItem[]> {
  const { data, error } = await publicClient()
    .from("public_news")
    .select("*")
    .order("published_at", { ascending: false })
    .returns<PublicNewsItem[]>();
  if (error) throw new Error(`public_news: ${error.message}`);
  return data ?? [];
}

export async function fetchPublicNewsBySlug(slug: string): Promise<PublicNewsItem | null> {
  const { data, error } = await publicClient()
    .from("public_news")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicNewsItem>();
  if (error) throw new Error(`public_news by slug: ${error.message}`);
  return data;
}

export interface PublicEventItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: "published" | "cancelled";
  published_at: string;
}

export async function fetchPublicEvents(): Promise<PublicEventItem[]> {
  const { data, error } = await publicClient()
    .from("public_events")
    .select("*")
    .returns<PublicEventItem[]>();
  if (error) throw new Error(`public_events: ${error.message}`);
  return data ?? [];
}

export async function fetchPublicEventBySlug(slug: string): Promise<PublicEventItem | null> {
  const { data, error } = await publicClient()
    .from("public_events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicEventItem>();
  if (error) throw new Error(`public_events by slug: ${error.message}`);
  return data;
}
