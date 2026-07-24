import { isProductionEnv } from "@/lib/env";

export function DemoBanner() {
  if (isProductionEnv()) return null;
  return (
    <div className="border-b border-ink bg-ink px-4 py-1.5 text-center text-[0.76rem] text-paper">
      სადემონსტრაციო გარემო — მონაცემები ფიქტიურია
    </div>
  );
}
