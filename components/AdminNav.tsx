"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import type { AdminTab } from "@/lib/admin";
import { createClient } from "@/lib/supabase/client";

export function AdminNav({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // best-effort — the layout gate re-checks the server truth next request
    }
    router.push("/");
    router.refresh();
  }

  return (
    // The register tag this row used to carry as its own Eyebrow (see AdminLayout's
    // ADMIN_TAG) now lives on the Masthead instead (Task 18, mirrors the Task 15/17
    // CabinetNav pattern) — rendering it here too would duplicate the masthead's copy.
    <nav
      aria-label="ადმინისტრირების ნავიგაცია"
      className="mb-8 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold"
    >
      {tabs.map((tab) => {
        // „მიმოხილვა“ (/admin) matches exactly; subpages match by prefix
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 ${
              active ? "text-brand border-b-2 border-brand pb-1" : "text-ink hover:text-brand"
            }`}
          >
            {tab.label}
            {/* D10: the verify tab's pending-count badge gets the amber "needs
                attention" tone; every other counted tab keeps the default brand chip. */}
            {tab.count ? (
              <Badge tone={tab.href === "/admin/verify" ? "warn" : "brand"}>{tab.count}</Badge>
            ) : null}
          </Link>
        );
      })}
      <button type="button" onClick={signOut} className="ms-auto text-ink hover:text-brand">
        გასვლა
      </button>
    </nav>
  );
}
