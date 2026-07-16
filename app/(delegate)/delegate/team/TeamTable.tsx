"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { inputClasses } from "@/components/Field";
import { Pill } from "@/components/Pill";
import {
  formatDateKa,
  TEAM_STATUS_LABELS,
  type TeamMember,
  type TeamMemberStatus,
} from "@/lib/cabinet";

type StatusFilter = "all" | TeamMemberStatus;

export function TeamTable({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (q && !`${m.firstName} ${m.lastName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [members, query, status]);

  return (
    <Card
      header={
        <>
          <h3 className="text-base font-bold text-ink">წევრების სია</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputClasses} border-line`}
              style={{ width: 220 }}
              placeholder="ძებნა სახელით ან გვარით…"
              aria-label="ძებნა სახელით ან გვარით"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={`${inputClasses} border-line`}
              aria-label="სტატუსის ფილტრი"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">ყველა სტატუსი</option>
              <option value="active_member">აქტიური</option>
              <option value="profile_completed">რეგისტრირებული</option>
            </select>
          </div>
        </>
      }
      padded={false}
    >
      {members.length === 0 ? (
        <div className="p-6 text-sm" data-testid="team-empty">
          <p className="font-semibold text-ink">ჯერ არავინ დარეგისტრირებულა შენი ბმულით</p>
          <p className="mt-1 text-muted-fg">გააზიარე ბმული და გუნდი აქ გამოჩნდება.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-sm text-muted-fg" data-testid="team-no-results">
          ვერაფერი მოიძებნა ამ ფილტრით.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-fg">
                <th className="px-6 py-3 font-semibold">წევრი</th>
                <th className="px-6 py-3 font-semibold">რეგისტრაციის თარიღი</th>
                <th className="px-6 py-3 font-semibold">სტატუსი</th>
              </tr>
            </thead>
            <tbody data-testid="team-rows">
              {filtered.map((m, i) => (
                <tr
                  key={`${m.firstName}-${m.lastName}-${m.registeredAt}-${i}`}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-6 py-3 font-semibold text-ink">
                    {m.firstName} {m.lastName}
                  </td>
                  <td className="px-6 py-3">{formatDateKa(m.registeredAt)}</td>
                  <td className="px-6 py-3">
                    <Pill status={m.status} label={TEAM_STATUS_LABELS[m.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
