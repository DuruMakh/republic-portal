"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CabinetNavItem } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/client";

export function CabinetNav({ items }: { items: CabinetNavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      aria-label="კაბინეტის ნავიგაცია"
      className="mb-8 flex flex-wrap items-center gap-1 border-b border-line pb-2"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              active ? "bg-brand/10 text-brand" : "text-muted-fg hover:text-ink"
            }`}
          >
            {item.label}
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
  );
}
