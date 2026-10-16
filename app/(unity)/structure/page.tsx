import type { Metadata } from "next";
import { BoardRoster } from "@/components/BoardRoster";
import { ButtonLink } from "@/components/ButtonLink";
import { DecisionRuleCard } from "@/components/DecisionRuleCard";
import { MembershipPath } from "@/components/MembershipPath";
import { Pebble } from "@/components/Pebble";
import { PebbleCouncil } from "@/components/PebbleCouncil";
import { PebbleTally } from "@/components/PebbleTally";
import { BOARD_MEMBERS } from "@/lib/board-members";
import { BOARD_SIZE, votesNeeded } from "@/lib/board-rules";
import {
  BOARD_DUTIES,
  BOARD_DUTIES_LABEL,
  BOARD_HEADING,
  BOARD_LEAD,
  BOARD_RULES_LABEL,
  CLOSING_CTA,
  MEMBERS_HEADING,
  MEMBERS_LEAD,
  MEMBERS_PATH_LABEL,
  MEMBERS_PATH_STEPS,
  MEMBERS_RIGHTS,
  MEMBERS_RIGHTS_LABEL,
  ROSTER_HEADING,
  ROSTER_NOTICE,
  RULE_MAJORITY,
  RULE_TWO_THIRDS,
  SECTION_INDEX,
  STRUCTURE_INTRO,
  STRUCTURE_TITLE,
  VOTE_AGAINST,
  VOTE_FOR,
  VOTE_HEADING,
  VOTE_LEAD,
} from "@/lib/structure-copy";
import { SUPPORT_EYEBROW } from "@/lib/support-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export const metadata: Metadata = { title: `${STRUCTURE_TITLE} — ${SUPPORT_EYEBROW}` };

const WRAP = "mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10";
const LABEL = "text-[0.74rem] font-bold tracking-[.2em] text-teal";
// Board follows the index strip's own rule, so only later sections draw a top border.
// scroll-mt-24 clears the masthead, which is sticky below md (components/Masthead.tsx).
const SECTION = "scroll-mt-24 py-[clamp(36px,5vw,64px)] md:scroll-mt-6";
const RULED = `${SECTION} border-t border-line`;
const H2 = "display-heading text-[clamp(2rem,4vw,3.1rem)] text-ink";
const LEAD =
  "mt-2.5 max-w-[40em] font-serif text-[clamp(1rem,1.4vw,1.1rem)] leading-relaxed text-muted-fg";
const BIG_LETTER =
  "hidden font-serif text-[clamp(4rem,8vw,6.5rem)] leading-[.7] font-extrabold text-transparent select-none [-webkit-text-stroke:1.5px_var(--color-line)] min-[900px]:block";
const TWO_COL = "grid gap-[clamp(28px,4vw,60px)] min-[900px]:grid-cols-2";

function SectionHead({
  id,
  letter,
  title,
  lead,
}: {
  id: string;
  letter: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="mb-[clamp(20px,3vw,32px)] grid items-end gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_auto]">
      <div>
        <h2 id={`${id}-title`} className={H2}>
          {title}
        </h2>
        <p className={LEAD}>{lead}</p>
      </div>
      <div aria-hidden="true" className={BIG_LETTER}>
        {letter}
      </div>
    </div>
  );
}

function PebbleList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <ul className="mt-3.5">
        {items.map((item, i) => (
          <li
            key={item}
            className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 border-b border-line py-2.5 font-serif text-[1.02rem] leading-normal text-ink first:border-t"
          >
            <Pebble
              tone="teal"
              className={`mt-[0.5em] h-3 w-[13px] ${i % 2 ? "rotate-[40deg]" : ""}`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StructurePage() {
  const [firstWord, ...rest] = STRUCTURE_TITLE.split(" ");
  const letter = (href: string) => SECTION_INDEX.find((s) => s.href === href)?.letter ?? "";

  return (
    <main>
      <section
        className={`${WRAP} grid items-center gap-[clamp(20px,4vw,56px)] py-[clamp(28px,4vw,48px)] min-[900px]:grid-cols-[minmax(0,1fr)_auto]`}
      >
        <div>
          <h1 className="display-heading mb-4 text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.05] text-ink">
            {firstWord} <span className="text-brand">{rest.join(" ")}</span>
          </h1>
          <p className="max-w-[36em] font-serif text-[clamp(1.02rem,1.5vw,1.15rem)] leading-relaxed text-muted-fg">
            {STRUCTURE_INTRO}
          </p>
        </div>
        <PebbleCouncil
          seats={BOARD_SIZE}
          centerLabel={BOARD_HEADING}
          className="hidden w-[clamp(150px,22vw,250px)] min-[900px]:block"
        />
      </section>

      <nav aria-label={STRUCTURE_TITLE} className="border-y border-line">
        <div className={`${WRAP} grid min-[900px]:grid-cols-3`}>
          {SECTION_INDEX.map(({ href, letter: l, label }, i) => (
            <a
              key={href}
              href={href}
              className={`group flex items-center gap-3.5 py-3.5 text-ink no-underline ${i > 0 ? "border-t border-line min-[900px]:border-t-0 min-[900px]:border-l min-[900px]:pl-5" : ""}`}
            >
              <span
                aria-hidden="true"
                className="font-serif text-[2.4rem] leading-[.8] font-extrabold text-transparent transition-colors [-webkit-text-stroke:1.5px_var(--color-brand)] group-hover:text-brand"
              >
                {l}
              </span>
              <span className="display-heading text-[1.15rem]">{label}</span>
            </a>
          ))}
        </div>
      </nav>

      <section id="board" aria-labelledby="board-title" className={SECTION}>
        <div className={WRAP}>
          <SectionHead
            id="board"
            letter={letter("#board")}
            title={BOARD_HEADING}
            lead={BOARD_LEAD}
          />
          <div className={TWO_COL}>
            <PebbleList label={BOARD_DUTIES_LABEL} items={BOARD_DUTIES} />
            <div>
              <div className={LABEL}>{BOARD_RULES_LABEL}</div>
              <div className="mt-3.5 grid gap-3.5">
                <DecisionRuleCard
                  headline={RULE_TWO_THIRDS.headline}
                  body={RULE_TWO_THIRDS.body}
                  needed={votesNeeded("twoThirds", BOARD_SIZE)}
                  total={BOARD_SIZE}
                />
                <DecisionRuleCard
                  headline={RULE_MAJORITY.headline}
                  body={RULE_MAJORITY.body}
                  needed={votesNeeded("majority", BOARD_SIZE)}
                  total={BOARD_SIZE}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="members" aria-labelledby="members-title" className={RULED}>
        <div className={WRAP}>
          <SectionHead
            id="members"
            letter={letter("#members")}
            title={MEMBERS_HEADING}
            lead={MEMBERS_LEAD}
          />
          <div className={TWO_COL}>
            <MembershipPath label={MEMBERS_PATH_LABEL} steps={MEMBERS_PATH_STEPS} />
            <PebbleList label={MEMBERS_RIGHTS_LABEL} items={MEMBERS_RIGHTS} />
          </div>
        </div>
      </section>

      <section id="vote" aria-labelledby="vote-title" className={RULED}>
        <div className={WRAP}>
          <SectionHead id="vote" letter={letter("#vote")} title={VOTE_HEADING} lead={VOTE_LEAD} />
          <PebbleTally forLabel={VOTE_FOR} againstLabel={VOTE_AGAINST} />
        </div>
      </section>

      <div className={RULED}>
        <div className={WRAP}>
          <BoardRoster
            members={BOARD_MEMBERS}
            heading={ROSTER_HEADING}
            notice={ROSTER_NOTICE}
            placeholders={BOARD_SIZE}
          />
        </div>
      </div>

      <div className="flex justify-center border-t border-line py-[clamp(28px,4vw,44px)]">
        <ButtonLink href="/join" size="lg">
          {CLOSING_CTA}
        </ButtonLink>
      </div>
    </main>
  );
}
