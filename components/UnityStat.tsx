/**
 * One „ერთობა“ figure under a 2px ink rule: a big serif number, a bold label and an optional
 * note. Goes inside a <dl>; the label is the term, the number and note describe it.
 */
export function UnityStat({
  value,
  label,
  sub,
  red = false,
  large = false,
}: {
  value: string;
  label: string;
  sub?: string;
  red?: boolean;
  /** The delegate profile's bigger figures. */
  large?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col border-t-2 border-ink pt-3.5 sm:pt-4">
      <dt className="order-2 mt-2.5 text-[15.5px] font-bold leading-[1.4]">{label}</dt>
      <dd
        className={`order-1 m-0 font-serif font-bold leading-[1.05] ${
          large ? "text-[40px] sm:text-[56px]" : "text-[38px] sm:text-[52px]"
        } ${red ? "text-brand" : "text-ink"}`}
      >
        {value}
      </dd>
      {sub ? <dd className="order-3 m-0 text-[14px] text-secondary">{sub}</dd> : null}
    </div>
  );
}
