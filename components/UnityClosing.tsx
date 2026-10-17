import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityTextLink } from "@/components/UnityTextLink";

const TITLE = "ერთად შეგვიძლია.";
const JOIN = "შემოგვიერთდი";
const FLAG_ALT = "საქართველოს სახელმწიფო დროშა";

/**
 * The closing wine band shared by the „ერთობა“ pages: the big headline, the join button and an
 * optional second link, with the waving state flag fading in from the right. On tablets the
 * flag drops under the text; phones use a compact centered banner and the sticky join bar.
 */
export function UnityClosing({ link }: { link?: { href: string; label: string } }) {
  return (
    <section
      aria-labelledby="closing-title"
      className="relative flex flex-col overflow-hidden bg-wine text-limestone [&_:focus-visible]:outline-limestone min-[1040px]:block"
    >
      <div className="unity-container relative z-10 flex w-full flex-col justify-center pt-14 max-sm:box-border max-sm:min-h-[260px] max-sm:py-10 max-sm:text-center sm:pt-[72px] min-[1040px]:min-h-[clamp(400px,37.08vw,534px)] min-[1040px]:pt-0">
        <h2
          id="closing-title"
          className="m-0 font-display text-[clamp(48px,16vw,64px)] font-bold leading-[.9] tracking-[-.005em] sm:text-[clamp(56px,8.4vw,124px)]"
        >
          {TITLE}
        </h2>
        {/* Phones join from the sticky join bar, so only the second link shows there. */}
        <div
          className={`mt-[clamp(36px,4vw,56px)] flex-wrap items-center gap-x-9 gap-y-5 max-sm:absolute max-sm:inset-x-4 max-sm:bottom-7 max-sm:mt-0 max-sm:justify-center sm:flex ${link ? "flex" : "hidden"}`}
        >
          <span className="hidden sm:contents">
            <UnityButtonLink href="/join" variant="cream" size="lg" arrow>
              {JOIN}
            </UnityButtonLink>
          </span>
          {link ? (
            <UnityTextLink href={link.href} tone="light" className="text-[17px]">
              {link.label}
            </UnityTextLink>
          ) : null}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- art-directed decorative photo */}
      <img
        src="/unity/closing-flag.webp"
        alt={FLAG_ALT}
        width={2880}
        height={1068}
        loading="lazy"
        className="absolute right-0 top-0 hidden h-full w-auto max-w-none [mask-image:linear-gradient(90deg,transparent_0,#000_8%)] min-[1040px]:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- art-directed decorative photo */}
      <img
        src="/unity/closing-flag-mobile.webp"
        alt={FLAG_ALT}
        width={780}
        height={760}
        loading="lazy"
        className="-mt-12 block max-h-[560px] w-full object-cover object-top max-sm:absolute max-sm:inset-0 max-sm:m-0 max-sm:h-full max-sm:object-center max-sm:opacity-50 min-[1040px]:hidden"
      />
    </section>
  );
}
