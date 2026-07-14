import { useId, type InputHTMLAttributes } from "react";

export const inputClasses =
  "rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-brand";

export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${inputClasses} ${error ? "border-danger" : "border-line"}`}
        {...props}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
