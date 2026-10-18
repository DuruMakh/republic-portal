"use client";
import { formatDate } from "@/lib/i18n/format";

import { useLocale } from "next-intl";

import { useCopy } from "@/lib/i18n/copy";

import { useMemo, useState } from "react";
import {
  CabinetPanel,
  CabinetSectionLabel,
  cabinetCellClass,
  cabinetRowClass,
  cabinetThClass,
} from "@/components/CabinetPage";
import { Caps } from "@/components/Caps";
import { DataTable } from "@/components/DataTable";
import { Pill } from "@/components/Pill";
import { TEAM_STATUS_LABELS, type TeamMember } from "@/lib/cabinet";

export function TeamTable({ members }: { members: TeamMember[] }) {
  const t = useCopy();
  const locale = useLocale() === "en" ? "en" : "ka";
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !`${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, query]);

  return (
    <CabinetPanel className="md:px-10">
      <CabinetSectionLabel
        aside={
          <input
            className="h-10 w-full max-w-[300px] border-0 border-b border-ink bg-transparent p-0 text-[16px] text-ink placeholder:text-secondary focus:border-brand focus-visible:outline-none"
            placeholder={t("ძებნა სახელით ან გვარით…")}
            aria-label={t("ძებნა სახელით ან გვარით")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        {t("წევრების სია")}
      </CabinetSectionLabel>
      {members.length === 0 ? (
        <div className="pt-6" data-testid="team-empty">
          <p className="m-0 font-serif text-[18px] font-semibold text-ink">
            {t("ჯერ არავინ დარეგისტრირებულა შენი ბმულით")}
          </p>
          <p className="mt-1.5 mb-0 text-[15px] text-secondary">
            {t("გააზიარე ბმული და გუნდი აქ გამოჩნდება.")}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="m-0 pt-6 text-[15px] text-secondary" data-testid="team-no-results">
          {t("ვერაფერი მოიძებნა ამ ფილტრით.")}
        </p>
      ) : (
        <div className="mt-2">
          <DataTable
            bodyTestId="team-rows"
            head={
              <>
                {[t("წევრი"), t("რეგისტრაციის თარიღი"), t("სტატუსი")].map((label) => (
                  <th key={label} scope="col" className={cabinetThClass}>
                    <Caps>{label}</Caps>
                  </th>
                ))}
              </>
            }
          >
            {filtered.map((m, i) => (
              <tr
                key={`${m.firstName}-${m.lastName}-${m.registeredAt}-${i}`}
                className={cabinetRowClass}
              >
                <td className={`${cabinetCellClass} font-semibold`}>
                  {m.firstName} {m.lastName}
                </td>
                <td className={`${cabinetCellClass} font-serif text-secondary`}>
                  {formatDate(m.registeredAt, locale)}
                </td>
                <td className={cabinetCellClass}>
                  <Pill status={m.status} label={t(TEAM_STATUS_LABELS[m.status])} />
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </CabinetPanel>
  );
}
