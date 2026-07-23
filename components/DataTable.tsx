import type { ReactNode } from "react";

/**
 * Shared cabinet table shell (spec §3.3, §3.7): the delegate team table and the
 * billing history table rendered byte-identical scaffolding — this owns the
 * wrapper, header row and cell classes so they stay in sync. Callers supply the
 * header cells and body rows; the surrounding Card, empty states and filters stay
 * with each caller. Server-safe (no hooks) — usable from server and client alike.
 */
export const tableThClass =
  "pb-2 border-b-2 border-ink text-left text-[0.74rem] font-bold tracking-[.1em] text-muted-fg";
export const tableRowClass = "border-b border-hairline";
export const tableCellClass = "py-2.5 text-[0.86rem]";

export function DataTable({
  head,
  bodyTestId,
  children,
}: {
  head: ReactNode;
  bodyTestId?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-fg">
            {head}
          </tr>
        </thead>
        <tbody data-testid={bodyTestId}>{children}</tbody>
      </table>
    </div>
  );
}
