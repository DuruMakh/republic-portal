"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CabinetPanel, CabinetPanelTitle, CabinetReadonlyField } from "@/components/CabinetPage";
import { UnityField } from "@/components/UnityField";
import { UnityButton } from "@/components/UnityButton";
import { UnitySelectField } from "@/components/UnitySelectField";
import { EMPLOYMENT_OTHER, employmentToForm, formatPhoneKa, formToEmployment } from "@/lib/cabinet";
import { profileUpdateSchema } from "@/lib/cabinet-schemas";
import { GENERIC_FUNNEL_ERROR } from "@/lib/funnel";
import { EMPLOYMENT_PRESETS } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction } from "../actions";

interface CityOption {
  id: number;
  name_ka: string;
}

export function ProfileForm({
  initial,
  phone,
  regions,
  hasPersonalId,
}: {
  initial: {
    firstName: string;
    lastName: string;
    regionId: number | null;
    cityId: number | null;
    employment: string | null;
  };
  phone: string | null;
  regions: { id: number; name_ka: string }[];
  /** A registered person who hasn't reached the wizard has no ID yet — the masked
   * row would lie about a value that doesn't exist (owner fix #10). */
  hasPersonalId: boolean;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [regionId, setRegionId] = useState(initial.regionId ?? regions[0]?.id ?? 0);
  const [cityId, setCityId] = useState(initial.cityId ?? 0);
  const initialEmployment = employmentToForm(initial.employment);
  const [employmentChoice, setEmploymentChoice] = useState(initialEmployment.choice);
  const [employmentCustom, setEmploymentCustom] = useState(initialEmployment.custom);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void Promise.resolve(
      supabase.from("cities").select("id, name_ka").eq("region_id", regionId).order("name_ka"),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setError(GENERIC_FUNNEL_ERROR);
          return;
        }
        setError(undefined); // clear a prior transient cities-fetch error once it recovers
        setCities(data);
        setCityId((current) => (data.some((c) => c.id === current) ? current : (data[0]?.id ?? 0)));
      })
      .catch(() => {
        if (!cancelled) setError(GENERIC_FUNNEL_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  function touch() {
    setSaved(false);
  }

  async function save() {
    setError(undefined);
    setSaved(false);
    const parsed = profileUpdateSchema.safeParse({
      firstName,
      lastName,
      regionId,
      cityId,
      employment: formToEmployment({ choice: employmentChoice, custom: employmentCustom }),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? GENERIC_FUNNEL_ERROR);
      return;
    }
    setBusy(true);
    let result: Awaited<ReturnType<typeof updateProfileAction>>;
    try {
      result = await updateProfileAction(parsed.data);
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
    router.refresh(); // summary card re-renders with the new values
  }

  return (
    <CabinetPanel>
      <CabinetPanelTitle>პირადი მონაცემები</CabinetPanelTitle>
      <div className="mt-7 flex flex-col gap-7">
        <div className="grid gap-7 sm:grid-cols-2">
          <UnityField
            label="სახელი"
            name="firstName"
            value={firstName}
            onChange={(e) => {
              touch();
              setFirstName(e.target.value);
            }}
          />
          <UnityField
            label="გვარი"
            name="lastName"
            value={lastName}
            onChange={(e) => {
              touch();
              setLastName(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-7">
          <CabinetReadonlyField
            label="ტელეფონი"
            value={formatPhoneKa(phone)}
            testId="profile-phone"
            badge={
              <span className="whitespace-nowrap border border-ok/30 bg-ok/10 px-2 py-0.5 text-[12px] font-bold text-ok-deep">
                ✓ ვერიფიც.
              </span>
            }
            hint="ნომრის შესაცვლელად საჭიროა ხელახალი დადასტურება."
          />
          {hasPersonalId ? (
            <CabinetReadonlyField
              label="პირადი ნომერი"
              value="•••••••••••"
              testId="profile-pid"
              hint="ვერიფიცირებული · დაცული მონაცემი."
              spaced
            />
          ) : null}
        </div>
        <div className="grid gap-7 sm:grid-cols-2">
          <UnitySelectField
            label="მხარე"
            id="profile-region"
            value={regionId}
            onChange={(e) => {
              touch();
              setRegionId(Number(e.target.value));
            }}
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name_ka}
              </option>
            ))}
          </UnitySelectField>
          <UnitySelectField
            label="ქალაქი / მუნიციპალიტეტი"
            id="profile-city"
            value={cityId}
            onChange={(e) => {
              touch();
              setCityId(Number(e.target.value));
            }}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ka}
              </option>
            ))}
          </UnitySelectField>
        </div>
        <UnitySelectField
          label="სამუშაო ადგილი / სტატუსი"
          id="profile-employment"
          value={employmentChoice}
          onChange={(e) => {
            touch();
            setEmploymentChoice(e.target.value);
          }}
        >
          {EMPLOYMENT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={EMPLOYMENT_OTHER}>სხვა (მიუთითე)</option>
        </UnitySelectField>
        {employmentChoice === EMPLOYMENT_OTHER ? (
          <UnityField
            label="მიუთითე საქმიანობა"
            name="employmentCustom"
            value={employmentCustom}
            maxLength={100}
            onChange={(e) => {
              touch();
              setEmploymentCustom(e.target.value);
            }}
          />
        ) : null}
        {error ? <p className="m-0 text-[15px] text-danger">{error}</p> : null}
        {saved ? (
          <p className="m-0 text-[15px] font-bold text-ok-deep" data-testid="profile-saved">
            პროფილი განახლდა ✓
          </p>
        ) : null}
        <div className="flex justify-end">
          <UnityButton variant="ink" size="sm" onClick={save} disabled={busy}>
            შენახვა
          </UnityButton>
        </div>
      </div>
    </CabinetPanel>
  );
}
