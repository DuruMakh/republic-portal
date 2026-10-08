import Link from "next/link";

/**
 * Teal site footer (spec §3.2, ADR-046): copyright left, link row right, on the
 * one solid teal band. Links take a paper focus outline because red on teal is
 * invisible (1.00:1), and thicken their underline on hover. `copyright` is
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
    <footer className="bg-teal px-5 py-6 text-[0.8rem] text-paper sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>{copyright}</div>
        <nav aria-label="ქვედა ნავიგაცია" className="flex flex-wrap gap-5 font-semibold">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-paper hover:decoration-2 focus-visible:outline-paper"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
