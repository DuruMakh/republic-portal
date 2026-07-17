import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { hasAnyRole } from "@/lib/admin";
import { getAdminRoles } from "@/lib/supabase/server";
import { lookupMemberAction, recordPaymentAction } from "./actions";
import { RecordPayment } from "./RecordPayment";

export const metadata: Metadata = { title: "ფინანსები — ადმინისტრირება" };

export default async function AdminFinancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getAdminRoles();
  if (!hasAnyRole(roles, ["finance", "super_admin"])) redirect("/admin");
  await searchParams; // txPage arrives in Task 19

  return (
    <main>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">ფინანსები</h1>
        <p className="mt-2 text-sm text-muted-fg">
          გადახდების აღრიცხვა, ბალკ შესატყვისება და შემოსავლის სტატისტიკა.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card header={<h3 className="text-base font-bold text-ink">ერთეული აღრიცხვა</h3>}>
          <RecordPayment lookup={lookupMemberAction} record={recordPaymentAction} />
        </Card>

        {/* BULK-MATCH (Task 18) */}

        {/* FINANCE-STATS (Task 19) */}
      </div>
    </main>
  );
}
