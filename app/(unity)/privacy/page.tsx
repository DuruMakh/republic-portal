import type { Metadata } from "next";
import { Caps } from "@/components/Caps";
import { UnityKicker } from "@/components/UnityKicker";
import { UnityTextLink } from "@/components/UnityTextLink";
import { GEORGIAN_NUMERALS } from "@/lib/principles-copy";
import { SUPPORT_HEADING } from "@/lib/support-copy";

export const metadata: Metadata = {
  title: "კონფიდენციალურობის პოლიტიკა — ქართული რესპუბლიკა",
  description: "ეს გვერდი გიხსნის, რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და ვინ ხედავს მათ.",
};

/** `contact` adds a link to the contact page, the channel for questions and data requests. */
type Section = ({ heading: string; body: string } | { heading: string; items: string[] }) & {
  contact?: true;
};

/**
 * Spec docs/superpowers/specs/2026-10-08-registration-privacy-consent-design.md section 5.
 * Linked from the registration consent box (lib/privacy.ts PRIVACY_POLICY_PATH), so
 * changing the substance here means bumping PRIVACY_POLICY_VERSION and the migration.
 * The 2026-10-09 self-service-deletion sentences and the retention section's account of what
 * outlives a deletion deliberately kept version 2026-10-v1 (spec
 * docs/superpowers/specs/2026-10-08-account-deletion-design.md section 5).
 */
const SECTIONS: Section[] = [
  {
    heading: "ვინ ვართ",
    body: "პლატფორმას მართავს მოძრაობა ქართული რესპუბლიკა. ის პასუხისმგებელია იმ პერსონალურ მონაცემებზე, რომლებსაც ამ საიტზე გვაწვდი. კითხვებისა და მოთხოვნებისთვის მოგვწერე საკონტაქტო გვერდიდან.",
    contact: true,
  },
  {
    heading: "რა მონაცემებს ვაგროვებთ",
    items: [
      "რეგისტრაციისას: Google ანგარიშის ელფოსტა, სახელი და პროფილის ფოტო (მათ Google გვაწვდის), შენ მიერ შეყვანილი სახელი და გვარი, ტელეფონის ნომერი (დადასტურებული SMS კოდით) და რეფერალური კოდი, თუ ბმულით მოხვედი.",
      "წევრობის განაცხადისას: პირადი ნომერი, დაბადების თარიღი, რეგიონი და ქალაქი, საქმიანობა და შენ მიერ არჩეული დელეგატი.",
      "დელეგატად დამტკიცებისას: მოკლე ბიოგრაფია და ფოტო.",
      "საიტით სარგებლობისას: ღონისძიებებზე დასწრების მონიშვნა, ხმა გამოკითხვებში და საკონტაქტო ფორმით გამოგზავნილი შეტყობინებები.",
      "ტექნიკური ჩანაწერები: საიტის მუშაობისა და უსაფრთხოებისთვის სერვერი ავტომატურად აღრიცხავს IP მისამართს და ბრაუზერის მონაცემებს.",
    ],
  },
  {
    heading: "რისთვის ვიყენებთ",
    body: "შენს მონაცემებს ვიყენებთ მხოლოდ მოძრაობის საქმიანობისთვის: რეგისტრაციისა და შესვლისთვის, წევრობისა და დელეგატების სისტემისთვის, ღონისძიებებისა და გამოკითხვების ორგანიზებისთვის და საჯარო სტატისტიკისთვის, რომელიც მხოლოდ ჯამურ რიცხვებს აჩვენებს. მონაცემებს არ ვყიდით და რეკლამისთვის არ ვიყენებთ.",
  },
  {
    heading: "ვინ ხედავს შენს მონაცემებს",
    items: [
      "მხარდამჭერის შესახებ საჯაროდ არაფერი ჩანს.",
      "თუ წევრი გახდები და დელეგატს აირჩევ, ეს დელეგატი ხედავს შენს სახელს, გვარს, რეგისტრაციის თარიღს, სტატუსს და ღონისძიებებზე დასწრების მონიშვნას.",
      "თუ დელეგატად დაგამტკიცებენ, საჯაროდ გამოჩნდება შენი სახელი, გვარი, რეგიონი, ფოტო, ბიოგრაფია, წევრების რაოდენობა და ადგილი რეიტინგში.",
      "სრულ მონაცემებს ხედავენ მხოლოდ პლატფორმის ადმინისტრატორები.",
      "საჯაროდ ქვეყნდება მხოლოდ ჯამური რიცხვები, მათ შორის რეგიონების მიხედვით.",
    ],
  },
  {
    heading: "ვის ვუზიარებთ",
    body: "მონაცემებს ვუზიარებთ მხოლოდ იმ მომსახურების მიმწოდებლებს, რომლებიც საიტის მუშაობისთვისაა საჭირო — ავტორიზაცია, SMS-ით დადასტურება, მონაცემთა შენახვა და ჰოსტინგი. მონაცემთა ბაზა ევროკავშირში მდებარეობს, თუმცა ზოგიერთი მიმწოდებელი, მაგალითად Google-ით შესვლა და ჰოსტინგი, მონაცემებს აშშ-შიც ამუშავებს. სხვა პირებს შენს მონაცემებს შენი თანხმობის გარეშე არ გადავცემთ, გარდა კანონით გათვალისწინებული შემთხვევებისა.",
  },
  {
    heading: "რამდენ ხანს ვინახავთ",
    body: "მონაცემებს ვინახავთ, სანამ ანგარიშს არ წაშლი. წაშლისას შენი პერსონალური მონაცემები პლატფორმის მონაცემთა ბაზიდან მაშინვე იშლება. დასრულებულ გამოკითხვებში მიცემული ხმები რჩება ისე, რომ შენი ამოცნობა შეუძლებელი იყოს. SMS-ების ლიმიტის აღრიცხვაში შენი ტელეფონის ნომერი რჩება დაახლოებით ერთი დღის განმავლობაში, სარეზერვო ასლები კი თავისით იშლება ერთი კვირის განმავლობაში. საკონტაქტო ფორმით გამოგზავნილი შეტყობინებები ანგარიშთან დაკავშირებული არ არის და ინახება ცალკე.",
  },
  {
    heading: "შენი უფლებები",
    body: "პერსონალურ მონაცემთა დაცვის შესახებ საქართველოს კანონის მიხედვით, შეგიძლია მოითხოვო შენი მონაცემების ნახვა, გასწორება ან წაშლა, ასევე ნებისმიერ დროს, მიზეზის განმარტების გარეშე, გაიხმო თანხმობა. ანგარიშის წაშლა შეგიძლია თავადაც, პროფილის გვერდიდან. მოთხოვნა გამოგვიგზავნე საკონტაქტო გვერდიდან — გიპასუხებთ არაუგვიანეს 10 სამუშაო დღისა.",
    contact: true,
  },
  {
    heading: "ასაკი",
    body: "პლატფორმაზე რეგისტრაცია შეუძლია მხოლოდ 18 წლის ან უფროს პირს.",
  },
  {
    heading: "ქუქი-ფაილები",
    body: "საიტი იყენებს მხოლოდ შესვლისთვის აუცილებელ ქუქი-ფაილებს. სათვალთვალო ან სარეკლამო ქუქი-ფაილებს არ ვიყენებთ.",
  },
  {
    heading: "ცვლილებები",
    body: "თუ ამ პოლიტიკას შევცვლით, ახალ ვერსიას თარიღით აქ გამოვაქვეყნებთ.",
  },
];

const sectionId = (index: number) => `p${index + 1}`;

export default function PrivacyPage() {
  return (
    <main
      aria-labelledby="page-title"
      className="pb-16 pt-10 sm:pb-[clamp(88px,9vw,136px)] sm:pt-[clamp(56px,6vw,88px)]"
    >
      <div className="unity-container">
        <UnityKicker>პერსონალური მონაცემები</UnityKicker>
        <h1
          id="page-title"
          className="m-0 mt-[18px] max-w-[16em] break-words font-serif text-[28px] font-semibold leading-[1.16] tracking-[-.005em] [text-wrap:balance] sm:mt-[26px] sm:text-[clamp(44px,4.4vw,64px)] sm:leading-[1.12] sm:tracking-[-.01em]"
        >
          კონფიდენციალურობის პოლიტიკა
        </h1>
        <p className="m-0 mt-4 max-w-[34em] font-serif text-[18px] leading-[1.6] text-prose sm:mt-[26px] sm:text-[clamp(19px,1.6vw,22px)]">
          ეს გვერდი გიხსნის, რა მონაცემებს ვაგროვებთ, რისთვის ვიყენებთ და ვინ ხედავს მათ. ვერსია 1,
          2026 წლის ოქტომბერი.
        </p>
        <div className="mt-7 grid items-start gap-[clamp(40px,5vw,88px)] sm:mt-12 min-[900px]:grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="სარჩევი" className="sticky top-6 hidden min-[900px]:block">
            <p className="m-0 border-b-2 border-ink pb-2.5 text-[12px] font-bold tracking-[.14em] text-secondary">
              <Caps>სარჩევი</Caps>
            </p>
            <ol className="m-0 list-none p-0">
              {SECTIONS.map((section, index) => (
                <li key={section.heading}>
                  <a
                    href={`#${sectionId(index)}`}
                    className="grid grid-cols-[30px_minmax(0,1fr)] gap-2 border-b border-rule py-[9px] text-[15px] text-ink no-underline transition-colors hover:text-brand"
                  >
                    <Numeral index={index} className="text-[20px] leading-[1.1]" />
                    <span>{section.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="border-y-2 border-ink">
            {SECTIONS.map((section, index) => (
              <section
                key={section.heading}
                id={sectionId(index)}
                aria-labelledby={`${sectionId(index)}-t`}
                className="grid scroll-mt-6 grid-cols-[38px_minmax(0,1fr)] gap-2.5 border-b border-rule py-[22px] last:border-b-0 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-6 sm:py-[30px]"
              >
                <Numeral index={index} className="text-[28px] leading-[1.1] sm:text-[40px]" />
                <div className="min-w-0">
                  <h2
                    id={`${sectionId(index)}-t`}
                    className="m-0 font-serif text-[20px] font-bold leading-[1.35] text-ink sm:text-[24px]"
                  >
                    {section.heading}
                  </h2>
                  {"items" in section ? (
                    <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
                      {section.items.map((item) => (
                        <li
                          key={item}
                          className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-[16px] leading-[1.7] text-prose sm:text-[17px]"
                        >
                          <span aria-hidden="true" className="pt-[9px]">
                            <span className="block h-2 w-2.5 rounded-[48%_52%_55%_45%/50%_46%_54%_50%] bg-teal" />
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 mt-3 text-[16px] leading-[1.75] text-prose sm:text-[17px]">
                      {section.body}
                    </p>
                  )}
                  {section.contact ? (
                    <p className="m-0 mt-3.5">
                      <UnityTextLink href="/support" className="text-[15.5px] font-bold">
                        {SUPPORT_HEADING} →
                      </UnityTextLink>
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/** The old Georgian letter numbering each section (ა, ბ, გ …), decoration only. */
function Numeral({ index, className }: { index: number; className: string }) {
  return (
    <span aria-hidden="true" className={`font-aso font-light text-brand ${className}`}>
      {GEORGIAN_NUMERALS[index]}
    </span>
  );
}
