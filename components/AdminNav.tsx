"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Eyebrow } from "@/components/Eyebrow";
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
    <div className="mb-8">
      <Eyebrow>ადმინისტრირება</Eyebrow>
      <nav
        aria-label="ადმინისტრირების ნავიგაცია"
        className="mt-2 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold"
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
              {tab.count ? <Badge>{tab.count}</Badge> : null}
            </Link>
          );
        })}
        <button type="button" onClick={signOut} className="ms-auto text-ink hover:text-brand">
          გასვლა
        </button>
      </nav>
    </div>
  );
}
