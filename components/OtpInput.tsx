"use client";

import { useRef } from "react";

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
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-center gap-2" role="group" aria-label="SMS კოდი">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`ციფრი ${i + 1}`}
            data-testid={`otp-${i}`}
            className={`h-14 w-11 rounded-lg border text-center text-2xl font-extrabold outline-none focus:border-brand ${
              error ? "border-danger" : "border-line"
            }`}
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
      {error ? <p className="text-center text-xs text-danger">{error}</p> : null}
    </div>
  );
}
