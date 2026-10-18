"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { OtpVerification } from "@/components/OtpVerification";
import { deriveDestination } from "@/lib/cabinet";
import type { CabinetState } from "@/lib/funnel";
import { createClient } from "@/lib/supabase/client";
import { normalizeGeorgianPhone } from "@/lib/validation";

export function LegacyPhoneLogin() {
  const t = useCopy();
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [routeError, setRouteError] = useState<string>();

  async function requestOtp() {
    setError(undefined);
    const normalized = normalizeGeorgianPhone(phoneInput);
    if (!normalized) {
      setError("შეიყვანეთ ქართული მობილურის ნომერი (5XX XX XX XX)");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (err) {
      setError("კოდის გაგზავნა ვერ მოხერხდა, სცადეთ თავიდან");
      return;
    }
    setPhone(normalized);
    setPhase("otp");
  }

  async function routeByCabinetState() {
    // Post-verify landing (spec §3.8): the derived destination. A lapsed lookup
    // must NOT bounce an existing member to /join (R2 §7c) — surface it instead;
    // deriveDestination handles the legitimate no-profile case via exists:false.
    setRouteError(undefined);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("cabinet_state");
    if (rpcError || data === null) {
      setRouteError("მონაცემების წამოღება ვერ მოხერხდა — სცადე თავიდან.");
      return;
    }
    router.replace(deriveDestination(data as unknown as CabinetState));
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-3xl font-bold text-ink">{t("შესვლა")}</h1>
      <div className="mt-8 bg-paper-bright border border-hairline p-8 sm:p-10 shadow-[0_1px_0_var(--color-hairline)]">
        {phase === "phone" ? (
          <div className="flex flex-col gap-4">
            <Field
              label={t("ტელეფონის ნომერი")}
              name="phone"
              placeholder="5XX XX XX XX"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              error={t(error ?? "")}
            />
            <Button onClick={requestOtp} disabled={busy}>
              {t("კოდის მიღება")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <OtpVerification phone={phone} onVerified={routeByCabinetState} />
            {routeError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm font-semibold text-danger">{t(routeError)}</p>
                {/* retry ONLY the lookup: the session already exists and the SMS
                    token is single-use — re-verifying it can only fail */}
                <Button variant="ghost" size="sm" onClick={routeByCabinetState}>
                  {t("სცადე თავიდან")}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
