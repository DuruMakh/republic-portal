export function validatePersonalId(value: string): boolean {
  return /^\d{11}$/.test(value);
}

/**
 * Georgian mobile numbers: 9 digits starting with 5 (e.g. 5XX XXX XXX).
 * Accepts local, 995-prefixed, and +995-prefixed input with any spacing.
 * Returns E.164 (+9955XXXXXXXX) or null.
 */
export function normalizeGeorgianPhone(value: string): string | null {
  const digits = value.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  let national: string;
  if (digits.startsWith("995")) national = digits.slice(3);
  else national = digits;
  if (!/^5\d{8}$/.test(national)) return null;
  return `+995${national}`;
}
