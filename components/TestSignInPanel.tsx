import { useCopy } from "@/lib/i18n/copy";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TEST_PERSONAS } from "@/lib/test-personas";

/**
 * Preview-only one-click sign-in (spec 2026-10-08 simpler dev structure 4.3). Rendered only
 * when testSignInEnabled(); the server action passed in re-checks the same gate on every call.
 */
export function TestSignInPanel({ action }: { action: (formData: FormData) => Promise<void> }) {
  const t = useCopy();
  return (
    <Card variant="callout" title={t("სატესტო შესვლა")}>
      <p className="mb-4 text-sm text-ink">
        {t("მხოლოდ სატესტო ბმულზე: შედი ფიქტიური ანგარიშით, Google-ის გარეშე.")}
      </p>
      <form action={action} className="flex flex-wrap gap-2">
        {TEST_PERSONAS.map((persona) => (
          <Button
            key={persona.id}
            type="submit"
            name="persona"
            value={persona.id}
            variant="ghost"
            size="sm"
          >
            {t(persona.label)}
          </Button>
        ))}
      </form>
    </Card>
  );
}
