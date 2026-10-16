import type { ReactNode } from "react";
import localFont from "next/font/local";
import { DemoBanner } from "@/components/DemoBanner";
import { UnityFooter } from "@/components/UnityFooter";
import { UnityHeader } from "@/components/UnityHeader";
import { UnityJoinBar } from "@/components/UnityJoinBar";
import { ABOUT_HREF } from "@/lib/about-copy";
import { PRINCIPLES_HREF } from "@/lib/principles-copy";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";
import { filterRatingLinks, RATINGS_HREF, showRatings } from "@/lib/ratings-switch";
import { STRUCTURE_HREF } from "@/lib/structure-copy";

// Display headlines (GL Gordeziani) and old-Georgian numerals (BPG Nateli AsoMtavruli), from the
// owner's „ერთობა“ design. Only these four pages use them, so they load here, not in the root.
const gordeziani = localFont({
  src: "../fonts/gl-gordeziani-bold.woff2",
  weight: "700",
  variable: "--font-gl-gordeziani",
  display: "swap",
});
const asomtavruli = localFont({
  src: "../fonts/bpg-nateli-asomtavruli.woff2",
  weight: "300",
  variable: "--font-bpg-asomtavruli",
  display: "swap",
});

const FOOTER_COPYRIGHT = "© 2026 ქართული რესპუბლიკა — ღია ჩანაწერი";

// Labels and order from the design's header (no news or finance link there).
const navItems = [
  { href: "/", label: "მთავარი" },
  { href: ABOUT_HREF, label: "ჩვენ შესახებ" },
  { href: PRINCIPLES_HREF, label: "პრინციპები" },
  { href: STRUCTURE_HREF, label: "სტრუქტურა" },
  { href: RATINGS_HREF, label: "რეიტინგი" },
];

// The design's two footer columns, listed column by column.
const footerLinks = [
  { href: "/", label: "მთავარი" },
  { href: ABOUT_HREF, label: "ჩვენ შესახებ" },
  { href: PRINCIPLES_HREF, label: "პრინციპები" },
  { href: STRUCTURE_HREF, label: "სტრუქტურა" },
  { href: "/news", label: "სიახლეები" },
  { href: RATINGS_HREF, label: "რეიტინგი" },
  { href: "/support", label: "დაგვიკავშირდი" },
];

const legalLinks = [
  { href: "/join/terms", label: "წესები" },
  { href: PRIVACY_POLICY_PATH, label: "კონფიდენციალურობა" },
];

/**
 * Chrome for the four pages of the owner's „ერთობა“ redesign (Page 2 of the design canvas):
 * home, about, principles and structure. Full-bleed limestone instead of the Kronika paper sheet,
 * the new header and teal footer, and the phone join bar. Every other public page keeps the
 * (public) layout until its own redesign. The ranking link follows SHOW_RATINGS (ADR-052).
 */
export default function UnityLayout({ children }: { children: ReactNode }) {
  const ratingsShown = showRatings();

  return (
    <div
      className={`${gordeziani.variable} ${asomtavruli.variable} flex min-h-screen flex-col overflow-x-clip bg-limestone text-[17px] leading-[1.65] text-ink`}
    >
      <DemoBanner />
      <UnityHeader navItems={filterRatingLinks(navItems, ratingsShown)} />
      <div className="flex-1">{children}</div>
      <UnityFooter
        navLinks={filterRatingLinks(footerLinks, ratingsShown)}
        legalLinks={legalLinks}
        copyright={FOOTER_COPYRIGHT}
      />
      <UnityJoinBar />
    </div>
  );
}
