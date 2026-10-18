"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useId, useRef } from "react";

const LENGTH = 6;

export function OtpInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const t = useCopy();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const errorId = useId();
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-center gap-2.5 sm:gap-4" role="group" aria-label={t("SMS კოდი")}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`${t("ციფრი ")}${i + 1}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            data-testid={`otp-${i}`}
            className={`h-[58px] w-11 rounded-none border-0 border-b-2 p-0 sm:h-[68px] sm:w-14 ${
              error ? "border-brand" : digit ? "border-ink" : "border-[#a39684]"
            } bg-transparent text-center font-serif text-[30px] font-semibold text-ink focus:border-brand focus-visible:outline-none sm:text-[36px]`}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw.length > 1) {
                // paste: fill from this box onward
                const merged = (value.slice(0, i) + raw).slice(0, LENGTH);
                onChange(merged);
                refs.current[Math.min(merged.length, LENGTH - 1)]?.focus();
                return;
              }
              const next = digits.slice();
              next[i] = raw;
              onChange(next.join("").slice(0, LENGTH));
              if (raw && i < LENGTH - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digit && i > 0) refs.current[i - 1]?.focus();
            }}
          />
        ))}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 text-center text-[14px] font-semibold text-danger">
          {t(error ?? "")}
        </p>
      ) : null}
    </div>
  );
}
