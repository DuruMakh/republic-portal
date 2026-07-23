import Link from "next/link";

/**
 * Cream (paper-toned) site footer (spec §3.2): copyright left, link row right,
 * over a 2px ink rule matching the masthead's own rule weight. `copyright` is
 * accepted as a plain string — the caller (Task 10) splices the actual text.
 */
export function SiteFooter({
  copyright,
  links,
}: {
  copyright: string;
  links: { href: string; label: string }[];
}) {
  return (
    <footer className="border-t-2 border-ink bg-paper px-5 py-6 text-[0.8rem] text-muted-fg sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>{copyright}</div>
        <nav className="flex flex-wrap gap-5 font-semibold">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-ink hover:text-brand">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
