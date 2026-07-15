"use client";

import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Pill } from "@/components/Pill";
import { TransferInstructions } from "../TransferInstructions";
import { useFunnelGuard } from "../useFunnelGuard";

const POINTS: { icon: string; title: string; body: string }[] = [
  {
    icon: "🔗",
    title: "რეფერალური ბმული ჯერ დეაქტივირებულია.",
    body: "დამტკიცების შემდეგ პერსონალური ბმული გააქტიურდება და შეძლებ გუნდის აწყობას.",
  },
  {
    icon: "🙈",
    title: "პროფილი ჯერ არ არის საჯარო.",
    body: "დელეგატი არ ჩანს პორტალსა და რეიტინგში, სანამ მონაცემები არ დადასტურდება.",
  },
  {
    icon: "✅",
    title: "დამტკიცების შემდეგ.",
    body: "ბმული გააქტიურდება, პროფილი გახდება საჯარო და გამოჩნდები დელეგატების რეიტინგში.",
  },
];

export default function PendingPage() {
  const { state, ready } = useFunnelGuard("pending");
  if (!ready || !state) return null;

  return (
    <main className="mx-auto max-w-xl px-6 pb-16 pt-10">
      <Card>
        <div className="text-center">
          <p className="text-5xl" aria-hidden>
            ⏳
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">შენი დელეგატის პროფილი განიხილება</h2>
          <div className="mt-2">
            <Pill status="pending" />
          </div>
          <p className="mx-auto mt-3 max-w-prose text-sm text-muted-fg">
            რეგისტრაცია დასრულებულია — ახლა შენი მონაცემები გადამოწმების პროცესშია. სუპერ-ადმინი
            ადასტურებს დელეგატის იურიდიულ ვერიფიკაციას.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {POINTS.map((p) => (
            <div key={p.icon} className="flex items-start gap-3">
              <span className="text-lg" aria-hidden>
                {p.icon}
              </span>
              <div>
                <p className="text-sm font-bold text-ink">{p.title}</p>
                <p className="text-sm text-muted-fg">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
        <TransferInstructions tier={state.tier} referenceCode={state.referenceCode} />
        <div className="mt-6">
          <ButtonLink href="/" className="w-full">
            მთავარი გვერდი
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
