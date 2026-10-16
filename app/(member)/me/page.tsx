import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabinetHead, CabinetPage, CabinetPanel, CabinetPerks } from "@/components/CabinetPage";
import { ReferralCard } from "@/components/ReferralCard";
import { UnityButtonLink } from "@/components/UnityButtonLink";
import { UnityKicker } from "@/components/UnityKicker";
import { isApprovedDelegate, MEMBERSHIP_PERKS } from "@/lib/cabinet";
import { showEvents } from "@/lib/events-switch";
import { deriveMembershipPhase } from "@/lib/funnel";
import { showMembershipDues } from "@/lib/membership-dues";
import { getCabinetState } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ჩემი კაბინეტი — ქართული რესპუბლიკა" };

function ShortcutCard({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <CabinetPanel className="md:p-8">
      <h3 className="m-0 font-serif text-[22px] font-semibold leading-[1.3] md:text-[26px]">
        {title}
      </h3>
      <p className="mt-2.5 mb-0 text-[16px] leading-[1.6] text-secondary">{text}</p>
      <div className="mt-[22px]">
        <UnityButtonLink href={href} variant="ghost" size="sm" arrow className="max-md:w-full">
          ნახვა
        </UnityButtonLink>
      </div>
    </CabinetPanel>
  );
}

export default async function CabinetOverviewPage() {
  const state = await getCabinetState();
  if (!state.exists) redirect("/join"); // soft-nav defense: layout guard doesn't narrow this page
  if (isApprovedDelegate(state)) redirect("/delegate");
  if (state.standing === "member") redirect("/me/profile");

  const phase = deriveMembershipPhase(state);
  const eventsShown = showEvents();
  return (
    <CabinetPage deco="knot">
      <CabinetHead
        kicker="მხარდამჭერი"
        title={`გამარჯობა, ${state.firstName}!`}
        lede="რეგისტრაცია დასრულებულია — შენ უკვე მოძრაობის ნაწილი ხარ."
      />
      <div className="mt-7 grid items-start gap-6 md:mt-12 md:gap-10 min-[1100px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <CabinetPanel tone="wine" className="md:px-[52px] md:py-12">
          <UnityKicker tone="light">შემდეგი ნაბიჯი</UnityKicker>
          <h2 className="mt-4 mb-0 font-display text-[44px] font-bold leading-[.92] text-limestone md:mt-[22px] md:text-[72px]">
            გახდი წევრი
          </h2>
          <p className="mt-4 mb-0 max-w-[30em] font-serif text-[17px] leading-[1.6] text-sand md:mt-5 md:text-[19px]">
            {showMembershipDues()
              ? "წევრობა ხსნის მოძრაობის სრულ შესაძლებლობებს — ყოველთვიური საწევრო 10₾."
              : "წევრობა ხსნის მოძრაობის სრულ შესაძლებლობებს."}
          </p>
          <div className="mt-6 md:mt-7">
            <CabinetPerks perks={MEMBERSHIP_PERKS} />
          </div>
          <div className="mt-8 md:mt-9" data-testid="become-member-cta">
            <UnityButtonLink href="/me/membership" variant="cream" arrow className="max-md:w-full">
              {phase === "tier" ? "გააგრძელე წევრობის გაფორმება" : "გახდი წევრი"}
            </UnityButtonLink>
          </div>
        </CabinetPanel>
        {state.referralCode != null ? (
          <ReferralCard
            code={state.referralCode}
            supporters={state.referralSupporters ?? 0}
            members={state.referralMembers ?? 0}
            teamNote={false}
          />
        ) : null}
      </div>
      {/* No events card while events are hidden (ADR-042); news then spans the row. */}
      <div
        className={`mt-6 grid items-start gap-6 md:mt-10 md:gap-10 ${eventsShown ? "md:grid-cols-2" : ""}`}
      >
        {eventsShown ? (
          <ShortcutCard
            title="ღონისძიებები"
            text="ნახე მომავალი შეხვედრები და დაარეგისტრირე დასწრება."
            href="/me/events"
          />
        ) : null}
        <ShortcutCard
          title="სიახლეები"
          text="მოძრაობის საჯარო განცხადებები და ამბები."
          href="/me/news"
        />
      </div>
    </CabinetPage>
  );
}
