import type { Metadata } from "next";
import Link from "next/link";
import { CenteredNotice } from "@/components/CenteredNotice";
import {
  ACCOUNT_DELETED_BODY,
  ACCOUNT_DELETED_HOME,
  ACCOUNT_DELETED_PRIVACY,
  ACCOUNT_DELETED_TITLE,
} from "@/lib/account-deletion-copy";
import { PRIVACY_POLICY_PATH } from "@/lib/privacy";

export const metadata: Metadata = {
  title: `${ACCOUNT_DELETED_TITLE} — ქართული რესპუბლიკა`,
  robots: { index: false, follow: false },
};

/**
 * Spec 2026-10-08 §3.1: where a member lands once their account is erased. The policy link is
 * there because the policy says what outlives a deletion (the SMS limit record, backups,
 * support messages). Plain text links: brand red and underlined by the base styles (DESIGN.md).
 */
export default function AccountDeletedPage() {
  return (
    <CenteredNotice
      title={ACCOUNT_DELETED_TITLE}
      description={ACCOUNT_DELETED_BODY}
      actions={
        <>
          <Link href="/" className="font-semibold">
            {ACCOUNT_DELETED_HOME}
          </Link>
          <Link href={PRIVACY_POLICY_PATH} className="font-semibold">
            {ACCOUNT_DELETED_PRIVACY}
          </Link>
        </>
      }
    />
  );
}
