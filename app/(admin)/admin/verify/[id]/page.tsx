import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { hasAnyRole } from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { updateDelegateProfileAction } from "./actions";
import { DelegateProfileForm } from "./DelegateProfileForm";

export const metadata: Metadata = { title: "დელეგატის პროფილი — ადმინისტრირება" };

export default async function DelegateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: delegate, error } = await supabase
    .from("admin_delegate_queue")
    .select("id, first_name, last_name, region_name_ka, status, slug, bio, photo_url")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`admin_delegate_queue failed: ${error.message}`);
  if (!delegate || delegate.status !== "approved") redirect("/admin/verify");

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">
          {delegate.first_name} {delegate.last_name}
        </h1>
        <p className="mt-1 text-sm text-muted-fg">
          {delegate.region_name_ka ?? "—"} ·{" "}
          {delegate.slug ? (
            <a
              href={`/delegates/${delegate.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand hover:underline"
            >
              საჯარო გვერდი →
            </a>
          ) : null}
        </p>
      </div>
      <Card header={<h3 className="text-base font-bold text-ink">ბიო და ფოტო</h3>}>
        <DelegateProfileForm
          delegateId={delegate.id}
          initialBio={delegate.bio ?? ""}
          photoUrl={delegate.photo_url}
          save={updateDelegateProfileAction}
        />
      </Card>
    </main>
  );
}
