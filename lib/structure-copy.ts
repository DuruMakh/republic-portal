/**
 * Every Georgian string on /structure, in one module. The original strings are spliced
 * byte-for-byte from docs/superpowers/specs/2026-10-07-organization-structure-page-design.md §2
 * (owner-approved text, 2026-10-07); the „ერთობა“ redesign (owner, 2026-10-16, ADR-053, design
 * file Structure-4bnt) kept that text and added the strings listed in DESIGN_ONLY_COPY below.
 * structure-copy.test.ts fails if a spec string drifts. The page deliberately carries no
 * quotation marks (U+201C/U+201D transcription hazard).
 */
export const STRUCTURE_HREF = "/structure";
export const STRUCTURE_NAV_LABEL = "სტრუქტურა";
export const STRUCTURE_TITLE = "ორგანიზაციული სტრუქტურა";
export const STRUCTURE_INTRO =
  "მოძრაობას მართავს ბორდი, მის გადაწყვეტილებებში კი ყველა წევრი მონაწილეობს.";

export const BOARD_HEADING = "ბორდი";
export const BOARD_LEAD = "ბორდი მოძრაობის მთავარი მმართველი ორგანოა და 5 წევრისგან შედგება.";
export const BOARD_DUTIES_LABEL = "ბორდი";
export const BOARD_DUTIES = [
  "ამტკიცებს მოძრაობის სტრატეგიასა და სამოქმედო გეგმას",
  "ამტკიცებს კვარტალურ ანგარიშს",
  "იღებს ახალ წევრებს",
  "ირჩევს ადმინისტრაციულ ხელმძღვანელს",
] as const;
export const BOARD_RULES_LABEL = "როგორ იღებს ბორდი გადაწყვეტილებას";
export const RULE_TWO_THIRDS = {
  headline: "არანაკლებ 2/3",
  body: "ბორდის ახალი წევრის დამატება და მოძრაობის წესდების დამტკიცება",
} as const;
export const RULE_MAJORITY = {
  headline: "უბრალო უმრავლესობა",
  body: "ყველა სხვა გადაწყვეტილება",
} as const;

export const MEMBERS_HEADING = "წევრები";
export const MEMBERS_LEAD =
  "წევრად მიღება ხდება ბორდის გადაწყვეტილებით, გასაუბრების ან მოქმედი წევრის რეკომენდაციის საფუძველზე.";
export const MEMBERS_PATH_LABEL = "როგორ ხდები წევრი";
export const MEMBERS_PATH_STEPS = [
  "გასაუბრება ან მოქმედი წევრის რეკომენდაცია",
  "ბორდის გადაწყვეტილება",
  "მოძრაობის წევრი",
] as const;
export const MEMBERS_RIGHTS_LABEL = "წევრს შეუძლია";
export const MEMBERS_RIGHTS = [
  "ბორდს წარუდგინოს ინიციატივა",
  "დაასახელოს კანდიდატი ბორდის წევრობისთვის",
  "რეკომენდაცია გაუწიოს ახალ წევრს",
  "მიიღოს მონაწილეობა საერთო კენჭისყრაში",
] as const;

export const VOTE_HEADING = "საერთო კენჭისყრა";
export const VOTE_LEAD =
  "ბორდს შეუძლია მნიშვნელოვანი საკითხი გადასაწყვეტად ყველა წევრს გადასცეს. გადაწყვეტილებას იღებს კენჭისყრის მონაწილეთა უმრავლესობა.";
export const VOTE_FOR = "მომხრე";
export const VOTE_AGAINST = "წინააღმდეგი";

export const ROSTER_HEADING = "ბორდის შემადგენლობა";
export const ROSTER_NOTICE = "ბორდის შემადგენლობა მალე გამოქვეყნდება";

/** The hero's council ring caption under the board's name, e.g. 5 წევრი. */
export function boardSizeLabel(size: number): string {
  return `${size} წევრი`;
}

/** Accessible name of a rule card's pebble row and its live count, e.g. 5-დან 4 ხმა (spec §3). */
export function votesLabel(needed: number, total: number): string {
  return `${total}-დან ${needed} ხმა`;
}

/** Accessible name of one pebble button on a rule card, e.g. ბორდის წევრი 1. */
export function boardMemberLabel(seat: number): string {
  return `ბორდის წევრი ${seat}`;
}

/** Strings the „ერთობა“ design added (Structure-4bnt, 2026-10-16); not in the 2026-10-07 spec. */
export const DESIGN_ONLY_COPY = {
  /** The flow strip's one-line notes under each card title. */
  flowMembersNote: "ინიციატივა · კანდიდატი · რეკომენდაცია",
  flowBoardNote: "იღებს ახალ წევრებს",
  flowVoteNote: "მნიშვნელოვანი საკითხი · უმრავლესობა",
  /** The rule cards' live verdict and the hint under them. */
  decisionPasses: "გადაწყვეტილება მიიღება",
  decisionFails: "გადაწყვეტილება არ მიიღება",
  rulesHint: "სცადე: დააჭირე კენჭებს.",
  /** The 1921 constitution aside under the general-vote illustration. */
  historyLabel: "ისტორიული ფესვი",
  historyText:
    "1921 წლის კონსტიტუციით კანონის ინიციატივის უფლება 5 000 ამომრჩეველს ჰქონდა (მუხლი 63), 30 000 ამომრჩეველს კი შეეძლო წერილობით მოეთხოვა ახალი კანონის რეფერენდუმზე გატანა (მუხლი 64).",
  historyImageAlt: "1921 წლის კონსტიტუციის გარეკანი",
} as const;

/**
 * The flow strip under the hero, in the design's order: members propose, the board decides,
 * and the board can hand an important question to everyone. Each card links to its section.
 */
export const SECTION_INDEX = [
  {
    href: "#members",
    letter: "წ",
    label: MEMBERS_HEADING,
    note: DESIGN_ONLY_COPY.flowMembersNote,
  },
  { href: "#board", letter: "ბ", label: BOARD_HEADING, note: DESIGN_ONLY_COPY.flowBoardNote },
  { href: "#vote", letter: "კ", label: VOTE_HEADING, note: DESIGN_ONLY_COPY.flowVoteNote },
] as const;
