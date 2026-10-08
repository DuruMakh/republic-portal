/**
 * Every Georgian string on /structure, in one module, spliced byte-for-byte from
 * docs/superpowers/specs/2026-10-07-organization-structure-page-design.md §2 (owner-approved
 * text, 2026-10-07). structure-copy.test.ts fails if any value drifts from the spec. The
 * page deliberately carries no quotation marks (U+201C/U+201D transcription hazard).
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
export const CLOSING_CTA = "შემოგვიერთდი →";

export const SECTION_INDEX = [
  { href: "#board", letter: "ბ", label: BOARD_HEADING },
  { href: "#members", letter: "წ", label: MEMBERS_HEADING },
  { href: "#vote", letter: "კ", label: VOTE_HEADING },
] as const;

/** Accessible name of a rule card's pebble row, e.g. 5-დან 4 ხმა (spec §3). */
export function votesLabel(needed: number, total: number): string {
  return `${total}-დან ${needed} ხმა`;
}
