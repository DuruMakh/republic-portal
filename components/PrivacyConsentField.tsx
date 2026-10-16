import Link from "next/link";
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
  return (
    <div className="flex flex-col gap-1.5">
      <UnityCheckboxField
        name="privacyConsent"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={error ? true : undefined}
        label={
          <>
            ვადასტურებ, რომ 18 წლის ან უფროსი ვარ და ვეთანხმები ჩემი პერსონალური მონაცემების
            დამუშავებას{" "}
            <Link
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand underline decoration-1 underline-offset-[5px] hover:text-brand-dark"
            >
              კონფიდენციალურობის პოლიტიკის
            </Link>{" "}
            შესაბამისად.
          </>
        }
      />
      {error ? (
        <p role="alert" className="text-[14px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
