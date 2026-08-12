import { AuthEntryShell } from "@/components/AuthEntryShell";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  oauth_callback: "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
  account_lookup: "მონაცემების წამოღება ვერ მოხერხდა — სცადეთ თავიდან.",
};

export function GoogleLogin({ error }: { error?: string }) {
  const errorMessage = error ? AUTH_ERROR_MESSAGES[error] : undefined;

  return (
    <AuthEntryShell
      eyebrow="პირადი კაბინეტი"
      title="შესვლა"
      intro="Google-ით შედიხარ უსაფრთხოდ და სწრაფად."
      asideTitle="პირველად ხარ?"
      aside={
        <p>
          Google-ის შემდეგ მოკლე რეგისტრაციას დაასრულებ და ტელეფონის ნომერს მხოლოდ ერთხელ
          დაადასტურებ.
        </p>
      }
    >
      <div className="flex max-w-xl flex-col gap-4">
        <GoogleAuthButton nextPath="/join" label="Google-ით შესვლა" />
        {errorMessage ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </AuthEntryShell>
  );
}
