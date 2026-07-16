"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, inputClasses } from "@/components/Field";
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
      supabase.from("cities").select("id, name_ka").eq("region_id", regionId).order("id"),
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
            <div className="flex items-center gap-2">
              <input
                className={`${inputClasses} w-full border-line bg-surface`}
                value={formatPhoneKa(phone)}
                readOnly
                aria-label="ტელეფონი"
                data-testid="profile-phone"
              />
              <span className="whitespace-nowrap rounded-full bg-ok/10 px-2 py-1 text-xs font-semibold text-ok">
                ✓ ვერიფიც.
              </span>
            </div>
            <p className="text-xs text-muted-fg">
              ნომრის შესაცვლელად საჭიროა ხელახალი დადასტურება.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">პირადი ნომერი</span>
            <input
              className={`${inputClasses} border-line bg-surface tracking-widest`}
              value="•••••••••••"
              readOnly
              aria-label="პირადი ნომერი"
              data-testid="profile-pid"
            />
            <p className="text-xs text-muted-fg">ვერიფიცირებული · დაცული მონაცემი.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-region" className="text-sm font-semibold text-ink">
              მხარე
            </label>
            <select
              id="profile-region"
              className={`${inputClasses} border-line`}
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
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-city" className="text-sm font-semibold text-ink">
              ქალაქი / მუნიციპალიტეტი
            </label>
            <select
              id="profile-city"
              className={`${inputClasses} border-line`}
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
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-employment" className="text-sm font-semibold text-ink">
            სამუშაო ადგილი / სტატუსი
          </label>
          <select
            id="profile-employment"
            className={`${inputClasses} border-line`}
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
          </select>
          {employmentChoice === EMPLOYMENT_OTHER ? (
            <Field
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
