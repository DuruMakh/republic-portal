"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { DelegateBinding, type DelegateOption } from "@/components/DelegateBinding";
import { Eyebrow } from "@/components/Eyebrow";
import { Field, inputClasses } from "@/components/Field";
import { Stepper } from "@/components/Stepper";
import { TierPicker } from "@/components/TierPicker";
import {
  deriveMembershipPhase,
  GENERIC_FUNNEL_ERROR,
  type CabinetStatePresent,
  type Tier,
} from "@/lib/funnel";
import { EMPLOYMENT_PRESETS, membershipProfileSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { completeMembershipAction, saveMembershipProfileAction } from "./actions";

const FIELD_KEYS = ["birthDate", "regionId", "cityId", "employment"] as const;
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

// The wizard only ever renders "profile" and "tier" — a completed member never
// reaches this component (the page gate redirects to /me/membership/done first).
type WizardPhase = "profile" | "tier";

export function MembershipWizard({ initialState }: { initialState: CabinetStatePresent }) {
  const router = useRouter();
  const [phase, setPhase] = useState<WizardPhase>(() =>
    deriveMembershipPhase(initialState) === "tier" ? "tier" : "profile",
  );

  // profile phase — ported from the old /join/step-2 (spec §4.3), minus personalId
  // and the delegate-role tcAccepted branch: this wizard only ever renders for
  // role === "member" (the page gate redirects role === "delegate" to /delegate).
  const referral = initialState.referral;
  const [regions, setRegions] = useState<{ id: number; name_ka: string }[]>([]);
  const [cities, setCities] = useState<{ id: number; name_ka: string }[]>([]);
  const [delegateOptions, setDelegateOptions] = useState<DelegateOption[]>([]);

  const [birthDate, setBirthDate] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [workPreset, setWorkPreset] = useState("");
  const [workFree, setWorkFree] = useState("");
  const [delegateId, setDelegateId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // tier phase — ported from the old /join/step-3.
  const [tier, setTier] = useState<Tier>(10);
  const [tierError, setTierError] = useState<string>();
  const [tierBusy, setTierBusy] = useState(false);

  // prefill once from the server-provided initial state (resume / back-navigation)
  useEffect(() => {
    if (initialized) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill from the server-provided initialState, gated by `initialized` so it never cascades
    setBirthDate(initialState.birthDate ?? "");
    setRegionId(initialState.regionId);
    setCityId(initialState.cityId);
    if (initialState.employment) {
      if ((EMPLOYMENT_PRESETS as readonly string[]).includes(initialState.employment)) {
        setWorkPreset(initialState.employment);
      } else {
        setWorkPreset("__other");
        setWorkFree(initialState.employment);
      }
    }
    const prefillDelegateId =
      initialState.pendingDelegate?.id ?? initialState.chosenDelegate?.id ?? null;
    if (prefillDelegateId) setDelegateId(prefillDelegateId);
    setInitialized(true);
  }, [initialized, initialState]);

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
    if (!referral) {
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
  }, [regionId, referral]);

  function changeRegion(value: string) {
    const next = value ? Number(value) : null;
    setRegionId(next);
    setCityId(null);
    if (!referral) setDelegateId(null);
  }

  async function submitProfile() {
    setFormError(undefined);
    const employment = workPreset === "__other" ? workFree : workPreset;
    const parsed = membershipProfileSchema.safeParse({
      birthDate,
      regionId: regionId ?? 0,
      cityId: cityId ?? 0,
      employment,
      delegateId,
    });
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
    let result: Awaited<ReturnType<typeof saveMembershipProfileAction>>;
    try {
      result = await saveMembershipProfileAction(parsed.data);
    } catch {
      setFormError(GENERIC_FUNNEL_ERROR);
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    // clears a stale error from an earlier failed completion attempt — this is
    // one persistent component, not a fresh page mount, so a prior tier-phase
    // failure would otherwise resurface on re-entry after a back-then-resave loop
    setTierError(undefined);
    setPhase("tier");
  }

  async function completeTier() {
    setTierError(undefined);
    setTierBusy(true);
    let result: Awaited<ReturnType<typeof completeMembershipAction>>;
    try {
      result = await completeMembershipAction({ tier });
    } catch {
      setTierError(GENERIC_FUNNEL_ERROR);
      return;
    } finally {
      setTierBusy(false);
    }
    if (!result.ok) {
      setTierError(result.error);
      return;
    }
    // done lives at /me/membership/done — both the client push and any
    // action-triggered server re-render land there deterministically
    router.push("/me/membership/done");
  }

  let phaseContent: ReactNode;
  if (phase === "profile") {
    phaseContent = (
      <>
        <h2 className="font-serif font-bold border-b-2 border-ink pb-2">იურიდიული პროფილი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          ეს მონაცემები საჭიროა წევრობის იურიდიული ვერიფიკაციისთვის. ინახება უსაფრთხოდ.
        </p>
        <div className="flex flex-col gap-4">
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
              id="mw-region"
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
              id="mw-city"
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
            id="mw-work"
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
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <Button onClick={submitProfile} disabled={busy} size="lg">
            გაგრძელება →
          </Button>
          <p className="text-center text-xs text-muted-fg">💾 მონაცემები ინახება ავტომატურად</p>
        </div>
      </>
    );
  } else {
    phaseContent = (
      <>
        <h2 className="font-serif font-bold border-b-2 border-ink pb-2">საწევრო შენატანი</h2>
        <p className="mb-5 mt-1 text-sm text-muted-fg">
          აირჩიე ყოველთვიური საწევრო. შენატანი ამყარებს მოძრაობის დამოუკიდებლობას.
        </p>
        <TierPicker value={tier} onChange={setTier} />
        {tierError ? <p className="mt-3 text-sm text-danger">{tierError}</p> : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button onClick={completeTier} disabled={tierBusy} size="lg">
            რეგისტრაციის დასრულება
          </Button>
          <p className="text-center text-xs text-muted-fg">
            გადახდა ხდება საბანკო გადარიცხვით — ბარათის მონაცემები არ გჭირდება.
          </p>
          <Button variant="ghost" onClick={() => setPhase("profile")} disabled={tierBusy}>
            ← პროფილის შესწორება
          </Button>
        </div>
      </>
    );
  }

  return (
    <main className="mx-auto max-w-xl">
      <div className="mb-6">
        <Eyebrow>წევრობის გაფორმება</Eyebrow>
      </div>
      <div className="mb-6 flex justify-center">
        <Stepper steps={["პროფილი", "საწევრო"]} current={phase === "profile" ? 1 : 2} />
      </div>
      <div className="bg-paper-bright border border-hairline p-8 sm:p-10 shadow-[0_1px_0_var(--color-hairline)]">
        {phaseContent}
      </div>
    </main>
  );
}
