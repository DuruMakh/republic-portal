/**
 * Deterministic NBSP thousands grouping — Node and browser ICUs disagree on
 * ka-GE grouping, which broke SSR/client hydration of counters; counts here
 * are non-negative integers. Accepts null/undefined defensively, not just
 * number: a cabinet_state()/delegate_panel() RPC payload is read through an
 * `as unknown as` cast with no runtime validation, so against a database that
 * predates the migration adding referralCount, the field is genuinely
 * undefined at runtime despite its `number` type (fix-list round 2, Fix 2).
 * Every call site also defaults with `?? 0` of its own; this is a second,
 * independent guard so a future call site that forgets to default the count
 * still renders "0" instead of throwing .toString() on undefined.
 */
export function formatCountKa(n: number | null | undefined): string {
  return (n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Prototype's bio line for delegates without a stored bio, with a corrected
 * Georgian genitive: names ending in "ი" or "ა" drop that vowel before "ის".
 * (The prototype's pb_bioLine naively concatenated and produced wrong forms
 * like „თბილისიის".)
 */
export function delegateBioFallback(regionNameKa: string): string {
  const stem =
    regionNameKa.endsWith("ი") || regionNameKa.endsWith("ა")
      ? regionNameKa.slice(0, -1)
      : regionNameKa;
  return `${stem}ის რეგიონული დელეგატი. წარმოადგენს ადგილობრივი მოქალაქეების ხმას პლატფორმაზე, აშენებს გუნდს და ანგარიშვალდებულია საკუთარი მხარდამჭერების წინაშე.`;
}
