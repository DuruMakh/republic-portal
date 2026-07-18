/**
 * News/event body format (spec decision #12): plain text; a blank line starts a
 * new paragraph; http(s) URLs become links. No HTML is ever stored or parsed —
 * the renderer builds React elements, so the XSS surface is zero by construction.
 */
export type BodySpan = { type: "text"; text: string } | { type: "link"; href: string };
export type BodyParagraph = BodySpan[];

const URL_RE = /https?:\/\/\S+/g;
// Punctuation that ends a sentence around a URL, not the URL itself. Includes
// Georgian typographic quotes „ " " and closing brackets.
const TRAILING_PUNCT_RE = /[.,;:!?)\]}»'"„""]+$/;

function paragraphSpans(text: string): BodyParagraph {
  const spans: BodySpan[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const href = match[0].replace(TRAILING_PUNCT_RE, "");
    if (start > last) spans.push({ type: "text", text: text.slice(last, start) });
    spans.push({ type: "link", href });
    last = start + href.length;
  }
  if (last < text.length) spans.push({ type: "text", text: text.slice(last) });
  return spans;
}

export function parseBody(body: string): BodyParagraph[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n/g, " ").trim())
    .filter((block) => block.length > 0)
    .map(paragraphSpans);
}

/** First paragraph as plain text, word-boundary-trimmed to `max`, for cards + OG. */
export function excerpt(body: string, max = 160): string {
  const first = parseBody(body)[0] ?? [];
  const text = first
    .map((span) => (span.type === "text" ? span.text : span.href))
    .join("")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // fall back to the hard cut when the first "word" alone exceeds half the budget
  const head = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${head.trimEnd()}…`;
}
