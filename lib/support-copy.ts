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

export const SUPPORT_ADMIN_TAB_LABEL = "შეტყობინებები";
export const SUPPORT_ADMIN_EMPTY = "შეტყობინებები არ არის.";
