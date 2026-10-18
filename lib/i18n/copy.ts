import { useLocale } from "next-intl";
import { copyFor } from "./translate";

/** Fixed interface copy only; authored content is displayed in its original language. */
export function useCopy() {
  const locale = useLocale() === "en" ? "en" : "ka";
  return copyFor(locale);
}
