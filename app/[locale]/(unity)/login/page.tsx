import type { Metadata } from "next";
import { testSignInEnabled } from "@/lib/env";
import { NOINDEX } from "@/lib/i18n/metadata";
import { getCopy } from "@/lib/i18n/server";
import { GoogleLogin } from "./GoogleLogin";
import { LegacyPhoneLogin } from "./LegacyPhoneLogin";

type LoginSearchParams = Record<string, string | string[] | undefined>;

/** The sign-in screen has nothing to find: named, but kept out of search results. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getCopy();
  return { title: t("შესვლა") + " — " + t("ქართული რესპუბლიკა"), robots: NOINDEX };
}

export default async function LoginPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<LoginSearchParams>;
}) {
  if (process.env.NEXT_PUBLIC_AUTH_MODE !== "google") return <LegacyPhoneLogin />;

  const { error, next } = await searchParams;
  return (
    <GoogleLogin
      error={typeof error === "string" ? error : undefined}
      nextPath={typeof next === "string" ? next : undefined}
      testSignIn={testSignInEnabled()}
    />
  );
}
