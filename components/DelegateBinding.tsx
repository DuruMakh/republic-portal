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
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink">აირჩიე შენი დელეგატი</p>
      <p className="mb-3 mt-1 text-sm text-muted-fg">
        დელეგატი წარადგენს შენს ხმას შენს მხარეში. ნებისმიერ დროს შეგიძლია შეცვალო.
      </p>
      {referral ? (
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 font-bold text-brand">
              {referral.fullName.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{referral.fullName}</p>
              <p className="text-sm text-muted-fg">{referral.regionNameKa}</p>
            </div>
            <Pill status="approved" />
          </div>
          <p className="mt-3 text-xs text-muted-fg">
            🔗 შენ შემოხვედი რეფერალური ბმულით — დელეგატი უკვე მინიჭებულია.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <select
            aria-label="დელეგატი"
            className={`${inputClasses} border-line bg-white`}
            value={value ?? "central"}
            onChange={(e) => onChange(e.target.value === "central" ? null : e.target.value)}
          >
            <option value="central">ცენტრალური მოძრაობა</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName} · {d.regionNameKa}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-fg">
            აჩვენება მხოლოდ არჩეული მხარის დამტკიცებული დელეგატები.
          </p>
        </div>
      )}
    </div>
  );
}
