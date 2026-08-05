import { MobileTabBar } from "@/components/MobileTabBar";
import { cabinetNavItems } from "@/lib/cabinet";
import { mobileTabs } from "@/lib/mobile-nav";

// Styleguide-only route (Task 9), never linked from product nav.
//
// It deliberately lives OUTSIDE app/(public): inside that group the public
// layout's MobileJoinCta would render too, so the page would carry TWO sticky
// bottom bars -- breaking the one-bar-per-route invariant on a publicly
// reachable URL and failing the e2e sweep that asserts it. Only the root
// layout applies here, so the tab bar renders alone. There is no
// real page that shows MobileTabBar in isolation -- every real mount sits
// inside a full cabinet layout -- so /styleguide points a PhoneFrame iframe
// (see samples.tsx) at this instead. Same reason this route has to exist at
// all: MobileTabBar carries `md:hidden`, a viewport media query, so a narrow
// wrapper div in the desktop styleguide page cannot reveal it -- only an
// iframe with its own viewport can.
//
// Items come from the real cabinetNavItems()/mobileTabs() pipeline, same as
// the desktop CabinetNav demo in samples.tsx -- never hand-typed here -- with
// a demo count spliced onto the polls tab so the Badge slot is visible too.
const DEMO_ITEMS = cabinetNavItems("member").map((item) =>
  item.href === "/me/polls" ? { ...item, count: 3 } : item,
);
const { tabs, more } = mobileTabs(DEMO_ITEMS, "member");

export default function MobileTabBarDemoPage() {
  return <MobileTabBar tabs={tabs} more={more} />;
}
