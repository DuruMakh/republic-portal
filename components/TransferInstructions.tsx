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
    <div className="mt-6 flex flex-col gap-4 text-left">
      <div className="rounded-xl border border-line bg-surface p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-fg">შენი პირადი კოდი</p>
        <p
          className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-brand"
          data-testid="reference-code"
        >
          {referenceCode}
        </p>
        <p className="mt-1 text-xs text-muted-fg">
          მიუთითე ეს კოდი ყველა გადარიცხვის დანიშნულებაში.
        </p>
      </div>
      <div className="rounded-xl border border-line p-4">
        {BANK_DETAILS.placeholder ? (
          <p
            className="mb-3 rounded-lg bg-warn/10 p-2 text-xs font-semibold text-warn"
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
            გადმორიცხე <strong>{tier} ₾</strong> ყოველთვიურად ამ ანგარიშზე და დანიშნულებაში მიუთითე
            შენი პირადი კოდი — ასე დავაკავშირებთ გადმორიცხვას შენს წევრობასთან.
          </p>
        ) : null}
      </div>
    </div>
  );
}
