import type { Metadata } from "next";
import { ButtonLink } from "@/components/ButtonLink";

export const metadata: Metadata = {
  title: "რეგისტრაცია მალე გაიხსნება — ქართული რესპუბლიკა",
  description: "წევრობის გახსნისთანავე აქვე შეძლებ დარეგისტრირებას.",
};

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="mx-auto mb-6 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,var(--color-brand)_0_60%,var(--color-line)_60%_100%)]" />
      <h1 className="font-serif text-4xl font-bold text-ink">რეგისტრაცია მალე გაიხსნება</h1>
      <p className="mx-auto mt-4 max-w-md text-muted-fg">
        პლატფორმა მშენებლობის პროცესშია — წევრობის გახსნისთანავე აქვე შეძლებ დარეგისტრირებას.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">მთავარ გვერდზე დაბრუნება</ButtonLink>
        <ButtonLink href="/leaderboard" variant="ghost">
          ნახე დელეგატების რეიტინგი
        </ButtonLink>
      </div>
    </main>
  );
}
