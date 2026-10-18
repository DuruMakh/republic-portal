import { isProductionEnv } from "@/lib/env";
import { useCopy } from "@/lib/i18n/copy";

export function DemoBanner() {
  const t = useCopy();
  if (isProductionEnv()) return null;
  return (
    <div className="border-b border-ink bg-ink px-4 py-1.5 text-center text-[0.76rem] text-paper">
      {t("სადემონსტრაციო გარემო — მონაცემები ფიქტიურია")}
    </div>
  );
}
