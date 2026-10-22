/**
 * Every Georgian string on /about and in the homepage section that links to it. The owner's
 * text was supplied in chat on 2026-10-13; the „ერთობა“ redesign (Page 2 of the design canvas)
 * splits it into the hero, the wine band, the goal steps and the portal cards and adds the
 * 1918 — 1991 roots section. All copy below is the design's, kept verbatim.
 */
import {
  CONSTITUTION_FIRST_CHAPTER,
  CONSTITUTION_SIGNATURES,
  INDEPENDENCE_ACT,
  type DocumentFan,
} from "@/lib/archive-documents";

export const ABOUT_HREF = "/about";
export const ABOUT_TITLE = "ჩვენ შესახებ";
/** The search-result description (owner-approved 2026-10-22). */
export const ABOUT_SEO_DESCRIPTION =
  "ვინ ვართ, რის გვჯერა და რა არის ჩვენი მიზანი: ერთობიდან გამარჯვებამდე.";

/** The hero headline: the red first words, then the rest. */
export const ABOUT_INTRO_LEAD = "ქართული რესპუბლიკა";
export const ABOUT_INTRO_REST = "არის იმ ადამიანების ერთობა, ვისაც გვჯერა:";
export const ABOUT_INTRO = `${ABOUT_INTRO_LEAD} ${ABOUT_INTRO_REST}`;

export const ABOUT_BELIEFS = [
  "რომ საქართველო და ქართული სახელმწიფო ეკუთვნის ქართველ ერს და არა ვიწრო, კორუმპირებულ ელიტას, რომელიც ჩვენს ხარჯზე მდიდრდება და ქვეყნის სიმდიდრეს პირად ქონებად აქცევს.",
  "რომ საქართველოს უნდა მართავდნენ ადამიანები, რომლებიც მთელი ერის ინტერესებს ემსახურებიან და არა მხოლოდ რამდენიმე ოლიგარქისა თუ ჩინოვნიკისას.",
  "რომ ჩვენ შეგვიძლია შევქმნათ სახელმწიფო, სადაც არცერთი ადამიანი არ იგრძნობს თავს დაჩაგრულად, ყველას ექნება გამდიდრების თანაბარი შესაძლებლობა და თითოეულ ქართულ ოჯახს ექნება ღირსეული ცხოვრების პირობები.",
] as const;

/** The wine band: the sentence, its last clause set in white. */
export const ABOUT_UNITY_LEAD =
  "ჩვენ ასევე გვჯერა, რომ ამ ყველაფრის მიღწევას ქართველები ვერ შევძლებთ თანადგომისა და ერთიანობის გარეშე,";
export const ABOUT_UNITY_CLOSE = "მაგრამ აუცილებლად შევძლებთ, თუ გავერთიანდებით.";
export const ABOUT_UNITY = `${ABOUT_UNITY_LEAD} ${ABOUT_UNITY_CLOSE}`;

export const ABOUT_GOAL_KICKER = "ჩვენი მიზანი";
export const ABOUT_GOAL_TITLE = "ერთობიდან გამარჯვებამდე";
/** The three goal steps; `label` is written in Mtavruli capitals on the page. */
export const ABOUT_GOAL_STEPS = [
  {
    label: "ერთობა",
    text: "ქართველი ერის გაერთიანება საერთო შეთანხმების, ღირებულებებისა და მიზნების გარშემო",
  },
  {
    label: "პოლიტიკური ძალა",
    text: "ამ ერთობის ჩამოყალიბება ხალხის მიერ შექმნილ, ძლიერ პოლიტიკურ ძალად",
  },
  { label: "გამარჯვება", text: "ერის ნების გამარჯვება" },
] as const;

export const ABOUT_PORTAL_KICKER = "პორტალი";
export const ABOUT_PORTAL_LEAD =
  "სწორედ ასეთი პოლიტიკური ერთობის ჩამოყალიბებისა და გაძლიერების ხელშეწყობაა ამ პორტალის მიზანი.";
export const ABOUT_PORTAL_SUB = "ეს არის სივრცე, სადაც ქართველ ხალხს შეუძლია:";

export type AboutPortalCard = {
  title: string;
  /** The lower block: a Mtavruli label, a line of text and a link. */
  detail: {
    label: string;
    text: string;
    /** `signedInHref`, when set, replaces `href` for a signed-in visitor. */
    link: { href: string; signedInHref?: string; label: string };
  };
};

export const ABOUT_PORTAL_CARDS: readonly AboutPortalCard[] = [
  {
    title: "გაერთიანება",
    detail: {
      label: "მხარდამჭერი",
      text: "მარტივი რეგისტრაცია მეილით და ტელეფონით.",
      link: { href: "/join", label: "გახდი მხარდამჭერი →" },
    },
  },
  {
    title: "ორგანიზება",
    detail: {
      label: "წევრი",
      text: "წევრად გასახდომად შეავსე განაცხადი.",
      link: { href: "/join", signedInHref: "/me/membership", label: "გახდი წევრი →" },
    },
  },
  {
    title: "ლიდერების არჩევა",
    detail: {
      label: "დელეგატი",
      text: "მოძრაობის წარმომადგენელი თავის ქალაქში, სოფელში, უბანში.",
      link: { href: "/join/terms", label: "გაეცანი წესებს →" },
    },
  },
  {
    title: "გადაწყვეტილებების მიღების პროცესში მონაწილეობა",
    detail: {
      label: "საერთო კენჭისყრა",
      text: "ბორდს შეუძლია მნიშვნელოვანი საკითხი გადასაწყვეტად ყველა წევრს გადასცეს.",
      link: { href: "/structure", label: "ორგანიზაციული სტრუქტურა →" },
    },
  },
];

export const ABOUT_ROOTS_KICKER = "ჩვენი ფესვები";
export const ABOUT_ROOTS_TITLE = "1918 — 1991";
export const ABOUT_ROOTS_INTRO =
  "1918 წლის 26 მაისს საქართველომ დამოუკიდებლობა გამოაცხადა და დემოკრატიული რესპუბლიკა შექმნა. სამ წელზე ნაკლებ დროში რესპუბლიკამ საყოველთაო არჩევნები ჩაატარა, ქალებს ხმის უფლება მისცა და მიიღო კონსტიტუცია, რომელიც ხელმწიფებას მთელს ერს აკუთვნებდა.";

/** The three archive pages in the fan, in the design's stacking order (the act on top). */
export const ABOUT_DOCUMENTS: DocumentFan = [
  CONSTITUTION_FIRST_CHAPTER,
  CONSTITUTION_SIGNATURES,
  INDEPENDENCE_ACT,
];
export const ABOUT_DOCUMENTS_CAPTION =
  "დამოუკიდებლობის აქტი (1919 წლის 12 მარტის ეგზემპლარი) · 1921 წლის კონსტიტუცია: პირველი თავი და ხელმოწერები. წყარო: საქართველოს ეროვნული არქივი";

export type AboutTimelineEntry = {
  year: string;
  date: string;
  title: string;
  /** One or more lines of text. */
  lines: readonly string[];
  /** A quoted source after the text, kept on one line. */
  source?: string;
  /** The 1918 entry carries the republic's flag, the 9 April entry the tulips. */
  art?: "flag" | "tulips";
};

export const ABOUT_TIMELINE_LABEL = "ქრონოლოგია";
export const ABOUT_TIMELINE_FLAG = "რესპუბლიკის დროშა: 1918–1921, 1990–2004";
export const ABOUT_TIMELINE: readonly AboutTimelineEntry[] = [
  {
    year: "1918",
    date: "26 მაისი, 17:10",
    title: "დამოუკიდებლობის აქტი",
    lines: [
      "„…თანასწორად უზრუნველჰყოფს ყველა მოქალაქის სამოქალაქო და პოლიტიკურ უფლებებს განურჩევლად ეროვნებისა, სარწმუნოებისა, სოციალურ მდგომარეობისა და სქესისა.“",
    ],
    source: "— მე-5 პუნქტი",
    art: "flag",
  },
  {
    year: "1919",
    date: "14–16 თებერვალი",
    title: "დამფუძნებელი კრების არჩევნები",
    lines: ["არჩევნებში ორივე სქესის მოქალაქეები მონაწილეობდნენ. 130 დეპუტატიდან 5 ქალი იყო."],
  },
  {
    year: "1921",
    date: "21 თებერვალი",
    title: "კონსტიტუცია",
    lines: [
      "„ხელმწიფება ეკუთვნის მთელს ერს…“ — მუხლი 52",
      "„სიკვდილით დასჯა გაუქმებულია.“ — მუხლი 19",
      "კანონის ინიციატივის უფლება 5 000 ამომრჩეველსაც ჰქონდა — მუხლი 63",
    ],
  },
  {
    year: "1921",
    date: "25 თებერვალი",
    title: "ოკუპაცია",
    lines: ["წითელი არმია თბილისში შევიდა. 2010 წლიდან 25 თებერვალი საბჭოთა ოკუპაციის დღეა."],
  },
  {
    year: "1989",
    date: "9 აპრილი",
    title: "9 აპრილის ტრაგედია",
    lines: ["საბჭოთა ჯარმა რუსთაველის გამზირზე მშვიდობიანი აქცია დაარბია. დაიღუპა 21 ადამიანი."],
    art: "tulips",
  },
  {
    year: "1991",
    date: "31 მარტი",
    title: "რეფერენდუმი",
    lines: ["მონაწილეობა — 90,57%. დამოუკიდებლობის აღდგენას მხარი დაუჭირა ხმათა 99,49%-მა."],
  },
  {
    year: "1991",
    date: "9 აპრილი",
    title: "დამოუკიდებლობის აღდგენა",
    lines: [
      "დამოუკიდებლობა აღდგა „…საქართველოს დამოუკიდებლობის 1918 წლის 26 მაისის აქტის საფუძველზე.“",
    ],
  },
];

/** The closing band's second link. */
export const ABOUT_CLOSING_LINK = { href: "/support", label: "დაგვიკავშირდი →" } as const;
