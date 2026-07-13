export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV === "production") return null;
  return (
    <div className="bg-gold/15 px-4 py-1.5 text-center text-xs font-semibold text-ink">
      სადემონსტრაციო გარემო — მონაცემები ფიქტიურია
    </div>
  );
}
