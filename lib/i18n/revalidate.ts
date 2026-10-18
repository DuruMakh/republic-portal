import { revalidatePath as invalidate } from "next/cache";
import { stripLocale } from "./routing";

/** A publication/account change refreshes both public URL variants and the internal ka route. */
export function revalidatePath(path: string, type?: "page" | "layout") {
  const original = stripLocale(path);
  const suffix = original === "/" ? "" : original;
  const paths = [original, `/ka${suffix}`];
  if (!/^\/admin(?:\/|$)/.test(original)) paths.push(`/en${suffix}`);
  for (const target of paths) {
    if (type === undefined) invalidate(target);
    else invalidate(target, type);
  }
}
