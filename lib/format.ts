export function formatCountKa(n: number): string {
  return n.toLocaleString("ka-GE");
}

/** Prototype's generated bio line (pb_bioLine) for delegates without a stored bio. */
export function delegateBioFallback(regionNameKa: string): string {
  const genitive = regionNameKa.endsWith("ი") ? regionNameKa.slice(0, -1) + "ის" : regionNameKa + "ის";
  return `${genitive} რეგიონული დელეგატი. წარმოადგენს ადგილობრივი მოქალაქეების ხმას პლატფორმაზე, აშენებს გუნდს და ანგარიშვალდებულია საკუთარი მხარდამჭერების წინაშე.`;
}
