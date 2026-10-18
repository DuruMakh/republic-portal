import { useCopy } from "@/lib/i18n/copy";

/**
 * The service worker's fallback when a page cannot load offline (app/sw.ts precaches it, with
 * the logo and the map it draws). A sandstone page, the map faint underneath, the logo above
 * the notice between two ink rules.
 */
export default function OfflinePage() {
  const t = useCopy();
  return (
    <main
      aria-labelledby="page-title"
      className="unity-fonts relative min-h-screen overflow-hidden bg-sandstone px-5 py-24 text-ink sm:px-6 sm:py-40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative map, precached art */}
      <img
        src="/public-pages/map-dots-grey.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[150px] left-1/2 w-[520px] max-w-none -translate-x-1/2 opacity-55 sm:-bottom-[330px] sm:w-[900px]"
      />
      <div className="relative mx-auto max-w-[560px] border-y-2 border-ink px-5 py-7 text-center sm:px-6 sm:py-11">
        {/* eslint-disable-next-line @next/next/no-img-element -- precached logo; next/image needs the network */}
        <img
          src="/unity/logo.png"
          alt={t("ქართული რესპუბლიკა")}
          className="mx-auto mb-6 block h-9 w-auto sm:mb-8 sm:h-11"
        />
        <h1
          id="page-title"
          className="m-0 font-serif text-[30px] font-semibold leading-[1.2] sm:text-[44px]"
        >
          {t("კავშირი გაწყვეტილია")}
        </h1>
        <p className="mx-auto mb-0 mt-4 max-w-[28em] text-[16px] leading-[1.65] text-secondary sm:text-[18px]">
          {t("ინტერნეტ კავშირი დროებით მიუწვდომელია. სცადეთ ხელახლა კავშირის აღდგენის შემდეგ.")}
        </p>
      </div>
    </main>
  );
}
