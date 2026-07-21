"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, inputClasses } from "@/components/Field";
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
}: {
  initial: { firstName: string; lastName: string };
  phone: string | null;
  personalIdMasked: string;
}) {
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
    <Card title="პირადი მონაცემები">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="სახელი"
            name="firstName"
            value={firstName}
            onChange={(e) => {
              touch();
              setFirstName(e.target.value);
            }}
          />
          <Field
            label="გვარი"
            name="lastName"
            value={lastName}
            onChange={(e) => {
              touch();
              setLastName(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">ტელეფონი</span>
            <input
              className={`${inputClasses} w-full border-line bg-surface`}
              value={formatPhoneKa(phone)}
              readOnly
              aria-label="ტელეფონი"
              data-testid="profile-phone"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">პირადი ნომერი</span>
            <input
              className={`${inputClasses} border-line bg-surface tracking-widest`}
              value={personalIdMasked}
              readOnly
              aria-label="პირადი ნომერი"
              data-testid="profile-pid"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? (
          <p className="text-sm font-semibold text-ok" data-testid="profile-saved">
            პროფილი განახლდა ✓
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            შენახვა
          </Button>
        </div>
      </div>
    </Card>
  );
}
