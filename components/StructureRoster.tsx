import { useCopy } from "@/lib/i18n/copy";
import Image from "next/image";
import { SocialLinks } from "@/components/SocialLinks";
import { StructurePebble } from "@/components/StructurePebble";
import type { BoardMember } from "@/lib/board-members";
import { OriginalLanguageNote } from "@/components/OriginalLanguageNote";

/** A silhouette card held for a seat until the owner publishes the roster. */
function Placeholder() {
  return (
    <li data-placeholder="true" aria-hidden="true" className="min-w-0">
      <span className="relative block aspect-[4/5] overflow-hidden bg-limestone sm:bg-sandstone">
        <span className="absolute top-[26%] left-1/2 aspect-square w-[34%] -translate-x-1/2 rounded-full bg-rule" />
        <span className="absolute -bottom-[14%] left-1/2 h-[46%] w-[74%] -translate-x-1/2 rounded-t-[50%] bg-rule" />
      </span>
      <span className="mt-2.5 block h-[1.1em] w-[70%] bg-rule text-[16px] sm:mt-4 sm:text-[19px]" />
      <span className="mt-1.5 hidden h-[1em] w-[85%] bg-rule/70 text-[15px] sm:block" />
    </li>
  );
}

function MemberCard({ member }: { member: BoardMember }) {
  return (
    <li className="min-w-0">
      <span className="relative block aspect-[4/5] overflow-hidden bg-sandstone">
        <Image
          src={member.photo}
          alt={member.name}
          fill
          sizes="(max-width: 640px) 50vw, 240px"
          className="object-cover"
        />
      </span>
      <span
        lang="ka"
        className="mt-2.5 block font-serif text-[16px] font-semibold text-ink sm:mt-4 sm:text-[19px]"
      >
        {member.name}
      </span>
      <span
        lang="ka"
        className="mt-1 block text-[14px] leading-normal text-secondary sm:text-[15px]"
      >
        {member.bio}
      </span>
      <OriginalLanguageNote />
      <span className="mt-3 block">
        <SocialLinks person={member.name} links={member.socials} />
      </span>
    </li>
  );
}

/**
 * The board roster: the real members from lib/board-members.ts, or, while that list is empty,
 * the coming-soon notice and one silhouette per seat.
 */
export function StructureRoster({
  members,
  heading,
  notice,
  seats,
}: {
  members: readonly BoardMember[];
  heading: string;
  notice: string;
  seats: number;
}) {
  const t = useCopy();
  const empty = members.length === 0;
  return (
    <section
      id="roster"
      aria-labelledby="roster-title"
      className="scroll-mt-6 bg-sandstone pt-[52px] pb-14 sm:border-t sm:border-rule sm:bg-transparent sm:py-[clamp(72px,8vw,120px)]"
    >
      <div className="unity-container">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-[18px] sm:gap-y-5">
          <h2
            id="roster-title"
            className="m-0 font-display text-[38px] leading-[.98] font-bold sm:text-[clamp(44px,5.5vw,80px)] sm:leading-[.95]"
          >
            {t(heading)}
          </h2>
          {empty ? (
            <p className="inline-flex items-center gap-2.5 border border-rule bg-chalk px-3.5 py-2.5 text-[14px] font-semibold sm:px-4 sm:text-[15px]">
              <StructurePebble className="h-2 w-2.5 bg-teal" />
              {t(notice)}
            </p>
          ) : null}
        </div>
        <ul
          aria-label={t(heading)}
          className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-[18px] sm:mt-[clamp(40px,4.5vw,64px)] sm:grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] sm:gap-[clamp(16px,2vw,28px)]"
        >
          {empty
            ? Array.from({ length: seats }, (_, i) => <Placeholder key={i} />)
            : members.map((m) => <MemberCard key={m.name} member={m} />)}
        </ul>
      </div>
    </section>
  );
}
