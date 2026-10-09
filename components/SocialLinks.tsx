import type { BoardMember, SocialNetwork } from "@/lib/board-members";

// Brand names stay in Latin (they are names, not prose). The owner chose logos over the
// fb / tt / in letters, in the page's grey (2026-10-08, ADR-047). Logo shapes: Font Awesome
// Free 6.5.2 by @fontawesome (facebook-f, tiktok, linkedin-in), https://fontawesome.com,
// licence CC BY 4.0, https://fontawesome.com/license/free. Copyright 2024 Fonticons, Inc.
const NETWORK: Record<SocialNetwork, { name: string; viewBox: string; path: string }> = {
  facebook: {
    name: "Facebook",
    viewBox: "0 0 320 512",
    path: "M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z",
  },
  tiktok: {
    name: "TikTok",
    viewBox: "0 0 448 512",
    path: "M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z",
  },
  linkedin: {
    name: "LinkedIn",
    viewBox: "0 0 448 512",
    path: "M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z",
  },
};

export function SocialLinks({ person, links }: { person: string; links: BoardMember["socials"] }) {
  if (links.length === 0) return null;
  return (
    <div className="flex gap-2">
      {links.map(({ network, url }) => (
        <a
          key={network}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${NETWORK[network].name}: ${person}`}
          className="grid h-[30px] w-[30px] place-items-center border border-line text-muted-fg no-underline transition-colors hover:border-ink hover:bg-ink hover:text-paper"
        >
          <svg
            viewBox={NETWORK[network].viewBox}
            aria-hidden="true"
            focusable="false"
            data-network={network}
            className="h-3.5 w-3.5 fill-current"
          >
            <path d={NETWORK[network].path} />
          </svg>
        </a>
      ))}
    </div>
  );
}
