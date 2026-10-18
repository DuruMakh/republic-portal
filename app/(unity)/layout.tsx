import type { ReactNode } from "react";
import { DemoBanner } from "@/components/DemoBanner";
import { UnityFooter } from "@/components/UnityFooter";
import { UnityHeader } from "@/components/UnityHeader";
import { UnityJoinBar } from "@/components/UnityJoinBar";
import { ABOUT_HREF } from "@/lib/about-copy";
import { showEvents } from "@/lib/events-switch";
import { PRINCIPLES_HREF, PRINCIPLES_NAV_LABEL } from "@/lib/principles-copy";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";
import { FINANCES_HREF, filterFinanceLinks, showPublicFinances } from "@/lib/public-finances";
import { filterRatingLinks, RATINGS_HREF, showRatings } from "@/lib/ratings-switch";
import { STRUCTURE_HREF } from "@/lib/structure-copy";

const FOOTER_COPYRIGHT = "© 2026 ქართული რესპუბლიკა — ღია ჩანაწერი";

// Labels and order from the design's header (no news or finance link there).
const navItems = [
  { href: "/", label: "მთავარი" },
  { href: ABOUT_HREF, label: "ჩვენ შესახებ" },
  { href: PRINCIPLES_HREF, label: PRINCIPLES_NAV_LABEL },
  { href: STRUCTURE_HREF, label: "სტრუქტურა" },
  { href: RATINGS_HREF, label: "რეიტინგი" },
];

// The design's two footer columns, listed column by column.
const footerLinks = [
  { href: "/", label: "მთავარი" },
  { href: ABOUT_HREF, label: "ჩვენ შესახებ" },
  { href: PRINCIPLES_HREF, label: PRINCIPLES_NAV_LABEL },
  { href: STRUCTURE_HREF, label: "სტრუქტურა" },
  { href: "/news", label: "სიახლეები" },
  { href: RATINGS_HREF, label: "რეიტინგი" },
  { href: "/support", label: "დაგვიკავშირდი" },
];

const legalLinks = [
  { href: "/join/terms", label: "წესები" },
  { href: PRIVACY_POLICY_PATH, label: "კონფიდენციალურობა" },
  { href: FINANCES_HREF, label: "ფინანსები" },
];

/**
 * Chrome for the four pages of the owner's „ერთობა“ redesign (Page 2 of the design canvas):
 * home, about, principles and structure. Full-bleed limestone instead of the Kronika paper sheet,
 * the new header and teal footer, and the phone join bar. Other public pages move here as their
 * redesign lands. The ranking link follows SHOW_RATINGS (ADR-052), the finance link
 * SHOW_PUBLIC_FINANCES (ADR-034).
 */
export default function UnityLayout({ children }: { children: ReactNode }) {
  const ratingsShown = showRatings();

  return (
    <div className="unity-fonts flex min-h-screen flex-col overflow-x-clip bg-limestone text-[17px] leading-[1.65] text-ink">
      <DemoBanner />
      <UnityHeader
        navItems={filterRatingLinks(navItems, ratingsShown)}
        eventsShown={showEvents()}
        ratingsShown={ratingsShown}
      />
      <div className="flex-1">{children}</div>
      <UnityFooter
        navLinks={filterRatingLinks(footerLinks, ratingsShown)}
        legalLinks={filterFinanceLinks(legalLinks, showPublicFinances())}
        copyright={FOOTER_COPYRIGHT}
      />
      <UnityJoinBar />
    </div>
  );
}
