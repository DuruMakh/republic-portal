import { useCopy } from "@/lib/i18n/copy";
import { useLocale } from "next-intl";
import Link from "@/lib/i18n/navigation";
import { UnityCheckboxField } from "@/components/UnityField";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";

/**
 * The registration consent box (spec 2026-10-08 §4): age 18+ and personal-data
 * processing in one required sentence. One home for both join forms. The policy
 * opens in a new tab so nothing typed into the form is lost.
 */
export function PrivacyConsentField({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  const t = useCopy();
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-1.5">
      <UnityCheckboxField
        name="privacyConsent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={error ? true : undefined}
        label={
          <>
            {t(
              "ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების დამუშავებას",
            )}{" "}
            <Link
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand underline decoration-1 underline-offset-[5px] hover:text-brand-dark"
            >
              {t("კონფიდენციალურობის პოლიტიკის")}
            </Link>
            {locale === "ka" ? " " : ""}
            {t("შესაბამისად.")}
          </>
        }
      />
      {error ? (
        <p role="alert" className="text-[14px] font-semibold text-danger">
          {t(error ?? "")}
        </p>
      ) : null}
    </div>
  );
}
