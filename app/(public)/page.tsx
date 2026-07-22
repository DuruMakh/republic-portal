import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { CountUp } from "@/components/CountUp";
import { fetchPublicStats } from "@/lib/supabase/public";

export const revalidate = 60;

const features = [
  {
    icon: "🗳",
    title: "რეგიონული წარმომადგენლობა",
    text: "ყველა მხარეს ჰყავს საკუთარი ვერიფიცირებული დელეგატი, რომელიც შენს ხმას წარადგენს.",
  },
  {
    icon: "🔒",
    title: "იურიდიული ვერიფიკაცია",
    text: "პირადი ნომრისა და ტელეფონის ვერიფიკაცია უზრუნველყოფს რეალურ, გამჭვირვალე წევრობას.",
  },
  {
    icon: "📈",
    title: "ღია რეიტინგი",
    text: "დელეგატები საჯაროდ ლაგდებიან აქტიური მხარდამჭერების მიხედვით — სრული გამჭვირვალობა.",
  },
] as const;

export default async function HomePage() {
  const stats = await fetchPublicStats();
  return (
    <main>
      <section
        className="bg-navy text-white"
        style={{
          backgroundImage:
            "radial-gradient(1200px 500px at 50% -10%, #1b2c46 0%, var(--color-navy) 55%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-6 h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,var(--color-brand)_0_60%,#fff_60%_100%)]" />
          <h1 className="max-w-[16ch] font-serif text-4xl font-bold leading-tight sm:text-5xl">
            ავაშენოთ ქართული რესპუბლიკა ერთად
          </h1>
          <p className="mt-4 max-w-[52ch] text-lg text-white/70">
            გაერთიანდი მოქალაქეებისა და რეგიონული ლიდერების მოძრაობაში. გამჭვირვალე,
            ანგარიშვალდებული და შენს ხელში.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/join" size="lg">
              დარეგისტრირდი
            </ButtonLink>
          </div>
          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div
                className="text-4xl font-extrabold tabular-nums"
                data-testid="stat-registered-total"
              >
                <CountUp value={stats.registered_total} />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white/60">რეგისტრირებული</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div
                className="text-4xl font-extrabold tabular-nums"
                data-testid="stat-active-members"
              >
                <CountUp value={stats.active_members} />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white/60">აქტიური წევრი</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div
                className="text-4xl font-extrabold tabular-nums"
                data-testid="stat-approved-delegates"
              >
                <CountUp value={stats.approved_delegates} />
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white/60">
                დამტკიცებული დელეგატი
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <h3 className="font-bold text-ink">
                <span aria-hidden className="me-2">
                  {f.icon}
                </span>
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-muted-fg">{f.text}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/leaderboard" variant="dark" size="lg">
            ნახე დელეგატების რეიტინგი →
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
