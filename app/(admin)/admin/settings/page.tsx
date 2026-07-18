import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { formatDateTimeKa, hasAnyRole } from "@/lib/admin";
import { createServerSupabase, getAdminRoles } from "@/lib/supabase/server";
import { updateGraceDaysAction } from "./actions";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "პარამეტრები — ადმინისტრირება" };

export default async function AdminSettingsPage() {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["super_admin"])) redirect("/admin");
  const supabase = await createServerSupabase();
  const { data: setting, error } = await supabase
    .from("admin_settings")
    .select("*")
    .eq("key", "active_grace_days")
    .single();
  if (error) throw new Error(`admin_settings failed: ${error.message}`);
  const graceDays = Number(setting.value);

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">პარამეტრები</h1>
        <p className="mt-2 text-sm text-muted-fg">აქტიური წევრის წესის მართვა.</p>
      </div>
      <Card header={<h3 className="text-base font-bold text-ink">აქტიური წევრის წესი</h3>}>
        <SettingsForm initialGraceDays={graceDays} save={updateGraceDaysAction} />
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted-fg">
          ბოლო ცვლილება: {formatDateTimeKa(setting.updated_at)}
          {setting.updated_by_first_name
            ? ` · ${setting.updated_by_first_name} ${setting.updated_by_last_name}`
            : ""}
        </p>
      </Card>
    </main>
  );
}
