import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, key);

const { count: regionCount, error: e1 } = await db
  .from("regions")
  .select("*", { count: "exact", head: true });
if (e1) throw e1;
if (regionCount !== 11) throw new Error(`expected 11 regions, got ${regionCount}`);

const { count: cityCount, error: e2 } = await db
  .from("cities")
  .select("*", { count: "exact", head: true });
if (e2) throw e2;
if (cityCount < 30) throw new Error(`expected ≥30 cities, got ${cityCount}`);

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: leak, error: e3 } = await anon.from("dev_otp_inbox").select("*").limit(1);
if (e3 && e3.code !== "42501") {
  throw new Error(`anon query errored — check Data API exposure/grants: ${e3.message}`);
}
if (!e3 && leak && leak.length > 0) throw new Error("RLS FAILURE: anon can read dev_otp_inbox");
if (e3) console.log("OK: anon dev_otp_inbox query permission-denied (42501) — grants/RLS holding");

console.log(`OK: ${regionCount} regions, ${cityCount} cities, RLS holding`);
