import { useId, type InputHTMLAttributes } from "react";

export const inputClasses = "rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-brand";

/** Admin dense register (DESIGN.md Phase 4): shared by every admin form control. */
export const adminControlClasses =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm font-normal";

export function Field({
  label,
  error,
  id: idProp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const autoId = useId();
  const id = idProp ?? autoId;
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
