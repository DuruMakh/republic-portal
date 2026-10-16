"use client";

import { usePathname } from "next/navigation";
import { AdminSubNav } from "@/components/AdminUi";
import { filterEventLinks } from "@/lib/events-switch";

const SECTIONS = [
  { href: "/admin/content/news", label: "სიახლეები" },
  { href: "/admin/content/events", label: "ღონისძიებები" },
  { href: "/admin/content/polls", label: "გამოკითხვები" },
] as const;

/** `eventsShown` is showEvents(), read by the server layout: the switch is server-only (ADR-042). */
export function ContentNav({ eventsShown }: { eventsShown: boolean }) {
  const pathname = usePathname();
  return (
    <AdminSubNav
      label="შიგთავსის ნავიგაცია"
      items={filterEventLinks(SECTIONS, eventsShown).map((s) => ({
        ...s,
        active: pathname === s.href || pathname.startsWith(`${s.href}/`),
      }))}
    />
  );
}
