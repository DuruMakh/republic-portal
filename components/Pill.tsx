type Status =
  | "draft"
  | "registered"
  | "profile_completed"
  | "active_member"
  | "pending"
  | "approved"
  | "rejected";

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  draft: { label: "მონახაზი", className: "bg-surface text-muted-fg" },
  registered: { label: "რეგისტრირებული", className: "bg-surface text-muted-fg" },
  // Mirror lib/cabinet.ts's TEAM_STATUS_LABELS (kept as separate literals here, not
  // imported, so this generic primitive doesn't couple to the cabinet domain) — update
  // both together if the team-status vocabulary changes again.
  profile_completed: { label: "წევრი", className: "bg-info/10 text-info" },
  active_member: { label: "აქტიური", className: "bg-ok/10 text-ok" },
  pending: { label: "განხილვის პროცესში", className: "bg-warn/10 text-warn" },
  approved: { label: "დამტკიცებული", className: "bg-ok/10 text-ok" },
  rejected: { label: "უარყოფილი", className: "bg-danger/10 text-danger" },
};

export function Pill({ status, label }: { status: Status; label?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      {label ?? config.label}
    </span>
  );
}
