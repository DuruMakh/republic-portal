import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <div className="mx-auto max-w-4xl px-6 py-10">{children}</div>;
}
