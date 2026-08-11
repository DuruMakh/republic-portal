const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f-\u009f]/;

function isSafeLocalPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !CONTROL_CHARACTER_RE.test(value)
  );
}

/** Accept only a same-origin path with exactly one leading slash. */
export function safeAuthNext(value: string | null | undefined): string {
  if (typeof value !== "string" || !isSafeLocalPath(value)) return "/";

  try {
    return isSafeLocalPath(decodeURIComponent(value)) ? value : "/";
  } catch {
    return "/";
  }
}
