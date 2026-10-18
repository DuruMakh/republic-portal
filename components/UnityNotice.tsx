import type { ReactNode } from "react";
import {
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_HOME,
  NOT_FOUND_TITLE,
} from "@/components/NotFoundNotice";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { useCopy } from "@/lib/i18n/copy";

/**
 * The „ერთობა“ system notice (not found, error, account deleted): a centred serif heading and a
 * line of explanation between two ink rules, over a faint sandstone knot, with its way out below.
 */
export function UnityNotice({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const t = useCopy();
  return (
    <main
      aria-labelledby="page-title"
      className="unity-fonts relative overflow-hidden px-5 pb-[72px] pt-16 sm:px-0 sm:pb-[140px] sm:pt-[120px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative ornament, fixed art */}
      <img
        src="/unity/knot-cream.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 w-[360px] max-w-none -translate-x-1/2 -translate-y-1/2 sm:w-[620px]"
      />
      <div className="relative mx-auto max-w-[640px] border-y-2 border-ink bg-limestone/85 py-7 text-center sm:px-6 sm:py-11">
        <h1
          id="page-title"
          className="m-0 font-serif text-[32px] font-semibold leading-[1.2] sm:text-[48px]"
        >
          {t(title)}
        </h1>
        {description ? (
          <p className="mx-auto mb-0 mt-4 max-w-[30em] text-[16px] leading-[1.65] text-secondary sm:text-[18px]">
            {t(description)}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-4 sm:mt-8">
            {actions}
          </div>
        ) : null}
      </div>
    </main>
  );
}

/** The redesigned site's "page not found" notice, with the one way home. */
export function UnityNotFoundNotice() {
  const t = useCopy();
  return (
    <UnityNotice
      title={NOT_FOUND_TITLE}
      description={NOT_FOUND_DESCRIPTION}
      actions={<UnityButtonLink href="/">{t(NOT_FOUND_HOME)}</UnityButtonLink>}
    />
  );
}
