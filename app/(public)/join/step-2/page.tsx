"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DelegateBinding, type DelegateOption } from "@/components/DelegateBinding";
import { Field, inputClasses } from "@/components/Field";
import { Stepper } from "@/components/Stepper";
import { DUPLICATE_PERSONAL_ID_MESSAGE } from "@/lib/funnel";
import { EMPLOYMENT_PRESETS, profileActionSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { funnelSaveProfileAction } from "../actions";
import { useFunnelGuard } from "../useFunnelGuard";

const FIELD_KEYS = [
  "personalId",
  "birthDate",
  "regionId",
  "cityId",
  "employment",
  "tcAccepted",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(key: unknown): key is FieldKey {
  return typeof key === "string" && (FIELD_KEYS as readonly string[]).includes(key);
}

function LabeledSelect({
  label,
  id,
  value,
  onChange,
  error,
  children,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClasses} ${error ? "border-danger" : "border-line"} bg-white`}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export default function Step2Page() {
  const router = useRouter();
  const { state, ready } = useFunnelGuard("step-2");

  const [regions, setRegions] = useState<{ id: number; name_ka: string }[]>([]);
  const [cities, setCities] = useState<{ id: number; name_ka: string }[]>([]);
  const [delegateOptions, setDelegateOptions] = useState<DelegateOption[]>([]);

  const [personalId, setPersonalId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [workPreset, setWorkPreset] = useState("");
  const [workFree, setWorkFree] = useState("");
  const [delegateId, setDelegateId] = useState<string | null>(null);
  const [tcAccepted, setTcAccepted] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const role = state?.role ?? "member";
  const referral = state?.referral ?? null;

  // prefill once from server state (resume / back-navigation)
  useEffect(() => {
    if (!ready || !state || initialized) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from server state, gated by `initialized` so it never cascades
    setBirthDate(state.birthDate ?? "");
    setRegionId(state.regionId);
    setCityId(state.cityId);
    if (state.employment) {
      if ((EMPLOYMENT_PRESETS as readonly string[]).includes(state.employment)) {
        setWorkPreset(state.employment);
      } else {
        setWorkPreset("__other");
        setWorkFree(state.employment);
      }
    }
    if (state.chosenDelegate) setDelegateId(state.chosenDelegate.id);
    setInitialized(true);
  }, [ready, state, initialized]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("regions")
      .select("id, name_ka")
      .order("id")
      .then(({ data }) => setRegions(data ?? []));
  }, []);

  useEffect(() => {
    if (regionId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting dependent selects when the region is cleared, not a cascading loop
      setCities([]);
      setDelegateOptions([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("cities")
      .select("id, name_ka")
      .eq("region_id", regionId)
      .order("name_ka")
      .then(({ data }) => setCities(data ?? []));
    if (role === "member" && !referral) {
      void supabase
        .from("public_delegates")
        .select("id, first_name, last_name, region_name_ka")
        .eq("region_id", regionId)
        .order("active_supporters", { ascending: false })
        .then(({ data }) =>
          setDelegateOptions(
            (data ?? []).map((d) => ({
              id: d.id as string,
              fullName: `${d.first_name} ${d.last_name}`,
              regionNameKa: (d.region_name_ka as string | null) ?? "",
            })),
          ),
        );
    }
  }, [regionId, role, referral]);

  function changeRegion(value: string) {
    const next = value ? Number(value) : null;
    setRegionId(next);
    setCityId(null);
    if (role === "member" && !referral) setDelegateId(null);
  }

  async function submit() {
    setFormError(undefined);
    const employment = workPreset === "__other" ? workFree : workPreset;
    const common = {
      personalId: personalId.replace(/\D/g, ""),
      birthDate,
      regionId: regionId ?? 0,
      cityId: cityId ?? 0,
      employment,
    };
    const input =
      role === "delegate"
        ? { role: "delegate" as const, ...common, tcAccepted: tcAccepted as true }
        : { role: "member" as const, ...common, delegateId };
    const parsed = profileActionSchema.safeParse(input);
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      let unmapped: string | undefined;
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (isFieldKey(key)) {
          next[key] = issue.message;
        } else {
          // e.g. delegateId — no field renders it, so surface via the form-level error
          unmapped ??= issue.message;
        }
      }
      setErrors(next);
      if (unmapped !== undefined) setFormError(unmapped);
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await funnelSaveProfileAction(parsed.data);
    setBusy(false);
    if (!result.ok) {
      if (result.error === DUPLICATE_PERSONAL_ID_MESSAGE) {
        setErrors({ personalId: result.error });
      } else {
        setFormError(result.error);
      }
      return;
    }
    router.push("/join/step-3");
  }

  if (!ready || !state) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-8">
      <div className="mb-6 flex justify-center">
        <Stepper current={2} />
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">
          {role === "delegate" ? "დელეგატის რეგისტრაცია" : "წევრის რეგისტრაცია"}
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink">იურიდიული პროფილი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          ეს მონაცემები საჭიროა წევრობის იურიდიული ვერიფიკაციისთვის. ინახება უსაფრთხოდ.
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Field
              label="პირადი ნომერი"
              name="personalId"
              inputMode="numeric"
              maxLength={11}
              placeholder="01001000000"
              value={personalId}
              onChange={(e) => setPersonalId(e.target.value)}
              error={errors.personalId}
            />
            <p className="text-xs text-muted-fg">11 ნიშნა</p>
          </div>
          <Field
            label="დაბადების თარიღი"
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            error={errors.birthDate}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <LabeledSelect
              label="მხარე"
              id="jn-region"
              value={regionId === null ? "" : String(regionId)}
              onChange={changeRegion}
              error={errors.regionId}
            >
              <option value="" disabled>
                აირჩიე მხარე
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_ka}
                </option>
              ))}
            </LabeledSelect>
            <LabeledSelect
              label="ქალაქი / მუნიციპალიტეტი"
              id="jn-city"
              value={cityId === null ? "" : String(cityId)}
              onChange={(v) => setCityId(v ? Number(v) : null)}
              error={errors.cityId}
            >
              <option value="" disabled>
                {regionId === null ? "ჯერ აირჩიე მხარე" : "აირჩიე ქალაქი"}
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ka}
                </option>
              ))}
            </LabeledSelect>
          </div>
          <LabeledSelect
            label="სამუშაო ადგილი / სტატუსი"
            id="jn-work"
            value={workPreset}
            onChange={setWorkPreset}
            error={errors.employment}
          >
            <option value="" disabled>
              აირჩიე სტატუსი
            </option>
            {EMPLOYMENT_PRESETS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
            <option value="__other">სხვა (მიუთითე)</option>
          </LabeledSelect>
          {workPreset === "__other" ? (
            <Field
              label="მიუთითე შენი საქმიანობა"
              name="workFree"
              placeholder="მაგ. არქიტექტორი, ფერმერი, IT სპეციალისტი..."
              value={workFree}
              onChange={(e) => setWorkFree(e.target.value)}
              error={errors.employment}
            />
          ) : null}
          {role === "member" ? (
            <DelegateBinding
              referral={
                referral
                  ? {
                      fullName: `${referral.firstName} ${referral.lastName}`,
                      regionNameKa: referral.regionNameKa,
                    }
                  : null
              }
              options={delegateOptions}
              value={delegateId}
              onChange={setDelegateId}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={tcAccepted}
                  onChange={(e) => setTcAccepted(e.target.checked)}
                />
                <span>
                  ვეცნობი და ვეთანხმები დელეგატად ყოფნის{" "}
                  <a
                    href="/join/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand underline underline-offset-2"
                  >
                    წესებსა და პირობებს
                  </a>
                  . ვადასტურებ, რომ მოწოდებული მონაცემები ნამდვილია.
                </span>
              </label>
              {errors.tcAccepted ? <p className="text-xs text-danger">{errors.tcAccepted}</p> : null}
            </div>
          )}
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button onClick={submit} disabled={busy} size="lg">
            გაგრძელება →
          </Button>
          <p className="text-center text-xs text-muted-fg">💾 მონაცემები ინახება ავტომატურად</p>
        </div>
      </Card>
    </main>
  );
}
