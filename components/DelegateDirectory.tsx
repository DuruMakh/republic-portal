"use client";

import { useMemo, useState } from "react";
import { DelegateCard } from "@/components/DelegateCard";
import { inputClasses } from "@/components/Field";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";
import type { Region } from "@/lib/supabase/public";

export function DelegateDirectory({
  delegates,
  regions,
}: {
  delegates: RankedDelegate[];
  regions: Region[];
}) {
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return delegates.filter((d) => {
      const name = `${d.first_name} ${d.last_name}`.toLowerCase();
      const okName = !q || name.includes(q);
      const okRegion = !regionId || String(d.region_id) === regionId;
      return okName && okRegion;
    });
  }, [delegates, query, regionId]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          className={`${inputClasses} min-w-[220px] flex-1 border-line`}
          placeholder="ძებნა სახელით..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${inputClasses} max-w-[280px] border-line bg-white`}
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          aria-label="მხარე"
        >
          <option value="">ყველა მხარე</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name_ka}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-sm text-muted-fg" data-testid="delegate-count">
        ნაჩვენებია {formatCountKa(filtered.length)} დელეგატი
      </p>
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DelegateCard key={d.id} delegate={d} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-white p-8 text-center text-muted-fg shadow-sm">
          ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე „ყველა მხარე“.
        </div>
      )}
    </div>
  );
}
