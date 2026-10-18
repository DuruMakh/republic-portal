/**
 * Every Georgian string on the homepage („ერთობა“ redesign, Page 2 of the owner's design canvas,
 * design files Main-cc44 and Home-Mobile-sstd). The copy is the design's, kept verbatim; the
 * steps of „როგორ შემოგვიერთდები“ are the owner's 2026-10-07 ladder (ADR-035). Strings the
 * design writes in capitals are kept in normal Georgian here and passed through mtavruli().
 */
import {
  CONSTITUTION_COVER,
  CONSTITUTION_SIGNATURES,
  INDEPENDENCE_ACT,
  type DocumentFan,
} from "@/lib/archive-documents";
import { PRINCIPLES_TITLE } from "@/lib/principles-copy";

export const HOME_HERO_KICKER = "სამოქალაქო პორტალი";
/** The headline in its two lines: the second is set in sand. */
export const HOME_HEADLINE = ["ერთად შევქმნათ", "ქართული რესპუბლიკა"] as const;
export const HOME_LEDE =
  "იდეები მხოლოდ მაშინ ცვლიან ქვეყანას, როდესაც ადამიანები მათ გარშემო ერთიანდებიან.";
export const HOME_HERO_JOIN = "გახდი მხარდამჭერი";
export const HOME_HERO_PRINCIPLES = "გაეცანი შეთანხმებას →";
export const HOME_MAP_CAPTION = "საქართველო ეკუთვნის ხალხს";

export const HOME_MISSION_LABEL = "პორტალის მიზანი";
export const HOME_STAT_SUPPORTERS = "მხარდამჭერი";
export const HOME_STAT_MEMBERS = "წევრი";
export const HOME_STAT_DELEGATES = "დელეგატი";
/** The mission sentence: the lead, the red middle, the rest. */
export const HOME_MISSION = [
  "ქართული რესპუბლიკის პორტალის მიზანია",
  "შექმნას სივრცე,",
  "სადაც ქართველი ხალხი:",
] as const;
/** The four steps up the mountain path, numbered ა-დ. */
export const HOME_MISSION_STEPS = [
  "გაერთიანდება",
  "ორგანიზდება",
  "აირჩევს ლიდერებს",
  "ერთად გაიმარჯვებს",
] as const;

export const HOME_JOIN_TITLE = "როგორ შემოგვიერთდები";
export const HOME_JOIN_STEPS = [
  {
    title: "მხარდამჭერი",
    text: "მარტივი რეგისტრაცია მეილით და ტელეფონით.",
    link: { href: "/join", label: "გახდი მხარდამჭერი →" },
  },
  {
    title: "წევრი",
    text: "აყენებს ინიციატივებს და მონაწილეობს საერთო კენჭისყრაში.",
    link: { href: "/join", label: "დაიწყე რეგისტრაციით →" },
  },
  {
    title: "დელეგატი",
    text: "მოძრაობის წარმომადგენელი თავის ქალაქში, სოფელში, უბანში.",
    link: { href: "/join/terms", label: "გაეცანი წესებს →" },
  },
] as const;

export const HOME_PRINCIPLES_KICKER = PRINCIPLES_TITLE;
export const HOME_PRINCIPLES_TITLE = "რა გვაერთიანებს";
/** The phone's button under the first six principles. */
export const HOME_PRINCIPLES_ALL = "სრული შეთანხმება · 12 პუნქტი";
export const HOME_MOTTO = "„ძალა ერთობაშია“";
export const HOME_MOTTO_SOURCE = "საქართველოს სახელმწიფო გერბის დევიზი";

export const HOME_STRUCTURE_KICKER = "სტრუქტურა";
/** The structure headline in its two lines: the second is set in red. */
export const HOME_STRUCTURE_TITLE = ["ორგანიზაციული", "სტრუქტურა"] as const;
export const HOME_STRUCTURE_RULES = [
  {
    term: "ბორდი",
    text: "ბორდი მოძრაობის მთავარი მმართველი ორგანოა და 5 წევრისგან შედგება.",
  },
  {
    term: "არანაკლებ 2/3",
    text: "ბორდის ახალი წევრის დამატება და მოძრაობის წესდების დამტკიცება",
  },
  {
    term: "საერთო კენჭისყრა",
    text: "ბორდს შეუძლია მნიშვნელოვანი საკითხი გადასაწყვეტად ყველა წევრს გადასცეს.",
  },
] as const;
export const HOME_STRUCTURE_LINK = "ორგანიზაციული სტრუქტურა →";
export const HOME_RING_TITLE = "ბორდი";
export const HOME_RING_SUB = "5 წევრი";

export const HOME_NEWS_TITLE = "სიახლეები";
export const HOME_NEWS_ALL = "სრულად →";
export const HOME_NEWS_EMPTY = "სიახლეები მალე გამოჩნდება.";

export const HOME_ROOTS_KICKER = "ჩვენი ფესვები";
/** The roots headline in its two lines: the second is set in red. */
export const HOME_ROOTS_TITLE = ["პირველი", "რესპუბლიკა"] as const;
export const HOME_ROOTS_QUOTE =
  "„ამიერიდან საქართველოს ხალხი სუვერენულ უფლებათა მატარებელია და საქართველო სრულუფლებოვანი დამოუკიდებელი სახელმწიფოა.“";
export const HOME_ROOTS_QUOTE_SOURCE = "დამოუკიდებლობის აქტი · 1-ლი პუნქტი";
export const HOME_ROOTS_TEXT =
  "1918 წლის 26 მაისს, 17:10 საათზე, საქართველოს ეროვნულმა საბჭომ თბილისში დამოუკიდებლობის აქტი გამოაცხადა.";
export const HOME_ROOTS_LINK = { href: "/about#roots", label: "ჩვენი ფესვები — სრულად →" } as const;
/** The phone's button at the end of the section. */
export const HOME_ROOTS_BUTTON = "ჩვენი ფესვები — სრულად";
export const HOME_DOCUMENTS_CAPTION =
  "დამოუკიდებლობის აქტი, დადასტურებული დამფუძნებელი კრების მიერ 1919 წლის 12 მარტს · 1921 წლის კონსტიტუცია: გარეკანი და ხელმოწერები. წყარო: საქართველოს ეროვნული არქივი";
/** The three archive pages in the fan, in the design's stacking order (the act on top). */
export const HOME_DOCUMENTS: DocumentFan = [
  CONSTITUTION_COVER,
  CONSTITUTION_SIGNATURES,
  INDEPENDENCE_ACT,
];

export type HomeMilestone = {
  year: string;
  date: string;
  title: string;
  text: string;
  /** A source after the text, kept on one line. */
  source?: string;
};

export const HOME_MILESTONES: readonly HomeMilestone[] = [
  {
    year: "1918",
    date: "26 მაისი",
    title: "დამოუკიდებლობის აქტი",
    text: "„დამოუკიდებელ საქართველოს პოლიტიკური ფორმა დემოკრატიული რესპუბლიკაა.“",
  },
  {
    year: "1919",
    date: "14–16 თებერვალი",
    title: "დამფუძნებელი კრება",
    text: "არჩეულია „…პირდაპირი, თანასწორი, საყოველთაო, ფარული და პროპორციონალური საარჩევნო სისტემით ორივე სქესის მოქალაქეთა მიერ“.",
  },
  {
    year: "1921",
    date: "21 თებერვალი",
    title: "კონსტიტუცია",
    text: "„ხელმწიფება ეკუთვნის მთელს ერს…“",
    source: "— მუხლი 52",
  },
  {
    year: "1991",
    date: "9 აპრილი",
    title: "დამოუკიდებლობის აღდგენა",
    text: "დამოუკიდებლობა აღდგა „…საქართველოს დამოუკიდებლობის 1918 წლის 26 მაისის აქტის საფუძველზე.“",
  },
];
