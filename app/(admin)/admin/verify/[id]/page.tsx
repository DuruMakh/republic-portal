import type { Metadata } from "next";
import { AdminPageHeader, AdminSectionTitle } from "@/components/AdminUi";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { hasAnyRole } from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { updateDelegateNameAction, updateDelegateProfileAction } from "./actions";
import { DelegateNameForm } from "./DelegateNameForm";
import { DelegateProfileForm } from "./DelegateProfileForm";

export const metadata: Metadata = { title: "დელეგატის პროფილი — ადმინისტრირება" };

export default async function DelegateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["verifier", "super_admin"])) redirect("/admin");
  const { id } = await params;
  // uuid-shape guard: a mistyped /admin/verify/abc would otherwise reach
  // PostgREST as a 22P02 cast error and land on the error boundary instead
  // of the same not-found redirect a well-formed unknown id gets
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/verify");
  }
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
      <AdminPageHeader
        title={`${delegate.first_name} ${delegate.last_name}`}
        person
        sub={
          <>
            {delegate.region_name_ka ?? "—"} ·{" "}
            {delegate.slug ? (
              <a
                href={`/delegates/${delegate.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-brand no-underline hover:underline"
              >
                საჯარო გვერდი →
              </a>
            ) : null}
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <AdminSectionTitle className="mb-5">სახელი და გვარი</AdminSectionTitle>
          <DelegateNameForm
            delegateId={delegate.id}
            initialFirstName={delegate.first_name}
            initialLastName={delegate.last_name}
            save={updateDelegateNameAction}
          />
        </Card>
        <Card>
          <AdminSectionTitle className="mb-5">ბიო და ფოტო</AdminSectionTitle>
          <DelegateProfileForm
            delegateId={delegate.id}
            initialBio={delegate.bio ?? ""}
            photoUrl={delegate.photo_url}
            save={updateDelegateProfileAction}
          />
        </Card>
      </div>
    </main>
  );
}
