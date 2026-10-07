import type { BoardMember } from "@/lib/board-members";
import { BoardMemberCard } from "./BoardMemberCard";

function Placeholder() {
  return (
    <div data-placeholder="true" aria-hidden="true" className="grid content-start gap-3">
      <div className="grid aspect-[4/5] max-w-full place-items-end justify-center overflow-hidden border border-line bg-paper-bright">
        <svg viewBox="0 0 100 100" className="block h-auto w-[78%] fill-line">
          <circle cx="50" cy="38" r="20" />
          <path d="M8 100c0-26 19-40 42-40s42 14 42 40z" />
        </svg>
      </div>
      <div className="h-[1.1em] w-[70%] bg-line opacity-55" />
      <div className="h-[3.6em] bg-line opacity-55" />
    </div>
  );
}

export function BoardRoster({
  members,
  heading,
  notice,
  placeholders,
}: {
  members: readonly BoardMember[];
  heading: string;
  notice: string;
  placeholders: number;
}) {
  const empty = members.length === 0;
  return (
    <section id="roster" className="scroll-mt-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <h2 className="display-heading text-[clamp(2rem,4vw,3.1rem)] text-ink">{heading}</h2>
        {empty ? (
          <p className="inline-flex items-center gap-2 border border-line bg-paper-bright px-3.5 py-[7px] text-[0.85rem] font-bold text-muted-fg">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse"
            />
            {notice}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-5">
        {empty
          ? Array.from({ length: placeholders }, (_, i) => <Placeholder key={i} />)
          : members.map((m) => <BoardMemberCard key={m.name} member={m} />)}
      </div>
    </section>
  );
}
