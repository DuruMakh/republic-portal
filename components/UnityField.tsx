import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Caps } from "@/components/Caps";

/**
 * „ერთობა“ form fields: the same label/error contract as Field.tsx, drawn the way the owner's
 * redesign draws them. A small spaced Mtavruli label, a tall underline input, and a red underline
 * on focus or error. Field.tsx keeps the Kronika look for the screens not yet redesigned.
 */
const controlClasses =
  "block w-full min-w-0 rounded-none border-0 border-b border-ink bg-transparent p-0 font-sans text-[18px] text-ink transition-[border-color,box-shadow] placeholder:text-[#9a9082] placeholder:opacity-100 focus:border-brand focus:shadow-[0_1px_0_0_var(--color-brand)] focus-visible:outline-none aria-[invalid=true]:border-brand aria-[invalid=true]:shadow-[0_1px_0_0_var(--color-brand)] disabled:text-secondary";

function UnityLabel({ htmlFor, label, hint }: { htmlFor: string; label: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[12px] font-bold tracking-[.12em] text-secondary">
      <Caps>{label}</Caps>
      {hint ? <span className="font-semibold tracking-[.02em]"> {hint}</span> : null}
    </label>
  );
}

function UnityError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="mt-1 text-[14px] font-semibold text-brand">
      {error}
    </p>
  ) : null;
}

export function UnityField({
  label,
  hint,
  error,
  id: idProp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Lower-case aside after the label, e.g. „(არასავალდებულო)“. */
  hint?: string;
  error?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <UnityLabel htmlFor={id} label={label} hint={hint} />
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${controlClasses} h-[46px]`}
        {...props}
      />
      <UnityError id={errorId} error={error} />
    </div>
  );
}

export function UnityTextareaField({
  label,
  hint,
  error,
  id: idProp,
  footer,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** Small line under the box, e.g. a character counter. */
  footer?: ReactNode;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <UnityLabel htmlFor={id} label={label} hint={hint} />
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${controlClasses} resize-y py-2.5 leading-[1.6]`}
        {...props}
      />
      <UnityError id={errorId} error={error} />
      {footer}
    </div>
  );
}

/** Consent-style checkbox: the whole sentence is the label, beside a square ink box. */
export function UnityCheckboxField({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 text-[16px] leading-[1.6] text-ink">
      <input
        type="checkbox"
        className="mt-1 size-[22px] shrink-0 cursor-pointer accent-ink aria-[invalid=true]:outline aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-brand"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
