import { useLocale } from "next-intl";

/** Published text and scans retain their original language in the English interface. */
export function OriginalLanguageNote({
  document = false,
  className = "mt-2 block text-[13px] leading-[1.5] text-secondary",
}: {
  document?: boolean;
  className?: string;
}) {
  if (useLocale() !== "en") return null;
  return (
    <span lang="en" className={className}>
      {document ? "Original document in Georgian." : "This content is available in Georgian."}
    </span>
  );
}
