import { languageAlternates } from "@/lib/i18n/metadata";
import { getCopy, getLocale } from "@/lib/i18n/server";
import { useCopy } from "@/lib/i18n/copy";
import type { Metadata } from "next";
import { StructureFlow } from "@/components/StructureFlow";
import { StructureHero } from "@/components/StructureHero";
import { StructureRoster } from "@/components/StructureRoster";
import { StructureRuleCard } from "@/components/StructureRuleCard";
import {
  StructureBulletList,
  StructureColumns,
  StructureLabel,
  StructureSection,
  StructureSteps,
} from "@/components/StructureSection";
import { StructureVote } from "@/components/StructureVote";
import { UnityClosing } from "@/components/UnityClosing";
import { BOARD_MEMBERS } from "@/lib/board-members";
import { BOARD_SIZE, votesNeeded } from "@/lib/board-rules";
import {
  BOARD_DUTIES,
  BOARD_DUTIES_LABEL,
  BOARD_HEADING,
  BOARD_LEAD,
  BOARD_RULES_LABEL,
  DESIGN_ONLY_COPY,
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
  STRUCTURE_NAV_LABEL,
  STRUCTURE_TITLE,
  VOTE_AGAINST,
  VOTE_FOR,
  VOTE_HEADING,
  VOTE_LEAD,
  boardSizeLabel,
} from "@/lib/structure-copy";

// app/layout.tsx sets a plain string title, so each public page carries the site-name suffix.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return {
    title: t(STRUCTURE_TITLE) + " — " + t("ქართული რესპუბლიკა"),
    ...languageAlternates("/structure", await getLocale()),
  };
}

const letter = (href: string) => SECTION_INDEX.find((s) => s.href === href)?.letter ?? "";

/**
 * /structure in the „ერთობა“ design (ADR-053): hero with the council ring, the members → board →
 * general vote strip, one section each, the board roster and the closing band. The page has no
 * ranking link, so the ratings switch (ADR-052) has nothing to hide here.
 */
export default function StructurePage() {
  const t = useCopy();
  return (
    <main>
      <StructureHero
        kicker={STRUCTURE_NAV_LABEL}
        title={STRUCTURE_TITLE}
        lede={STRUCTURE_INTRO}
        ringTitle={BOARD_HEADING}
        ringCaption={boardSizeLabel(BOARD_SIZE)}
      />

      <StructureFlow label={STRUCTURE_TITLE} items={SECTION_INDEX} />

      <StructureSection
        id="board"
        title={BOARD_HEADING}
        lede={BOARD_LEAD}
        letter={letter("#board")}
        ruled={false}
      >
        <StructureColumns>
          <StructureBulletList label={BOARD_DUTIES_LABEL} items={BOARD_DUTIES} />
          <div className="min-w-0">
            <StructureLabel>{BOARD_RULES_LABEL}</StructureLabel>
            <div className="mt-3 flex flex-col gap-3 sm:mt-4 sm:gap-3.5">
              {[
                { rule: RULE_TWO_THIRDS, needed: votesNeeded("twoThirds", BOARD_SIZE) },
                { rule: RULE_MAJORITY, needed: votesNeeded("majority", BOARD_SIZE) },
              ].map(({ rule, needed }) => (
                <StructureRuleCard
                  key={rule.headline}
                  headline={rule.headline}
                  body={rule.body}
                  needed={needed}
                  total={BOARD_SIZE}
                  passes={DESIGN_ONLY_COPY.decisionPasses}
                  fails={DESIGN_ONLY_COPY.decisionFails}
                />
              ))}
              <p className="mt-0 text-[14px] text-secondary sm:mt-0.5">
                {t(DESIGN_ONLY_COPY.rulesHint)}
              </p>
            </div>
          </div>
        </StructureColumns>
      </StructureSection>

      <StructureSection
        id="members"
        title={MEMBERS_HEADING}
        lede={MEMBERS_LEAD}
        letter={letter("#members")}
      >
        <StructureColumns>
          <StructureSteps label={MEMBERS_PATH_LABEL} steps={MEMBERS_PATH_STEPS} />
          <StructureBulletList label={MEMBERS_RIGHTS_LABEL} items={MEMBERS_RIGHTS} />
        </StructureColumns>
      </StructureSection>

      <StructureSection
        id="vote"
        title={VOTE_HEADING}
        lede={VOTE_LEAD}
        letter={letter("#vote")}
        wideLede
      >
        <StructureVote
          forLabel={VOTE_FOR}
          againstLabel={VOTE_AGAINST}
          historyLabel={DESIGN_ONLY_COPY.historyLabel}
          historyText={DESIGN_ONLY_COPY.historyText}
          historyImageAlt={DESIGN_ONLY_COPY.historyImageAlt}
        />
      </StructureSection>

      <StructureRoster
        members={BOARD_MEMBERS}
        heading={ROSTER_HEADING}
        notice={ROSTER_NOTICE}
        seats={BOARD_SIZE}
      />

      <UnityClosing />
    </main>
  );
}
