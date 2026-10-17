import { Caps } from "@/components/Caps";
import Link from "next/link";
import { ABOUT_PORTAL_CARDS } from "@/lib/about-copy";

/**
 * What the portal lets people do: four ruled cards side by side (a list of rows on a phone),
 * each with a lower block naming the role and a link. A signed-in visitor gets a card's
 * `signedInHref` (e.g. straight to the membership form instead of registration).
 */
export function AboutPortalCards({ signedIn }: { signedIn: boolean }) {
  return (
    <ul className="m-0 mt-[26px] list-none border-t-2 border-ink p-0 sm:mt-[clamp(48px,5vw,72px)] sm:grid sm:grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] sm:border-l sm:border-t sm:border-rule">
      {ABOUT_PORTAL_CARDS.map(({ title, detail }, i) => (
        <li
          key={title}
          className="min-w-0 border-b border-rule py-5 sm:flex sm:flex-col sm:border-r sm:px-7 sm:pb-8 sm:pt-[30px]"
        >
          <span className="flex items-baseline gap-3 sm:flex-col sm:items-stretch sm:gap-0">
            <span
              aria-hidden="true"
              className="text-[18px] font-black leading-none text-brand [font-stretch:62.5%] sm:text-[22px]"
            >
              {`0${i + 1}`}
            </span>
            <span className="font-serif text-[21px] font-semibold leading-[1.3] sm:mt-[18px] sm:min-h-[5.2em] sm:text-[22px]">
              {title}
            </span>
          </span>
          <span className="ml-8 mt-2.5 block text-[12px] font-bold tracking-[.1em] text-secondary sm:ml-0 sm:mt-[22px] sm:border-t sm:border-rule sm:pt-[18px] sm:text-[13px]">
            <Caps>{detail.label}</Caps>
          </span>
          <span className="ml-8 mt-1 block text-[15.5px] leading-[1.55] text-prose sm:ml-0 sm:mt-2 sm:flex-1 sm:text-[16px] sm:leading-[1.6]">
            {detail.text}
          </span>
          <Link
            href={(signedIn && detail.link.signedInHref) || detail.link.href}
            className="ml-8 mt-2 inline-block text-[15px] font-semibold text-brand underline decoration-1 underline-offset-[5px] hover:text-brand-dark sm:ml-0 sm:mt-[18px] sm:self-start sm:text-[16px]"
          >
            {detail.link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
