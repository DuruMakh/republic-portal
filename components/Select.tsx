import { useId, type SelectHTMLAttributes } from "react";
import { adminControlClasses, inputClasses } from "@/components/Field";

/**
 * Kronika select (owner fix list #1): native <select> semantics (OS picker,
 * mobile wheels, full keyboard a11y) under the underline-field dress —
 * appearance-none removes the OS chrome, the ▾ glyph is ours. The OPEN option
 * list stays OS-native by design; revisit as a custom listbox only if the
 * owner still dislikes it on preview.
 */
export function Select({
  variant = "form",
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { variant?: "form" | "admin" }) {
  const base = variant === "admin" ? adminControlClasses : inputClasses;
  return (
    <span
      className={`relative ${variant === "admin" ? "inline-block" : "block w-full"} ${className}`}
    >
      <select {...props} className={`${base} w-full appearance-none pr-7`}>
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-[0.74rem] text-muted-fg"
      >
        ▾
      </span>
    </span>
  );
}

/** Labeled select — mirrors Field's label/error contract exactly (same classes). */
export function SelectField({
  label,
  error,
  id: idProp,
  variant,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  variant?: "form" | "admin";
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="block text-[0.74rem] font-bold tracking-[.08em] text-muted-fg mb-1"
      >
        {label}
      </label>
      <Select id={id} aria-invalid={error ? true : undefined} variant={variant} {...props}>
        {children}
      </Select>
      {error ? <p className="mt-1 text-[0.74rem] text-brand">{error}</p> : null}
    </div>
  );
}
