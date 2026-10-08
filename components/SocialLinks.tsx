import type { BoardMember, SocialNetwork } from "@/lib/board-members";

// Brand names stay in Latin (they are names, not prose); marks per the approved concept.
const NETWORK: Record<SocialNetwork, { name: string; mark: string }> = {
  facebook: { name: "Facebook", mark: "fb" },
  tiktok: { name: "TikTok", mark: "tt" },
  linkedin: { name: "LinkedIn", mark: "in" },
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
          className="grid h-[30px] w-[30px] place-items-center border border-line text-[0.74rem] font-extrabold text-muted-fg no-underline transition-colors hover:border-ink hover:bg-ink hover:text-paper"
        >
          {NETWORK[network].mark}
        </a>
      ))}
    </div>
  );
}
