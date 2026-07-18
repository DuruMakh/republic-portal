"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
        className="mt-2 flex flex-wrap items-center gap-1 border-b border-line pb-2"
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
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                active ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="ms-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-fg hover:text-brand"
        >
          გასვლა
        </button>
      </nav>
    </div>
  );
}
