"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/Button";
import type { MemberStatusRow } from "@/lib/supabase/types";

/** Export honors the active filters; the IDs checkbox exists only for super_admin. */
export function ExportControls({
  search,
  regionId,
  status,
  canIncludeIds,
}: {
  search: string | undefined;
  regionId: number | undefined;
  status: MemberStatusRow | undefined;
  canIncludeIds: boolean;
}) {
  const [includeIds, setIncludeIds] = useState(false);
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (regionId) params.set("regionId", String(regionId));
  if (status) params.set("status", status);
  if (canIncludeIds && includeIds) params.set("includeIds", "1");

  return (
    <div className="flex items-center gap-4">
      {canIncludeIds ? (
        <label className="flex items-center gap-2 text-sm text-muted-fg">
          <input
            type="checkbox"
            checked={includeIds}
            onChange={(e) => setIncludeIds(e.target.checked)}
          />
          პირადი ნომრების ჩართვა
        </label>
      ) : null}
      <a
        href={`/admin/members/export?${params.toString()}`}
        className={buttonClasses("dark", "sm")}
      >
        ექსპორტი (CSV)
      </a>
    </div>
  );
}
