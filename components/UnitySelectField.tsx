import { useId, type SelectHTMLAttributes } from "react";
import { Caps } from "@/components/Caps";

/**
 * The „ერთობა“ dropdown, UnityField's twin: SelectField's props, a small spaced Mtavruli label,
 * a tall underline native <select> (OS picker, keyboard, phone wheels) with a thin chevron, and a
 * red underline on focus or error.
 */
export function UnitySelectField({
  label,
  error,
  id: idProp,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[12px] font-bold tracking-[.12em] text-secondary">
        <Caps>{label}</Caps>
      </label>
      <span className="relative block">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="block h-[46px] w-full min-w-0 appearance-none rounded-none border-0 border-b border-ink bg-transparent py-0 pl-0 pr-7 font-sans text-[18px] text-ink transition-[border-color,box-shadow] focus:border-brand focus:shadow-[0_1px_0_0_var(--color-brand)] focus-visible:outline-none disabled:text-secondary aria-[invalid=true]:border-brand aria-[invalid=true]:shadow-[0_1px_0_0_var(--color-brand)]"
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          width="12"
          height="8"
          viewBox="0 0 12 8"
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2"
        >
          <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </span>
      {error ? (
        <p id={errorId} className="mt-1 text-[14px] font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
