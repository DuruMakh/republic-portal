import type { Metadata } from "next";
import { UnityNotice } from "@/components/UnityNotice";
import { UnityTextLink } from "@/components/UnityTextLink";
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
 * support messages).
 */
export default function AccountDeletedPage() {
  return (
    <UnityNotice
      title={ACCOUNT_DELETED_TITLE}
      description={ACCOUNT_DELETED_BODY}
      actions={
        <>
          <UnityTextLink href="/" className="text-[16px]">
            {ACCOUNT_DELETED_HOME}
          </UnityTextLink>
          <UnityTextLink href={PRIVACY_POLICY_PATH} className="text-[16px]">
            {ACCOUNT_DELETED_PRIVACY}
          </UnityTextLink>
        </>
      }
    />
  );
}
