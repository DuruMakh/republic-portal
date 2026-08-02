import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

export const inputClasses =
  "block w-full h-[38px] border-0 border-b border-ink bg-transparent px-0.5 font-serif text-[1.02rem] text-ink focus:border-b-2 focus:border-brand focus-visible:outline-none aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-brand";

export const adminControlClasses =
  "h-9 border-0 border-b border-ink bg-transparent px-0.5 text-[0.84rem] text-ink focus:border-b-2 focus:border-brand focus-visible:outline-none";

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
      <label
        htmlFor={id}
        className="block text-[0.74rem] font-bold tracking-[.08em] text-muted-fg mb-1"
      >
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} className={inputClasses} {...props} />
      {error ? <p className="mt-1 text-[0.74rem] text-brand">{error}</p> : null}
    </div>
  );
}

/**
 * Multi-line Field — mirrors Field's label/error contract exactly (same
 * classes), the way SelectField does. Exists because four surfaces had already
 * hand-rolled a textarea with Field's label markup copied inline; the support
 * page would have been the fifth. `h-auto resize-y py-2` is the one deviation
 * from `inputClasses` and lives here, once, instead of at each call site.
 */
export function TextareaField({
  label,
  error,
  id: idProp,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
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
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${inputClasses} h-auto resize-y py-2`}
        {...props}
      />
      {error ? <p className="mt-1 text-[0.74rem] text-brand">{error}</p> : null}
    </div>
  );
}
