"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { CabinetPanel, CabinetPanelTitle, CabinetReadonlyField } from "@/components/CabinetPage";
import { UnityField } from "@/components/UnityField";
import { UnityButton } from "@/components/UnityButton";
import { formatPhoneKa } from "@/lib/cabinet";
import { registeredNameUpdateSchema } from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { updateRegisteredNameAction } from "../actions";

/**
 * Registered-standing profile edit (spec §4.2): name only — phone and the
 * masked personal ID are server-managed, display-only. Region/city/
 * employment don't exist for this standing yet (collected in the Task 7
 * become-a-member wizard), so this is a separate small form rather than the
 * full ProfileForm with fields hidden.
 */
export function RegisteredProfileForm({
  initial,
  phone,
  personalIdMasked,
  hasPersonalId,
}: {
  initial: { firstName: string; lastName: string };
  phone: string | null;
  personalIdMasked: string;
  /** A registered person who hasn't reached the wizard has no ID yet — the masked
   * row would lie about a value that doesn't exist (owner fix #10). */
  hasPersonalId: boolean;
}) {
  const t = useCopy();
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function touch() {
    setSaved(false);
  }

  async function save() {
    setError(undefined);
    setSaved(false);
    const parsed = registeredNameUpdateSchema.safeParse({ firstName, lastName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR);
      return;
    }
    setBusy(true);
    let result: Awaited<ReturnType<typeof updateRegisteredNameAction>>;
    try {
      result = await updateRegisteredNameAction(parsed.data);
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh(); // summary card re-renders with the new name
  }

  return (
    <CabinetPanel>
      <CabinetPanelTitle>{t("პირადი მონაცემები")}</CabinetPanelTitle>
      <div className="mt-7 flex flex-col gap-7">
        <div className="grid gap-7 sm:grid-cols-2">
          <UnityField
            label={t("სახელი")}
            name="firstName"
            value={firstName}
            onChange={(e) => {
              touch();
              setFirstName(e.target.value);
            }}
          />
          <UnityField
            label={t("გვარი")}
            name="lastName"
            value={lastName}
            onChange={(e) => {
              touch();
              setLastName(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-7 sm:grid-cols-2">
          <CabinetReadonlyField
            label={t("ტელეფონი")}
            value={formatPhoneKa(phone)}
            testId="profile-phone"
          />
          {hasPersonalId ? (
            <CabinetReadonlyField
              label={t("პირადი ნომერი")}
              value={personalIdMasked}
              testId="profile-pid"
              spaced
            />
          ) : null}
        </div>
        {error ? <p className="m-0 text-[15px] text-danger">{t(error ?? "")}</p> : null}
        {saved ? (
          <p className="m-0 text-[15px] font-bold text-ok-deep" data-testid="profile-saved">
            {t("პროფილი განახლდა ✓")}
          </p>
        ) : null}
        <div className="flex justify-end">
          <UnityButton variant="ink" size="sm" onClick={save} disabled={busy}>
            {t("შენახვა")}
          </UnityButton>
        </div>
      </div>
    </CabinetPanel>
  );
}
