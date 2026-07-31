"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { inputClasses } from "@/components/Field";
import { LeaderRow } from "@/components/LeaderRow";
import { Select } from "@/components/Select";
import { formatCountKa } from "@/lib/format";
import type { RankedDelegate } from "@/lib/ranking";
import type { Region } from "@/lib/supabase/public";

/**
 * Ranking + filters (owner fix #3): the delegates index retired into რეიტინგი,
 * so the region/name filters that only existed there live here now. Ranks come
 * from rankDelegates() over the FULL list, so filtering never renumbers anyone.
 */
export function LeaderboardDirectory({
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
          className={`${inputClasses} min-w-[220px] flex-1`}
          placeholder="ძებნა სახელით..."
          aria-label="ძებნა სახელით"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          className="max-w-[280px]"
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
        </Select>
      </div>
      {filtered.length > 0 ? (
        <ol className="list-none" role="list">
          {filtered.map((d) => (
            <li key={d.id}>
              <LeaderRow delegate={d} />
            </li>
          ))}
        </ol>
      ) : (
        <Card>
          <div className="text-center text-muted-fg">
            ამ პარამეტრებით დელეგატი ვერ მოიძებნა. სცადე სხვა ძებნა ან აირჩიე „ყველა მხარე“.
          </div>
        </Card>
      )}
      <p
        className="mt-6 border-t-2 border-ink pt-3 text-center text-sm text-muted-fg"
        data-testid="delegate-count"
      >
        ნაჩვენებია {formatCountKa(filtered.length)} დელეგატი
      </p>
    </div>
  );
}
