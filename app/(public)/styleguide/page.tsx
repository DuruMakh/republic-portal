import { BallotBar, ballotButtonClasses } from "@/components/Ballot";
import { Badge } from "@/components/Badge";
import { Button, type ButtonVariant } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { ContentBody } from "@/components/ContentBody";
import { ContentNav } from "@/components/ContentNav";
import { DataTable, tableCellClass, tableRowClass, tableThClass } from "@/components/DataTable";
import { Eyebrow } from "@/components/Eyebrow";
import { adminControlClasses, Field } from "@/components/Field";
import { IndexRow } from "@/components/IndexRow";
import { Masthead } from "@/components/Masthead";
import { NewsCard } from "@/components/NewsCard";
import { PageSheet } from "@/components/PageSheet";
import { PhotoFigure } from "@/components/PhotoFigure";
import { Pill } from "@/components/Pill";
import { SectionRule } from "@/components/SectionRule";
import { StatCard } from "@/components/StatCard";
import { Stepper } from "@/components/Stepper";
import { TransferInstructions } from "@/components/TransferInstructions";
import { formatAmountGel, formatDateKa, paymentMethodLabel, paymentStatusKa } from "@/lib/cabinet";
import {
  DelegateBindingPickerSample,
  DelegateBindingReferralSample,
  OtpInputSample,
  TierPickerSample,
} from "./samples";

// Design-token reference (spec §2.2). Token/class names are the literal Tailwind
// identifiers (bg-ink, text-brand, …) — kept in their canonical Latin form, same
// house style as showing "adminControlClasses" inline below (item 9).
const PALETTE: { name: string; hex: string }[] = [
  { name: "brand", hex: "#9F1D35" },
  { name: "brand-dark", hex: "#7C1629" },
  { name: "ink", hex: "#1A1611" },
  { name: "prose", hex: "#3E362B" },
  { name: "muted-fg", hex: "#6E6659" },
  { name: "paper", hex: "#F7F2E9" },
  { name: "paper-bright", hex: "#FFFDF8" },
  { name: "stone", hex: "#E5DFD2" },
  { name: "hairline", hex: "#C9BFAC" },
  { name: "frame", hex: "#B5AB98" },
  { name: "surface", hex: "#EFE8DA" },
  { name: "ok", hex: "#188038" },
  { name: "ok-deep", hex: "#146C2E" },
  { name: "warn", hex: "#B45309" },
  { name: "warn-deep", hex: "#96450A" },
  { name: "danger", hex: "#9F1D35" },
];

// Verified contrast pairs (spec §2.5) — all pass AA.
const CONTRAST_PAIRS = [
  "ink / paper — 16.1:1",
  "brand / paper — 7.0:1",
  "muted-fg / paper — 5.1:1",
  "paper / ink — 16.1:1",
  "paper / brand — 7.0:1",
];

const BUTTON_VARIANTS: { variant: ButtonVariant; label: string }[] = [
  { variant: "primary", label: "primary" },
  { variant: "ghost", label: "ghost" },
  { variant: "danger", label: "danger" },
  { variant: "dark", label: "dark" },
];

export default function StyleguidePage() {
  const demoPaymentStatus = paymentStatusKa(null);

  return (
    <PageSheet>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <h1 className="font-serif text-3xl font-bold text-ink">დიზაინ-სისტემა</h1>

        {/* 1. Palette */}
        <Card title="ფერები">
          <div className="flex flex-col">
            {PALETTE.map((t) => (
              <div key={t.name} className="flex items-center gap-3 border-b border-hairline py-2">
                <span
                  aria-hidden
                  className="h-8 w-8 shrink-0 border border-hairline"
                  style={{ background: t.hex }}
                />
                <span className="font-mono text-[0.8rem] text-ink">{t.name}</span>
                <span className="ml-auto font-mono text-[0.8rem] text-muted-fg">{t.hex}</span>
              </div>
            ))}
          </div>
          <ul className="mt-4 flex flex-col gap-1 border-t-2 border-ink pt-3 font-mono text-[0.74rem] text-muted-fg">
            {CONTRAST_PAIRS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Card>

        {/* 2. Type scale */}
        <Card title="შრიფტები">
          <div className="flex flex-col gap-4">
            <p className="font-serif text-[2.1rem] font-bold leading-tight text-ink">
              ავაშენოთ ქართული რესპუბლიკა ერთად
            </p>
            <h2 className="font-serif text-[1.6rem] font-bold text-ink">ჩვენი დელეგატები</h2>
            <p className="max-w-prose font-serif text-[1.12rem] leading-[1.6] text-prose">
              გამჭვირვალე სამოქალაქო მოძრაობა — ვერიფიცირებული დელეგატები, ღია რეიტინგი და საჯარო
              ფინანსები. შენს ხელში.
            </p>
            <div className="text-[0.7rem] font-bold uppercase tracking-[.18em] text-ink">
              რეიტინგი
            </div>
          </div>
        </Card>

        {/* 3. Buttons */}
        <Card title="ღილაკები">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button>ძირითადი</Button>
              <Button variant="ghost">მეორადი</Button>
              <Button variant="danger">საშიში</Button>
              <ButtonLink href="/leaderboard">ბმულის ღილაკი</ButtonLink>
            </div>
            <div className="flex flex-col gap-3">
              <div className="text-xs font-semibold text-muted-fg">ზომები</div>
              {BUTTON_VARIANTS.map((v) => (
                <div key={v.variant} className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 font-mono text-[0.7rem] text-muted-fg">
                    {v.label}
                  </span>
                  <Button variant={v.variant} size="sm">
                    პატარა
                  </Button>
                  <Button variant={v.variant} size="md">
                    საშუალო
                  </Button>
                  <Button variant={v.variant} size="lg">
                    დიდი
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-fg">მუქი ვარიანტები</div>
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-ink p-4">
                <span className="w-20 shrink-0 font-mono text-[0.7rem] text-paper">
                  ghost-inverse
                </span>
                <Button variant="ghost-inverse" size="sm">
                  პატარა
                </Button>
                <Button variant="ghost-inverse" size="md">
                  საშუალო
                </Button>
                <Button variant="ghost-inverse" size="lg">
                  დიდი
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 4. Pill statuses — smoke-test anchor (e2e/smoke.spec.ts:20-33): keep this
            card's title and sample set byte-exact. */}
        <Card title="სტატუსები">
          <div className="flex flex-wrap gap-2">
            <Pill status="draft" />
            <Pill status="profile_completed" />
            <Pill status="active_member" />
            <Pill status="pending" />
            <Pill status="approved" />
            <Pill status="rejected" />
          </div>
        </Card>

        {/* 5. StatCard */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="დამტკიცებული დელეგატი" value={112} accent="brand" />
          <StatCard label="აქტიური წევრი" value={1700} accent="brand" />
        </div>

        {/* 6. Badge */}
        <Card title="ბეჯი">
          <div className="flex flex-wrap gap-2">
            <Badge>12 დელეგატი</Badge>
            <Badge>ახალი</Badge>
          </div>
        </Card>

        {/* 7. Card with header — a plain small-caps label, never rich compound content. */}
        <Card header="ბარათი სათაურით" padded={false}>
          <div className="divide-y divide-line">
            <div className="px-4 py-3 text-sm text-ink sm:px-5">პირველი მაგალითი რიგი</div>
            <div className="px-4 py-3 text-sm text-ink sm:px-5">მეორე მაგალითი რიგი</div>
          </div>
        </Card>

        {/* 8. Eyebrow */}
        <Card title="ეიბროუ">
          <Eyebrow>საჯარო პორტალი</Eyebrow>
        </Card>

        {/* 9. Field + adminControlClasses input */}
        <Card title="ფორმის ველი">
          <div className="flex flex-col gap-4">
            <Field label="ტელეფონის ნომერი" name="phone" placeholder="5XX XX XX XX" />
            <input
              readOnly
              value="ძებნის ველი (adminControlClasses)"
              className={adminControlClasses}
            />
          </div>
        </Card>

        {/* 10. Stepper */}
        <Card title="სტეპერი">
          <Stepper steps={["პროფილი", "საწევრო"]} current={1} />
        </Card>

        {/* 11. OtpInput */}
        <Card title="SMS კოდის ველი">
          <OtpInputSample />
        </Card>

        {/* 12. TierPicker */}
        <Card title="საწევროს არჩევა">
          <TierPickerSample />
        </Card>

        {/* 13. DelegateBinding */}
        <Card title="დელეგატის მიბმა — რეფერალით">
          <DelegateBindingReferralSample />
        </Card>
        <Card title="დელეგატის მიბმა — არჩევანი">
          <DelegateBindingPickerSample />
        </Card>

        {/* 14. NEW furniture (Tasks 5–6) */}
        <Card header="სათაური" padded={false}>
          <Masthead
            navItems={[
              { href: "/", label: "მთავარი" },
              { href: "/delegates", label: "დელეგატები" },
              { href: "/leaderboard", label: "რეიტინგი" },
            ]}
            dateKa={formatDateKa("2026-07-23T00:00:00.000Z")}
            cta={
              <ButtonLink href="/join" size="sm">
                შემოგვიერთდი
              </ButtonLink>
            }
          />
        </Card>

        <Card title="რეიტინგი">
          <SectionRule
            label="რეიტინგი — ხუთეული"
            action={
              <a href="/leaderboard" className="text-[0.72rem]">
                სრულად →
              </a>
            }
          />
        </Card>

        <Card title="საჯარო რეესტრი">
          <div>
            <IndexRow
              rank={1}
              name="გიორგი მაისურაძე"
              meta="თბილისი — დამტკიცებული · იან 2026"
              figure={342}
              figureLabel="მხარდამჭერი"
              href="/leaderboard"
            />
            <IndexRow
              rank={2}
              name="თამარ ქავთარაძე"
              meta="აჭარა — დამტკიცებული · იან 2026"
              figure={287}
              figureLabel="მხარდამჭერი"
              href="/leaderboard"
            />
            <IndexRow
              rank={3}
              name="ლევან ჩხეიძე"
              meta="იმერეთი — დამტკიცებული · თებ 2026"
              figure={256}
              figureLabel="მხარდამჭერი"
            />
          </div>
        </Card>

        <Card title="გამოკითხვა">
          <div className="flex flex-col gap-4">
            <p className="font-serif text-[1.02rem] font-semibold leading-snug text-ink">
              უნდა ჩატარდეს თუ არა ღია პრაიმერიზი რეგიონულ დელეგატებზე?
            </p>
            <div className="flex flex-col gap-2">
              <BallotBar label="დიახ" pct={71} tone="brand" />
              <BallotBar label="არა" pct={14} tone="ink" />
              <BallotBar label="თავს ვიკავებ" pct={15} tone="muted" />
            </div>
            <div className="flex gap-2">
              <button type="button" className={ballotButtonClasses("solid")}>
                დიახ
              </button>
              <button type="button" className={ballotButtonClasses("solid")}>
                არა
              </button>
              <button type="button" className={ballotButtonClasses("muted")}>
                თავს ვიკავებ
              </button>
            </div>
          </div>
        </Card>

        <Card title="ფოტო">
          <PhotoFigure
            src="/brand/emblem-roundel-red-notext.png"
            alt="ქართული რესპუბლიკა"
            caption="ქართული რესპუბლიკა"
            width={160}
            height={160}
          />
        </Card>

        <Card title="გადარიცხვა">
          <TransferInstructions tier={10} referenceCode="GR-ABC234" />
        </Card>

        <Card title="შენატანების დავთარი">
          <DataTable
            head={
              <>
                <th className={tableThClass}>თარიღი</th>
                <th className={tableThClass}>თანხა</th>
                <th className={tableThClass}>მეთოდი</th>
                <th className={tableThClass}>სტატუსი</th>
              </>
            }
          >
            <tr className={tableRowClass}>
              <td className={tableCellClass}>{formatDateKa("2026-07-01T00:00:00.000Z")}</td>
              <td className={tableCellClass}>{formatAmountGel(10)} ₾</td>
              <td className={tableCellClass}>{paymentMethodLabel("manual")}</td>
              <td className={tableCellClass}>
                <Pill status={demoPaymentStatus.pillStatus} label={demoPaymentStatus.label} />
              </td>
            </tr>
          </DataTable>
        </Card>

        {/* 15. NewsCard / ContentBody / ContentNav */}
        <Card title="შიგთავსის კომპონენტები">
          <div className="flex flex-col gap-5">
            <ContentBody body={"აბზაცი პირველი.\n\nბმულით: https://example.ge"} />
            <NewsCard
              href="/styleguide"
              title="სიახლის ბარათი"
              publishedAt="19.07.2026"
              imageUrl={null}
              excerptText="მოკლე შინაარსი ბარათისთვის…"
              pill={<Pill status="profile_completed" label="წევრებისთვის" />}
            />
            <ContentNav />
          </div>
        </Card>
      </main>
    </PageSheet>
  );
}
