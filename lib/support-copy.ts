/**
 * Every Georgian string on the support page, in one module.
 *
 * Concentrating them here is deliberate: DESIGN.md's integrity gate exists
 * because models silently normalize quotes and can fuse Latin homoglyphs into
 * Georgian words, and this page carries the first genuinely new Georgian prose
 * written in this repo rather than carried in from the prototype. One file
 * means one small surface for ka-gate and scripts/mixed-script-scan.mjs.
 * Provenance per string is recorded in the plan's copy table and spec §3.
 *
 * Register is informal singular throughout, matching the shipped public voice
 * („დარეგისტრირდი“, „აირჩიე ის შენს დელეგატად“) — owner decision, 2026-08-02.
 */
/** Spliced from app/(public)/events/page.tsx:21 — the shared public eyebrow. */
export const SUPPORT_EYEBROW = "ქართული რესპუბლიკა";
export const SUPPORT_HEADING = "დაგვიკავშირდი";
export const SUPPORT_LEDE = "მოგვწერე — ყველა შეტყობინებას ვკითხულობთ და გიპასუხებთ.";
export const SUPPORT_NAME_LABEL = "სახელი";
export const SUPPORT_EMAIL_LABEL = "ელ-ფოსტა (არასავალდებულო)";
export const SUPPORT_PHONE_LABEL = "ტელეფონი (არასავალდებულო)";
export const SUPPORT_MESSAGE_LABEL = "შეტყობინება";
export const SUPPORT_SUBMIT_LABEL = "გაგზავნა";
export const SUPPORT_SUCCESS = "შეტყობინება გაიგზავნა. მალე გიპასუხებთ.";
export const SUPPORT_FAILURE = "შეტყობინების გაგზავნა ვერ მოხერხდა, სცადე თავიდან.";
export const SUPPORT_NEED_CONTACT = "მიუთითე ელ-ფოსტა ან ტელეფონი.";
export const SUPPORT_RATE_LIMITED = "ბევრი შეტყობინება გაიგზავნა — სცადე ცოტა ხნის შემდეგ.";
export const SUPPORT_FOOTER_LABEL = "დაგვიკავშირდი";

export const SUPPORT_EMAIL_INVALID = "ელ-ფოსტის ფორმატი არასწორია.";
export const SUPPORT_FILL_FIELD = "შეავსე ეს ველი";
export const SUPPORT_MAX_60 = "მაქსიმუმ 60 სიმბოლო";
export const SUPPORT_MAX_120 = "მაქსიმუმ 120 სიმბოლო";
export const SUPPORT_MAX_40 = "მაქსიმუმ 40 სიმბოლო";
export const SUPPORT_MIN_10 = "სულ მცირე 10 სიმბოლო";
export const SUPPORT_MAX_2000 = "მაქსიმუმ 2000 სიმბოლო";

/**
 * Shown when a value is missing or is not text at all. zod's own message for
 * that case is English („Expected string, received null“, „Required“) and the
 * server action takes `unknown` from a public endpoint, so without this a
 * hand-crafted request renders English on a Georgian-only site.
 */
export const SUPPORT_INVALID_INPUT = "მონაცემები არასწორია.";

export const SUPPORT_ADMIN_TAB_LABEL = "შეტყობინებები";
export const SUPPORT_ADMIN_EMPTY = "შეტყობინებები არ არის.";

/**
 * Column headings for the admin inbox. Deliberately NOT the form's field
 * labels: those carry „(არასავალდებულო)“ to tell a visitor the field may be
 * left blank, which is meaningless above data that has already been sent.
 */
export const SUPPORT_ADMIN_EMAIL_HEADING = "ელ-ფოსტა";
export const SUPPORT_ADMIN_PHONE_HEADING = "ტელეფონი";

/**
 * Pager labels, spliced byte-for-byte from app/(admin)/admin/audit/page.tsx.
 * Duplicated rather than shared because every admin list currently inlines its
 * own pair; a shared pager vocabulary is the deeper fix and would touch four
 * unrelated pages, so it is left for a task that owns them.
 */
export const SUPPORT_ADMIN_PREV = "← წინა";
export const SUPPORT_ADMIN_NEXT = "შემდეგი →";
