import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ButtonLink";
import { DemoBanner } from "@/components/DemoBanner";
import { HeaderSessionAction } from "@/components/HeaderSessionAction";

const nav = [
  { href: "/", label: "მთავარი" },
  { href: "/delegates", label: "დელეგატები" },
  { href: "/leaderboard", label: "რეიტინგი" },
] as const;

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-lg text-white shadow-sm"
            >
              🏛
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold text-ink">ქართული რესპუბლიკა</span>
              <span className="block text-[11px] font-semibold text-muted-fg">
                სამოქალაქო პლატფორმა
              </span>
            </span>
          </Link>
          <nav
            aria-label="მთავარი ნავიგაცია"
            className="flex flex-wrap items-center gap-4 text-sm font-semibold text-ink"
          >
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-brand">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <HeaderSessionAction />
            <ButtonLink href="/join" size="sm">
              გახდი წევრი
            </ButtonLink>
          </div>
        </div>
      </header>
      <DemoBanner />
      <div className="flex-1">{children}</div>
      <footer className="mt-16 bg-navy py-10 text-sm text-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 sm:px-6">
          <div>
            <div className="font-extrabold text-white">ქართული რესპუბლიკა</div>
            <div className="mt-1">გამჭვირვალე, ანგარიშვალდებული და შენს ხელში.</div>
          </div>
          <nav aria-label="ქვედა ნავიგაცია" className="flex flex-wrap gap-5 font-semibold">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div>© 2026 ქართული რესპუბლიკა</div>
        </div>
      </footer>
    </div>
  );
}
