import Link from "next/link";

type FooterLink = { href: string; label: string };

const BRAND = "ქართული რესპუბლიკა";

/**
 * The „ერთობა“ footer: the one solid teal area, with the coat of arms watermarked behind the
 * links. `navLinks` fill the two-column list; `legalLinks` sit beside the copyright line.
 */
export function UnityFooter({
  navLinks,
  legalLinks,
  copyright,
}: {
  navLinks: FooterLink[];
  legalLinks: FooterLink[];
  copyright: string;
}) {
  return (
    <footer className="bg-teal text-sand [&_:focus-visible]:outline-limestone">
      <div className="unity-container relative isolate pb-7 pt-11 sm:pb-9 sm:pt-[clamp(56px,6vw,80px)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative watermark */}
        <img
          src="/unity/arms-cream.svg"
          alt=""
          width={556}
          height={485}
          loading="lazy"
          className="pointer-events-none absolute right-0 top-1/2 -z-10 h-[210px] w-auto max-w-none -translate-y-1/2 opacity-[.22] sm:left-1/2 sm:right-auto sm:top-2 sm:h-[240px] sm:-translate-x-1/2 sm:translate-y-0 sm:opacity-20 xl:top-1/2 xl:h-[300px] xl:-translate-y-1/2 xl:opacity-[.24]"
        />
        <div className="flex flex-col gap-[30px] sm:flex-row sm:flex-wrap sm:justify-between sm:gap-x-16 sm:gap-y-10">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size brand mark */}
          <img
            src="/unity/logo-light.png"
            alt={BRAND}
            width={955}
            height={321}
            className="block h-11 w-auto self-start sm:h-[52px]"
          />
          <nav
            aria-label="ქვედა ნავიგაცია"
            className="grid grid-flow-col grid-cols-2 grid-rows-4 gap-x-5 gap-y-1 text-[16px] sm:grid-cols-[repeat(2,minmax(0,max-content))] sm:gap-x-16 sm:gap-y-3.5"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-2 text-limestone no-underline hover:text-white sm:py-0"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-[26px] flex flex-col gap-2.5 border-t border-limestone/14 pt-[18px] text-[13px] leading-[1.6] sm:mt-14 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-8 sm:gap-y-4 sm:pt-6 sm:text-[14px]">
          <span>{copyright}</span>
          <span className="flex flex-wrap gap-[18px] sm:gap-6">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sand hover:text-white">
                {link.label}
              </Link>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
