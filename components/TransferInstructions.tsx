import { CopyButton } from "@/components/CopyButton";
import { QrCode } from "@/components/QrCode";
import { BANK_DETAILS } from "@/lib/bank-details";
import type { Tier } from "@/lib/funnel";

export function TransferInstructions({
  tier,
  referenceCode,
}: {
  tier: Tier | null;
  referenceCode: string | null;
}) {
  // legacy pre-Phase-2 accounts have no code (spec §3.8) — show nothing
  if (!referenceCode) return null;
  return (
    <div className="mt-6 border border-ink bg-paper-bright p-5 text-center">
      <p className="text-[0.74rem] font-bold uppercase tracking-[.08em] text-muted-fg">
        შენი პირადი კოდი
      </p>
      <p
        className="mt-1 font-serif text-xl font-bold tracking-wider text-brand"
        data-testid="reference-code"
      >
        {referenceCode}
      </p>
      <div className="mt-2 flex justify-center">
        <CopyButton text={referenceCode} />
      </div>
      <p className="mt-2 text-[0.74rem] text-muted-fg">
        მიუთითე ეს კოდი ყველა გადარიცხვის დანიშნულებაში.
      </p>
      <div className="mt-4 flex justify-center">
        <QrCode value={referenceCode} label="პირადი კოდი — QR" size={128} />
      </div>
      <div className="mt-5 border-t border-hairline pt-4 text-left">
        {BANK_DETAILS.placeholder ? (
          <p
            className="mb-3 text-[0.74rem] font-semibold text-warn-deep"
            data-testid="bank-placeholder"
          >
            საბანკო რეკვიზიტები მალე დაემატება — ეს დროებითი მონაცემებია.
          </p>
        ) : null}
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-fg">მიმღები</dt>
            <dd className="text-right font-semibold text-ink">{BANK_DETAILS.recipientName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-fg">ბანკი</dt>
            <dd className="text-right font-semibold text-ink">{BANK_DETAILS.bankName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-fg">IBAN</dt>
            <dd className="text-right font-mono font-semibold text-ink">{BANK_DETAILS.iban}</dd>
          </div>
        </dl>
        {tier !== null ? (
          <p className="mt-3 text-sm text-ink">
            გადმორიცხე <strong className="font-serif">{tier} ₾</strong> ყოველთვიურად ამ ანგარიშზე და
            დანიშნულებაში მიუთითე შენი პირადი კოდი — ასე დავაკავშირებთ გადმორიცხვას შენს
            წევრობასთან.
          </p>
        ) : null}
      </div>
    </div>
  );
}
