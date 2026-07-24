import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ButtonLink";
import { DemoBanner } from "@/components/DemoBanner";
import { HeaderSessionAction } from "@/components/HeaderSessionAction";
import { Masthead } from "@/components/Masthead";
import { PageSheet } from "@/components/PageSheet";
import { SiteFooter } from "@/components/SiteFooter";

// Kept labels copied byte-exact from the prior nav array (git history,
// pre-Task-10 app/(public)/layout.tsx). Only the /transparency label changes,
// spliced from the Kronika mock template (never hand-typed) per
// .superpowers/sdd/task-10-brief.md Step 2.
const NAV_NEWS_LABEL = "სიახლეები";
const NAV_TRANSPARENCY_LABEL = "ფინანსები";
const HEADER_CTA_LABEL = "შემოგვიერთდი";
const FOOTER_TERMS_LABEL = "წესები";
const FOOTER_COPYRIGHT = "© 2026 ქართული რესპუბლიკა — ღია ჩანაწერი";

const navItems: { href: string; label: string }[] = [
  { href: "/", label: "მთავარი" },
  { href: "/delegates", label: "დელეგატები" },
  { href: "/leaderboard", label: "რეიტინგი" },
  { href: "/news", label: NAV_NEWS_LABEL },
  { href: "/events", label: "ღონისძიებები" },
  { href: "/transparency", label: NAV_TRANSPARENCY_LABEL },
];

const footerLinks: { href: string; label: string }[] = [
  { href: "/join/terms", label: FOOTER_TERMS_LABEL },
  { href: "/news", label: NAV_NEWS_LABEL },
  { href: "/transparency", label: NAV_TRANSPARENCY_LABEL },
];

/**
 * Public chrome (spec Sec 3.1-3.2): DemoBanner above the paper sheet, then the
 * sheet itself -- Masthead, the page content, SiteFooter. The old emoji-emblem
 * header and footer are gone (Task 10).
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      <PageSheet>
        <Masthead
          navItems={navItems}
          cta={
            <ButtonLink href="/join" size="sm">
              {HEADER_CTA_LABEL}
            </ButtonLink>
          }
          sessionSlot={<HeaderSessionAction />}
        />
        {/* FOOTER-PIN: PageSheet is min-h-screen flex flex-col; a growing plain
            div (not <main> -- pages render their own) pins SiteFooter to the
            bottom on short pages. */}
        <div className="flex-1">{children}</div>
        <SiteFooter copyright={FOOTER_COPYRIGHT} links={footerLinks} />
      </PageSheet>
    </>
  );
}
