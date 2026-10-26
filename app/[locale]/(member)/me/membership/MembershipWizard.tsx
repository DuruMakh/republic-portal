"use client";
import { useCopy } from "@/lib/i18n/copy";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { CabinetPage, CabinetPanel, CabinetPerks } from "@/components/CabinetPage";
import { DelegateBinding, type DelegateOption } from "@/components/DelegateBinding";
import { UnityCheckboxField, UnityField } from "@/components/UnityField";
import { UnitySelectField } from "@/components/UnitySelectField";
import { Stepper } from "@/components/Stepper";
import { UnityButton } from "@/components/UnityButton";
import { UnityKicker } from "@/components/UnityKicker";
import { MEMBERSHIP_PERKS } from "@/lib/cabinet";
import {
  deriveMembershipPhase,
  DUPLICATE_PERSONAL_ID_MESSAGE,
  GENERIC_FUNNEL_ERROR,
  MEMBERSHIP_FEE_GEL,
  type CabinetStatePresent,
  type Tier,
} from "@/lib/funnel";
import { EMPLOYMENT_PRESETS, membershipProfileSchema } from "@/lib/funnel-schemas";
import { createClient } from "@/lib/supabase/client";
import { completeMembershipAction, saveMembershipProfileAction } from "./actions";

const FIELD_KEYS = ["personalId", "birthDate", "regionId", "cityId", "employment"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

function isFieldKey(key: unknown): key is FieldKey {
  return typeof key === "string" && (FIELD_KEYS as readonly string[]).includes(key);
}

// The wizard only ever renders "profile" and "tier" — a completed member never
// reaches this component (the page gate redirects to /me/membership/done first).
type WizardPhase = "profile" | "tier";
type ReadStatus = "idle" | "loading" | "ready" | "error";

const CONSENT_REQUIRED_MESSAGE = "გასაგზავნად მონიშნე ორივე თანხმობა.";

const NEXT_STEPS = [
  "შენს განაცხადს განიხილავს ბორდი",
  "დადასტურების შემდეგ ხდები მოძრაობის წევრი",
] as const;

export function MembershipWizard({ initialState }: { initialState: CabinetStatePresent }) {
  const t = useCopy();
  const router = useRouter();
  const [phase, setPhase] = useState<WizardPhase>(() =>
    deriveMembershipPhase(initialState) === "tier" ? "tier" : "profile",
  );

  // profile phase — ported from the old /join/step-2 (spec §4.3), minus the
  // delegate-role tcAccepted branch: this wizard only ever renders for
  // role === "member" (the page gate redirects role === "delegate" to /delegate).
  const referral = initialState.referral;
  // Owner fix #10: the ID moved here from /join. Rendered only while NOT yet
  // captured. Review finding F2: this used to read `!initialState.hasPersonalId`
  // directly — a one-time snapshot that never refreshed. After a successful save
  // captured the ID server-side, "← მონაცემების შესწორება" re-rendered the now-stale
  // editable field, and resubmitting it sent a value the server's immutable-once-
  // set coalesce silently discarded. Tracking capture in state lets a successful
  // save flip it immediately, independent of phase navigation.
  const [idCaptured, setIdCaptured] = useState(initialState.hasPersonalId);
  const askPersonalId = !idCaptured;
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
  const [initialized, setInitialized] = useState(false);
  const [regionsStatus, setRegionsStatus] = useState<ReadStatus>("loading");
  const [citiesStatus, setCitiesStatus] = useState<ReadStatus>("idle");
  const [delegatesStatus, setDelegatesStatus] = useState<ReadStatus>("idle");
  const [regionsRetry, setRegionsRetry] = useState(0);
  const [citiesRetry, setCitiesRetry] = useState(0);
  const [delegatesRetry, setDelegatesRetry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPhase = useRef(phase);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => {
    if (previousPhase.current !== phase) headingRef.current?.focus();
    previousPhase.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!focusRequest) return;
    const target =
      formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"]:not(:disabled), [data-form-error]',
      ) ?? formRef.current?.querySelector<HTMLElement>("[data-regions-feedback]");
    target?.focus();
  }, [focusRequest]);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // tier phase — ported from the old /join/step-3. Fixed fee (owner fix #9): no
  // more choice, so this is a plain constant rather than state.
  const tier: Tier = MEMBERSHIP_FEE_GEL;
  const [tierError, setTierError] = useState<string>();
  const [tierBusy, setTierBusy] = useState(false);
  // ADR-036: the step is an application the board reviews. Both consents are
  // required, so sending the application is itself the consent; there is no column
  // to record an unticked optional box, by owner decision (text-only change).
  const [dataConsent, setDataConsent] = useState(false);
  const [duesConsent, setDuesConsent] = useState(false);

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
    let cancelled = false;
    const supabase = createClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- each explicit retry starts one read
    setRegionsStatus("loading");
    void Promise.resolve(supabase.from("regions").select("id, name_ka").order("id"))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setRegionsStatus("error");
          return;
        }
        setRegions(data);
        setRegionsStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setRegionsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [regionsRetry]);

  useEffect(() => {
    if (regionId === null) return;
    let cancelled = false;
    const supabase = createClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read per selected region or explicit retry
    setCitiesStatus("loading");
    void Promise.resolve(
      supabase.from("cities").select("id, name_ka").eq("region_id", regionId).order("name_ka"),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setCitiesStatus("error");
          return;
        }
        setCities(data);
        setCityId((current) => (data.some((city) => city.id === current) ? current : null));
        setCitiesStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setCitiesStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [regionId, citiesRetry]);

  useEffect(() => {
    if (regionId === null || referral) return;
    let cancelled = false;
    const supabase = createClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read per selected region or explicit retry
    setDelegatesStatus("loading");
    void Promise.resolve(
      supabase
        .from("public_delegates")
        .select("id, first_name, last_name, region_name_ka")
        .eq("region_id", regionId)
        .order("active_supporters", { ascending: false }),
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setDelegatesStatus("error");
          return;
        }
        setDelegateOptions(
          data.map((d) => ({
            id: d.id as string,
            fullName: `${d.first_name} ${d.last_name}`,
            regionNameKa: (d.region_name_ka as string | null) ?? "",
          })),
        );
        setDelegateId((current) =>
          data.some((delegate) => delegate.id === current) ? current : null,
        );
        setDelegatesStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setDelegatesStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [regionId, referral, delegatesRetry]);

  function changeRegion(value: string) {
    const next = value ? Number(value) : null;
    setRegionId(next);
    setCityId(null);
    setCities([]);
    setCitiesStatus(next === null ? "idle" : "loading");
    if (!referral) {
      setDelegateId(null);
      setDelegateOptions([]);
      setDelegatesStatus(next === null ? "idle" : "loading");
    }
  }

  async function submitProfile() {
    setFormError(undefined);
    const employment = workPreset === "__other" ? workFree : workPreset;
    const parsed = membershipProfileSchema.safeParse({
      // review finding M1: strip pasted separators before the regex check, same
      // as JoinForm's retired personalId.replace(/\D/g, "") normalization
      personalId: askPersonalId ? personalId.replace(/\D/g, "") : null,
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
      setFocusRequest((n) => n + 1);
      if (unmapped !== undefined) setFormError(unmapped);
      return;
    }
    setErrors({});
    if (
      regionsStatus !== "ready" ||
      !regions.some((region) => region.id === regionId) ||
      citiesStatus !== "ready" ||
      !cities.some((city) => city.id === cityId) ||
      (!referral && delegatesStatus !== "ready")
    ) {
      setFormError(GENERIC_FUNNEL_ERROR);
      setFocusRequest((n) => n + 1);
      return;
    }
    setBusy(true);
    let result: Awaited<ReturnType<typeof saveMembershipProfileAction>>;
    try {
      result = await saveMembershipProfileAction(parsed.data);
    } catch {
      setFormError(GENERIC_FUNNEL_ERROR);
      setFocusRequest((n) => n + 1);
      return;
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      if (result.error === DUPLICATE_PERSONAL_ID_MESSAGE) {
        setErrors((prev) => ({ ...prev, personalId: result.error }));
      } else {
        setFormError(result.error);
      }
      setFocusRequest((n) => n + 1);
      return;
    }
    // review finding F2: only trust a fresh capture when this submission actually
    // asked for one (askPersonalId as the guard) — then read the server's own
    // hasPersonalId off the returned state rather than assuming, so a back-then-
    // resave never re-renders the (now immutable, server-ignored) ID field again
    if (askPersonalId && result.state.exists) {
      setIdCaptured(result.state.hasPersonalId);
    }
    // clears a stale error from an earlier failed completion attempt — this is
    // one persistent component, not a fresh page mount, so a prior tier-phase
    // failure would otherwise resurface on re-entry after a back-then-resave loop
    setTierError(undefined);
    setPhase("tier");
  }

  // a ticked box retires the consent prompt; a server error stays until the next send
  function clearConsentError() {
    setTierError((prev) => (prev === CONSENT_REQUIRED_MESSAGE ? undefined : prev));
  }

  async function completeTier() {
    if (!dataConsent || !duesConsent) {
      setTierError(CONSENT_REQUIRED_MESSAGE);
      setFocusRequest((n) => n + 1);
      return;
    }
    setTierError(undefined);
    setTierBusy(true);
    let result: Awaited<ReturnType<typeof completeMembershipAction>>;
    try {
      result = await completeMembershipAction({ tier });
    } catch {
      setTierError(GENERIC_FUNNEL_ERROR);
      setFocusRequest((n) => n + 1);
      return;
    } finally {
      setTierBusy(false);
    }
    if (!result.ok) {
      setTierError(result.error);
      setFocusRequest((n) => n + 1);
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
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="m-0 border-b-2 border-ink pb-3.5 font-serif text-[26px] font-semibold leading-[1.25] md:pb-[18px] md:text-[32px]"
        >
          {t("წევრის მონაცემები")}
        </h2>
        <div className="mt-6 flex flex-col gap-6 md:mt-8">
          {askPersonalId ? (
            <div className="flex flex-col gap-1.5">
              <UnityField
                label={t("პირადი ნომერი")}
                name="personalId"
                inputMode="numeric"
                placeholder="01001000000"
                value={personalId}
                onChange={(e) => setPersonalId(e.target.value)}
                error={t(errors.personalId ?? "")}
              />
              <p className="m-0 text-[13.5px] text-secondary">{t("11 ნიშნა")}</p>
            </div>
          ) : null}
          <UnityField
            label={t("დაბადების თარიღი")}
            name="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            error={t(errors.birthDate ?? "")}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <UnitySelectField
              label={t("მხარე")}
              id="mw-region"
              aria-describedby={
                regionsStatus === "error"
                  ? "mw-regions-load-error"
                  : errors.regionId
                    ? "mw-region-error"
                    : undefined
              }
              value={regionId === null ? "" : String(regionId)}
              onChange={(e) => changeRegion(e.target.value)}
              error={t(errors.regionId ?? "")}
              disabled={regionsStatus !== "ready" || regions.length === 0}
            >
              <option value="" disabled>
                {t("აირჩიე მხარე")}
              </option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {t(r.name_ka)}
                </option>
              ))}
            </UnitySelectField>
            <UnitySelectField
              label={t("ქალაქი / მუნიციპალიტეტი")}
              id="mw-city"
              aria-describedby={
                citiesStatus === "error"
                  ? "mw-cities-load-error"
                  : errors.cityId
                    ? "mw-city-error"
                    : undefined
              }
              value={cityId === null ? "" : String(cityId)}
              onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : null)}
              error={t(errors.cityId ?? "")}
              disabled={citiesStatus !== "ready" || cities.length === 0}
            >
              <option value="" disabled>
                {regionId === null ? t("ჯერ აირჩიე მხარე") : t("აირჩიე ქალაქი")}
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name_ka)}
                </option>
              ))}
            </UnitySelectField>
          </div>
          {regionsStatus === "loading" ? (
            <p role="status" className="m-0 text-[15px] text-secondary">
              {t("მხარეები იტვირთება…")}
            </p>
          ) : null}
          {regionsStatus === "error" ? (
            <div>
              <p
                id="mw-regions-load-error"
                role="alert"
                data-regions-feedback
                tabIndex={-1}
                className="m-0 text-[15px] text-danger"
              >
                {t("მხარეები ვერ ჩაიტვირთა.")}
              </p>
              <UnityButton variant="ghost" size="sm" onClick={() => setRegionsRetry((n) => n + 1)}>
                {t("მხარეების თავიდან ცდა")}
              </UnityButton>
            </div>
          ) : null}
          {regionsStatus === "ready" && regions.length === 0 ? (
            <p
              role="status"
              data-regions-feedback
              tabIndex={-1}
              className="m-0 text-[15px] text-secondary"
            >
              {t("მხარეები ვერ მოიძებნა.")}
            </p>
          ) : null}
          {citiesStatus === "loading" ? (
            <p role="status" className="m-0 text-[15px] text-secondary">
              {t("ქალაქები იტვირთება…")}
            </p>
          ) : null}
          {citiesStatus === "error" ? (
            <div>
              <p id="mw-cities-load-error" role="alert" className="m-0 text-[15px] text-danger">
                {t("ქალაქები ვერ ჩაიტვირთა.")}
              </p>
              <UnityButton variant="ghost" size="sm" onClick={() => setCitiesRetry((n) => n + 1)}>
                {t("ქალაქების თავიდან ცდა")}
              </UnityButton>
            </div>
          ) : null}
          {citiesStatus === "ready" && cities.length === 0 ? (
            <p role="status" className="m-0 text-[15px] text-secondary">
              {t("ამ მხარეში ქალაქები ვერ მოიძებნა.")}
            </p>
          ) : null}
          <UnitySelectField
            label={t("სამუშაო ადგილი / სტატუსი")}
            id="mw-work"
            value={workPreset}
            onChange={(e) => setWorkPreset(e.target.value)}
            error={t(errors.employment ?? "")}
          >
            <option value="" disabled>
              {t("აირჩიე სტატუსი")}
            </option>
            {EMPLOYMENT_PRESETS.map((w) => (
              <option key={w} value={w}>
                {t(w)}
              </option>
            ))}
            <option value="__other">{t("სხვა (მიუთითე)")}</option>
          </UnitySelectField>
          {workPreset === "__other" ? (
            <UnityField
              label={t("მიუთითე შენი საქმიანობა")}
              name="workFree"
              placeholder={t("მაგ. არქიტექტორი, ფერმერი, IT სპეციალისტი...")}
              value={workFree}
              onChange={(e) => setWorkFree(e.target.value)}
              error={t(errors.employment ?? "")}
            />
          ) : null}
          <fieldset
            aria-describedby={delegatesStatus === "error" ? "mw-delegates-load-error" : undefined}
            disabled={!referral && (regionId === null || delegatesStatus !== "ready")}
            className="m-0 min-w-0 border-0 p-0"
          >
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
          </fieldset>
          {!referral && delegatesStatus === "loading" ? (
            <p role="status" className="m-0 text-[15px] text-secondary">
              {t("დელეგატები იტვირთება…")}
            </p>
          ) : null}
          {!referral && delegatesStatus === "error" ? (
            <div>
              <p id="mw-delegates-load-error" role="alert" className="m-0 text-[15px] text-danger">
                {t("დელეგატები ვერ ჩაიტვირთა.")}
              </p>
              <UnityButton
                variant="ghost"
                size="sm"
                onClick={() => setDelegatesRetry((n) => n + 1)}
              >
                {t("დელეგატების თავიდან ცდა")}
              </UnityButton>
            </div>
          ) : null}
          {!referral && delegatesStatus === "ready" && delegateOptions.length === 0 ? (
            <p role="status" className="m-0 text-[15px] text-secondary">
              {t("ამ მხარეში დელეგატები არ არის.")}
            </p>
          ) : null}
          {formError ? (
            <p role="alert" data-form-error tabIndex={-1} className="m-0 text-[15px] text-danger">
              {t(formError ?? "")}
            </p>
          ) : null}
          <UnityButton
            type="submit"
            disabled={
              busy ||
              (regionId !== null &&
                (regionsStatus !== "ready" ||
                  citiesStatus !== "ready" ||
                  (!referral && delegatesStatus !== "ready")))
            }
            arrow
            className="w-full"
          >
            {t("გაგრძელება")}
          </UnityButton>
        </div>
      </>
    );
  } else {
    phaseContent = (
      <>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="m-0 border-b-2 border-ink pb-3.5 font-serif text-[26px] font-semibold leading-[1.25] md:pb-[18px] md:text-[32px]"
        >
          {t("წევრობის განაცხადი")}
        </h2>
        <p className="mt-6 mb-0 text-[12px] font-bold tracking-[.14em] text-secondary md:mt-8">
          {t("რა მოხდება შემდეგ")}
        </p>
        <ol className="mt-4 mb-0 list-none p-0">
          {NEXT_STEPS.map((text, i) => (
            <li
              key={t(text)}
              className={`relative grid grid-cols-[40px_minmax(0,1fr)] gap-3.5 ${
                i < NEXT_STEPS.length - 1 ? "pb-[22px]" : ""
              }`}
            >
              {i < NEXT_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0.5 left-[19px] top-8 border-l-2 border-dashed border-[#cfc4b3]"
                />
              ) : null}
              <span
                aria-hidden="true"
                className="text-center text-[28px] font-black leading-none text-teal [font-stretch:62.5%]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="pt-[3px] text-[16px] leading-[1.55] md:text-[17px]">{t(text)}</span>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex flex-col gap-[18px] border-t border-rule pt-7 md:mt-8">
          <UnityCheckboxField
            label={t("თანახმა ვარ, ჩემი პირადი მონაცემები დამუშავდეს წევრობის გასაფორმებლად")}
            checked={dataConsent}
            aria-invalid={(tierError === CONSENT_REQUIRED_MESSAGE && !dataConsent) || undefined}
            aria-describedby={
              tierError === CONSENT_REQUIRED_MESSAGE && !dataConsent ? "mw-tier-error" : undefined
            }
            onChange={(e) => {
              setDataConsent(e.target.checked);
              clearConsentError();
            }}
          />
          <UnityCheckboxField
            label={`${t("თანახმა ვარ, მომავალში, როცა საწევრო შემოიღება, ვიხდიდე ყოველთვიურ საწევროს — ")}${MEMBERSHIP_FEE_GEL}${t(" ₾ თვეში")}`}
            checked={duesConsent}
            aria-invalid={(tierError === CONSENT_REQUIRED_MESSAGE && !duesConsent) || undefined}
            aria-describedby={
              tierError === CONSENT_REQUIRED_MESSAGE && !duesConsent ? "mw-tier-error" : undefined
            }
            onChange={(e) => {
              setDuesConsent(e.target.checked);
              clearConsentError();
            }}
          />
        </div>
        {tierError ? (
          <p
            id="mw-tier-error"
            role="alert"
            data-form-error
            tabIndex={-1}
            className="mt-4 mb-0 text-[15px] text-danger"
          >
            {t(tierError ?? "")}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap md:mt-9">
          <UnityButton type="submit" disabled={tierBusy}>
            {t("განაცხადის გაგზავნა")}
          </UnityButton>
          <UnityButton variant="ghost" onClick={() => setPhase("profile")} disabled={tierBusy}>
            {t("← მონაცემების შესწორება")}
          </UnityButton>
        </div>
      </>
    );
  }

  return (
    <CabinetPage>
      <UnityKicker>{t("წევრობის გაფორმება")}</UnityKicker>
      <div className="mt-[18px] md:mt-[26px]">
        <Stepper steps={[t("პროფილი"), t("განაცხადი")]} current={phase === "profile" ? 1 : 2} />
      </div>
      <div className="mt-[26px] grid items-start gap-11 md:mt-12 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:gap-[clamp(40px,5vw,80px)]">
        <div className="min-w-0 max-w-[720px]">
          <form
            ref={formRef}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (phase === "profile") void submitProfile();
              else void completeTier();
            }}
            className="border border-rule bg-chalk p-6 md:px-12 md:py-11"
          >
            {phaseContent}
          </form>
          <span aria-hidden="true" className="mx-1.5 mt-[5px] block h-px bg-ink md:mx-2.5" />
        </div>
        <CabinetPanel tone="wine" as="aside" className="md:px-11 md:pb-[150px] md:pt-11">
          <h2 className="m-0 font-serif text-[22px] font-semibold leading-[1.3] text-limestone md:text-[26px]">
            {t("გახდი წევრი")}
          </h2>
          <p className="mt-3 mb-0 text-[16.5px] leading-[1.6] text-sand">
            {t("წევრობა ხსნის მოძრაობის სრულ შესაძლებლობებს.")}
          </p>
          <div className="mt-6">
            <CabinetPerks perks={MEMBERSHIP_PERKS} />
          </div>
        </CabinetPanel>
      </div>
    </CabinetPage>
  );
}
