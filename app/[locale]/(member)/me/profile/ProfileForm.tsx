"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/navigation";
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
  const t = useCopy();
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
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"firstName" | "lastName" | "regionId" | "cityId" | "employment", string>>
  >({});
  const formRef = useRef<HTMLFormElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (!focusRequest) return;
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled), [data-form-error]')
      ?.focus();
  }, [focusRequest]);

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
      const next: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          key === "firstName" ||
          key === "lastName" ||
          key === "regionId" ||
          key === "cityId" ||
          key === "employment"
        )
          next[key] ??= issue.message;
      }
      setFieldErrors(next);
      setFocusRequest((n) => n + 1);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    let result: Awaited<ReturnType<typeof updateProfileAction>>;
    try {
      result = await updateProfileAction(parsed.data);
    } catch {
      setError(GENERIC_FUNNEL_ERROR);
      setFocusRequest((n) => n + 1);
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error);
      setFocusRequest((n) => n + 1);
      return;
    }
    setSaved(true);
    router.refresh(); // summary card re-renders with the new values
  }

  return (
    <CabinetPanel>
      <CabinetPanelTitle>{t("პირადი მონაცემები")}</CabinetPanelTitle>
      <form
        ref={formRef}
        className="mt-7 flex flex-col gap-7"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="grid gap-7 sm:grid-cols-2">
          <UnityField
            label={t("სახელი")}
            name="firstName"
            error={t(fieldErrors.firstName ?? "")}
            value={firstName}
            onChange={(e) => {
              touch();
              setFirstName(e.target.value);
            }}
          />
          <UnityField
            label={t("გვარი")}
            name="lastName"
            error={t(fieldErrors.lastName ?? "")}
            value={lastName}
            onChange={(e) => {
              touch();
              setLastName(e.target.value);
            }}
          />
        </div>
        <div className="grid gap-7">
          <CabinetReadonlyField
            label={t("ტელეფონი")}
            value={formatPhoneKa(phone)}
            testId="profile-phone"
            badge={
              <span className="whitespace-nowrap border border-ok/30 bg-ok/10 px-2 py-0.5 text-[12px] font-bold text-ok-deep">
                {t("✓ ვერიფიც.")}
              </span>
            }
            hint={t("ნომრის შესაცვლელად საჭიროა ხელახალი დადასტურება.")}
          />
          {hasPersonalId ? (
            <CabinetReadonlyField
              label={t("პირადი ნომერი")}
              value="•••••••••••"
              testId="profile-pid"
              hint={t("ვერიფიცირებული · დაცული მონაცემი.")}
              spaced
            />
          ) : null}
        </div>
        <div className="grid gap-7 sm:grid-cols-2">
          <UnitySelectField
            label={t("მხარე")}
            id="profile-region"
            error={t(fieldErrors.regionId ?? "")}
            value={regionId}
            onChange={(e) => {
              touch();
              setRegionId(Number(e.target.value));
            }}
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {t(r.name_ka)}
              </option>
            ))}
          </UnitySelectField>
          <UnitySelectField
            label={t("ქალაქი / მუნიციპალიტეტი")}
            id="profile-city"
            error={t(fieldErrors.cityId ?? "")}
            value={cityId}
            onChange={(e) => {
              touch();
              setCityId(Number(e.target.value));
            }}
          >
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.name_ka)}
              </option>
            ))}
          </UnitySelectField>
        </div>
        <UnitySelectField
          label={t("სამუშაო ადგილი / სტატუსი")}
          id="profile-employment"
          error={t(fieldErrors.employment ?? "")}
          value={employmentChoice}
          onChange={(e) => {
            touch();
            setEmploymentChoice(e.target.value);
          }}
        >
          {EMPLOYMENT_PRESETS.map((p) => (
            <option key={p} value={p}>
              {t(p)}
            </option>
          ))}
          <option value={EMPLOYMENT_OTHER}>{t("სხვა (მიუთითე)")}</option>
        </UnitySelectField>
        {employmentChoice === EMPLOYMENT_OTHER ? (
          <UnityField
            label={t("მიუთითე საქმიანობა")}
            name="employmentCustom"
            error={t(fieldErrors.employment ?? "")}
            value={employmentCustom}
            maxLength={100}
            onChange={(e) => {
              touch();
              setEmploymentCustom(e.target.value);
            }}
          />
        ) : null}
        {error ? (
          <p role="alert" data-form-error tabIndex={-1} className="m-0 text-[15px] text-danger">
            {t(error ?? "")}
          </p>
        ) : null}
        {saved ? (
          <p
            role="status"
            className="m-0 text-[15px] font-bold text-ok-deep"
            data-testid="profile-saved"
          >
            {t("პროფილი განახლდა ✓")}
          </p>
        ) : null}
        <div className="flex justify-end">
          <UnityButton type="submit" variant="ink" size="sm" disabled={busy}>
            {t("შენახვა")}
          </UnityButton>
        </div>
      </form>
    </CabinetPanel>
  );
}
