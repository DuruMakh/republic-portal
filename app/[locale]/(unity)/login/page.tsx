import { testSignInEnabled } from "@/lib/env";
import { GoogleLogin } from "./GoogleLogin";
import { LegacyPhoneLogin } from "./LegacyPhoneLogin";

type LoginSearchParams = Record<string, string | string[] | undefined>;

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
