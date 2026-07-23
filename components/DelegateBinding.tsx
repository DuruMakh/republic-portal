"use client";

import { inputClasses } from "@/components/Field";
import { Pill } from "@/components/Pill";

export interface DelegateOption {
  id: string;
  fullName: string;
  regionNameKa: string;
}

export function DelegateBinding({
  referral,
  options,
  value,
  onChange,
}: {
  referral: { fullName: string; regionNameKa: string } | null;
  options: DelegateOption[];
  value: string | null; // delegate id; null = ცენტრალური მოძრაობა
  onChange: (id: string | null) => void;
}) {
  return (
    <div>
      <p className="text-[0.74rem] font-bold uppercase tracking-[.08em] text-muted-fg">
        აირჩიე შენი დელეგატი
      </p>
      <p className="mb-3 mt-1 text-sm text-muted-fg">
        დელეგატი წარადგენს შენს ხმას შენს მხარეში. ნებისმიერ დროს შეგიძლია შეცვალო.
      </p>
      {referral ? (
        <div>
          <div className="flex items-baseline gap-3 border-b border-hairline py-3">
            <span aria-hidden className="font-bold text-brand">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif font-bold text-ink">{referral.fullName}</p>
              <p className="text-[0.74rem] text-muted-fg">{referral.regionNameKa}</p>
            </div>
            <Pill status="approved" />
          </div>
          <p className="mt-3 text-[0.74rem] text-muted-fg">
            🔗 შენ შემოხვედი რეფერალური ბმულით — დელეგატი უკვე მინიჭებულია.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <select
            aria-label="დელეგატი"
            className={inputClasses}
            value={value ?? "central"}
            onChange={(e) => onChange(e.target.value === "central" ? null : e.target.value)}
          >
            <option value="central" className="font-serif">
              ცენტრალური მოძრაობა
            </option>
            {options.map((d) => (
              <option key={d.id} value={d.id} className="font-serif">
                {d.fullName} · {d.regionNameKa}
              </option>
            ))}
          </select>
          <p className="text-[0.74rem] text-muted-fg">
            აჩვენება მხოლოდ არჩეული მხარის დამტკიცებული დელეგატები.
          </p>
        </div>
      )}
    </div>
  );
}
