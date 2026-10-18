import { useCopy } from "@/lib/i18n/copy";
import { Caps } from "@/components/Caps";
import { CabinetNote } from "@/components/CabinetPage";
import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { BANK_DETAILS } from "@/lib/bank-details";
import { MEMBERSHIP_FEE_GEL } from "@/lib/funnel";

const BANK_ROWS = [
  { label: "მიმღები", value: BANK_DETAILS.recipientName, mono: false },
  { label: "ბანკი", value: BANK_DETAILS.bankName, mono: false },
  { label: "IBAN", value: BANK_DETAILS.iban, mono: true },
] as const;

export function TransferInstructions({ referenceCode }: { referenceCode: string | null }) {
  const t = useCopy();
  // legacy pre-Phase-2 accounts have no code (spec §3.8) — show nothing
  if (!referenceCode) return null;
  return (
    <div>
      <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8">
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-bold tracking-[.14em] text-secondary">
            <Caps>{t("შენი პირადი კოდი")}</Caps>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-3.5">
            <span
              className="font-serif text-[32px] font-semibold tracking-[.12em] text-brand md:text-[42px]"
              data-testid="reference-code"
            >
              {referenceCode}
            </span>
            <CopyButton text={referenceCode} />
          </div>
          <p className="mt-3 mb-0 text-[15px] leading-[1.6] text-prose">
            {t("მიუთითე ეს კოდი ყველა გადარიცხვის დანიშნულებაში.")}
          </p>
        </div>
        <div className="justify-self-start border border-rule bg-chalk p-2 sm:justify-self-end">
          <QrCode value={referenceCode} label={t("პირადი კოდი — QR")} size={128} />
        </div>
      </div>
      {BANK_DETAILS.placeholder ? (
        <div className="mt-6 border-t border-rule pt-6">
          <CabinetNote testId="bank-placeholder">
            {t("საბანკო რეკვიზიტები მალე დაემატება — ეს დროებითი მონაცემებია.")}
          </CabinetNote>
        </div>
      ) : null}
      <dl className="mt-3.5 mb-0 border-t border-rule">
        {BANK_ROWS.map((row) => (
          <div
            key={t(row.label)}
            className="grid gap-1 border-b border-rule py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="pt-[3px] text-[12px] font-bold tracking-[.12em] text-secondary">
              <Caps>{t(row.label)}</Caps>
            </dt>
            <dd
              className={`m-0 text-[16px] font-semibold text-ink ${row.mono ? "font-mono tracking-[.02em]" : ""}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-[18px] mb-0 text-[15px] leading-[1.65] text-prose">
        {t("გადმორიცხე ")}
        <strong className="font-serif text-ink">{MEMBERSHIP_FEE_GEL} ₾</strong>{" "}
        {t(
          "ყოველთვიურად ამ ანგარიშზე და დანიშნულებაში მიუთითე შენი პირადი კოდი — ასე დავაკავშირებთ გადმორიცხვას შენს წევრობასთან.",
        )}
      </p>
    </div>
  );
}
