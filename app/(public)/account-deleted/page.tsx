import type { Metadata } from "next";
import Link from "next/link";
import {
  ACCOUNT_DELETED_BODY,
  ACCOUNT_DELETED_HOME,
  ACCOUNT_DELETED_TITLE,
} from "@/lib/account-deletion-copy";

export const metadata: Metadata = {
  title: `${ACCOUNT_DELETED_TITLE} — ქართული რესპუბლიკა`,
  robots: { index: false, follow: false },
};

export default function AccountDeletedPage() {
  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <h1 className="mb-4 font-serif text-3xl font-bold text-ink">{ACCOUNT_DELETED_TITLE}</h1>
      <p className="mb-6 text-sm text-prose">{ACCOUNT_DELETED_BODY}</p>
      <Link href="/" className="font-semibold text-brand hover:underline">
        {ACCOUNT_DELETED_HOME}
      </Link>
    </main>
  );
}
