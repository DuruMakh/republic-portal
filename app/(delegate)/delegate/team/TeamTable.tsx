"use client";

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
import { formatDateKa, TEAM_STATUS_LABELS, type TeamMember } from "@/lib/cabinet";

export function TeamTable({ members }: { members: TeamMember[] }) {
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
            placeholder="ძებნა სახელით ან გვარით…"
            aria-label="ძებნა სახელით ან გვარით"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        წევრების სია
      </CabinetSectionLabel>
      {members.length === 0 ? (
        <div className="pt-6" data-testid="team-empty">
          <p className="m-0 font-serif text-[18px] font-semibold text-ink">
            ჯერ არავინ დარეგისტრირებულა შენი ბმულით
          </p>
          <p className="mt-1.5 mb-0 text-[15px] text-secondary">
            გააზიარე ბმული და გუნდი აქ გამოჩნდება.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="m-0 pt-6 text-[15px] text-secondary" data-testid="team-no-results">
          ვერაფერი მოიძებნა ამ ფილტრით.
        </p>
      ) : (
        <div className="mt-2">
          <DataTable
            bodyTestId="team-rows"
            head={
              <>
                {["წევრი", "რეგისტრაციის თარიღი", "სტატუსი"].map((label) => (
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
                  {formatDateKa(m.registeredAt)}
                </td>
                <td className={cabinetCellClass}>
                  <Pill status={m.status} label={TEAM_STATUS_LABELS[m.status]} />
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </CabinetPanel>
  );
}
