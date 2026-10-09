import { testSignInAction } from "@/app/(public)/login/test-sign-in-actions";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TEST_PERSONAS } from "@/lib/test-personas";

/**
 * Preview-only one-click sign-in (spec 2026-10-08 simpler dev structure 4.3). Rendered only
 * when testSignInEnabled(); testSignInAction re-checks the same gate on every call.
 */
export function TestSignInPanel() {
  return (
    <Card variant="callout" title="სატესტო შესვლა">
      <p className="mb-4 text-sm text-ink">
        მხოლოდ სატესტო ბმულზე: შედი ფიქტიური ანგარიშით, Google-ის გარეშე.
      </p>
      <form action={testSignInAction} className="flex flex-wrap gap-2">
        {TEST_PERSONAS.map((persona) => (
          <Button
            key={persona.id}
            type="submit"
            name="persona"
            value={persona.id}
            variant="ghost"
            size="sm"
          >
            {persona.label}
          </Button>
        ))}
      </form>
    </Card>
  );
}
