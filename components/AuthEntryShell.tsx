import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

export function AuthEntryShell({
  eyebrow,
  title,
  intro,
  progress,
  children,
  asideTitle,
  aside,
  compact = false,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  intro: ReactNode;
  progress?: ReactNode;
  children: ReactNode;
  asideTitle: ReactNode;
  aside: ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <main
        aria-label="რეგისტრაციის გაგრძელება"
        className="mx-auto w-full max-w-[1120px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12 lg:pb-24 lg:pt-16"
      >
        {progress ? <div className="mb-10 sm:mb-14">{progress}</div> : null}
        <section className="max-w-2xl">{children}</section>
      </main>
    );
  }

  return (
    <main
      aria-labelledby="auth-entry-title"
      className="mx-auto w-full max-w-[1120px] px-5 pb-16 pt-8 sm:px-8 sm:pt-12 lg:px-12 lg:pb-24 lg:pt-16"
    >
      {progress ? <div className="mb-10 sm:mb-14">{progress}</div> : null}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <section className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1
            id="auth-entry-title"
            className="mt-2 max-w-3xl font-serif text-4xl font-bold leading-[1.15] text-ink sm:text-5xl"
          >
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[1rem] leading-7 text-muted-fg">{intro}</p>
          <div className="mt-8 max-w-2xl border-t-2 border-ink pt-7 sm:mt-10 sm:pt-8">
            {children}
          </div>
        </section>
        <aside
          aria-labelledby="auth-aside-title"
          className="border-t border-hairline pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1"
        >
          <h2 id="auth-aside-title" className="font-serif text-lg font-bold text-ink">
            {asideTitle}
          </h2>
          <div className="mt-3 text-sm leading-6 text-muted-fg">{aside}</div>
        </aside>
      </div>
    </main>
  );
}
