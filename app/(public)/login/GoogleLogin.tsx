import { GoogleAuthButton } from "@/components/GoogleAuthButton";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  oauth_callback: "Google-ით შესვლა ვერ მოხერხდა — სცადეთ თავიდან.",
  account_lookup: "მონაცემების წამოღება ვერ მოხერხდა — სცადეთ თავიდან.",
};

export function GoogleLogin({ error }: { error?: string }) {
  const errorMessage = error ? AUTH_ERROR_MESSAGES[error] : undefined;

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-3xl font-bold text-ink">შესვლა</h1>
      <div className="mt-8 bg-paper-bright border border-hairline p-8 sm:p-10 shadow-[0_1px_0_var(--color-hairline)]">
        <div className="flex flex-col gap-4">
          <GoogleAuthButton nextPath="/join" label="Google-ით შესვლა" />
          {errorMessage ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
