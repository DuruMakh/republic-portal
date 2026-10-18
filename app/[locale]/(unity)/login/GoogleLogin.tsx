import { useCopy } from "@/lib/i18n/copy";
import { AuthEntryShell } from "@/components/AuthEntryShell";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { TestSignInPanel } from "@/components/TestSignInPanel";
import { testSignInAction } from "./test-sign-in-actions";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  oauth_callback: "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
  account_lookup: "მონაცემების წამოღება ვერ მოხერხდა — სცადეთ თავიდან.",
  test_sign_in: "სატესტო შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
};

export function GoogleLogin({
  error,
  nextPath = "/join",
  testSignIn = false,
}: {
  error?: string;
  nextPath?: string;
  testSignIn?: boolean;
}) {
  const t = useCopy();
  const errorMessage = error ? AUTH_ERROR_MESSAGES[error] : undefined;

  return (
    <AuthEntryShell
      eyebrow={t("პირადი კაბინეტი")}
      title={t("შესვლა")}
      intro={t("Google-ით შედიხარ უსაფრთხოდ და სწრაფად.")}
      asideTitle={t("პირველად ხარ?")}
      aside={
        <p>
          {t(
            "Google-ის შემდეგ მოკლე რეგისტრაციას დაასრულებ და ტელეფონის ნომერს მხოლოდ ერთხელ დაადასტურებ.",
          )}
        </p>
      }
    >
      <div className="flex flex-col gap-4">
        <GoogleAuthButton nextPath={nextPath} label={t("Google-ით შესვლა")} />
        {errorMessage ? (
          <p role="alert" className="text-[15px] font-semibold text-danger">
            {t(errorMessage ?? "")}
          </p>
        ) : null}
        {testSignIn ? <TestSignInPanel action={testSignInAction} /> : null}
      </div>
    </AuthEntryShell>
  );
}
