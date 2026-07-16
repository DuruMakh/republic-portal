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

export function PendingExplainer() {
  return (
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
  );
}
