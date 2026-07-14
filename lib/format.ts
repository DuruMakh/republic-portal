/**
 * Deterministic NBSP thousands grouping — Node and browser ICUs disagree on
 * ka-GE grouping, which broke SSR/client hydration of counters; counts here
 * are non-negative integers.
 */
export function formatCountKa(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
