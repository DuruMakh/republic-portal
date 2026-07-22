import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Eyebrow } from "@/components/Eyebrow";
import { isApprovedDelegate } from "@/lib/cabinet";
import { deriveMembershipPhase } from "@/lib/funnel";
import { getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ჩემი კაბინეტი — ქართული რესპუბლიკა" };

const PERKS = [
  "ხმის მიცემა გამოკითხვებში",
  "საკუთარი დელეგატის არჩევა",
  "წევრებისთვის განკუთვნილი სიახლეები",
] as const;

export default async function CabinetOverviewPage() {
  const state = await getCabinetState();
  if (!state.exists) redirect("/join"); // soft-nav defense: layout guard doesn't narrow this page
  if (isApprovedDelegate(state)) redirect("/delegate");
  if (state.standing === "member") redirect("/me/profile");

  const phase = deriveMembershipPhase(state);
  return (
    <main>
      <div className="mb-8">
        <Eyebrow>პირადი კაბინეტი</Eyebrow>
        <h1 className="mt-1 text-2xl font-bold text-ink">გამარჯობა, {state.firstName}!</h1>
        <p className="mt-2 text-sm text-muted-fg">
          რეგისტრაცია დასრულებულია — შენ უკვე მოძრაობის ნაწილი ხარ.
        </p>
      </div>
      <Card>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">შემდეგი ნაბიჯი</p>
        <h2 className="mt-1 text-xl font-bold text-ink">გახდი წევრი</h2>
        <p className="mt-1 text-sm text-muted-fg">
          წევრობა ხსნის მოძრაობის სრულ შესაძლებლობებს — ყოველთვიური საწევრო 5₾-დან.
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-ink">
              <span aria-hidden>✅</span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5">
          <ButtonLink href="/me/membership" size="lg" data-testid="become-member-cta">
            {phase === "tier" ? "გააგრძელე წევრობის გაფორმება →" : "გახდი წევრი →"}
          </ButtonLink>
        </div>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="text-base font-bold text-ink">ღონისძიებები</h3>
          <p className="mt-1 text-sm text-muted-fg">
            ნახე მომავალი შეხვედრები და დაარეგისტრირე დასწრება.
          </p>
          <div className="mt-3">
            <ButtonLink href="/me/events" variant="ghost">
              ნახვა
            </ButtonLink>
          </div>
        </Card>
        <Card>
          <h3 className="text-base font-bold text-ink">სიახლეები</h3>
          <p className="mt-1 text-sm text-muted-fg">მოძრაობის საჯარო განცხადებები და ამბები.</p>
          <div className="mt-3">
            <ButtonLink href="/me/news" variant="ghost">
              ნახვა
            </ButtonLink>
          </div>
        </Card>
      </div>
    </main>
  );
}
