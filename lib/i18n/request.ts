import { getRequestConfig } from "next-intl/server";
import * as rootParams from "next/root-params";
import { isLocale } from "./routing";

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const locale = explicitLocale ?? (await rootParams.locale());
  return { locale: isLocale(locale) ? locale : "ka", messages: {}, timeZone: "Asia/Tbilisi" };
});
