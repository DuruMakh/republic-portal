import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";

export const metadata: Metadata = {
  title: "რეგისტრაცია მალე გაიხსნება — ქართული რესპუბლიკა",
  description: "წევრობის გახსნისთანავე აქვე შეძლებ დარეგისტრირებას.",
};

export default function JoinPage() {
  return (
    <CenteredNotice
      decoration={
        <div className="mx-auto mb-6 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,var(--color-brand)_0_60%,var(--color-line)_60%_100%)]" />
      }
      title="რეგისტრაცია მალე გაიხსნება"
      description="პლატფორმა მშენებლობის პროცესშია — წევრობის გახსნისთანავე აქვე შეძლებ დარეგისტრირებას."
      actions={
        <>
          <ButtonLink href="/">მთავარ გვერდზე დაბრუნება</ButtonLink>
          <ButtonLink href="/leaderboard" variant="ghost">
            ნახე დელეგატების რეიტინგი
          </ButtonLink>
        </>
      }
    />
  );
}
