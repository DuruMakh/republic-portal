"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/Badge";
import type { CabinetNavItem } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/client";

export function CabinetNav({ items }: { items: CabinetNavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    try {
      // local scope: sign out this device only (spec §nav: "clears the session
      // client-side"). The default 'global' would revoke every device's refresh
      // token, forcing a fresh SMS-OTP login elsewhere.
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // best-effort: local session may survive a network failure — the cabinet
      // layout gates re-check the server truth on the next request anyway
    }
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      aria-label="კაბინეტის ნავიგაცია"
      className="mb-8 flex gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline text-[0.78rem] font-semibold"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 ${
              active ? "text-brand border-b-2 border-brand pb-1" : "text-ink hover:text-brand"
            }`}
          >
            {item.label}
            {item.count ? <Badge>{item.count}</Badge> : null}
          </Link>
        );
      })}
      <button type="button" onClick={signOut} className="ms-auto text-ink hover:text-brand">
        გასვლა
      </button>
    </nav>
  );
}
