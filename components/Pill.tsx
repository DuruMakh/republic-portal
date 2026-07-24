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
  profile_completed: { label: "წევრი", className: "bg-ink/5 text-ink" },
  active_member: { label: "აქტიური", className: "bg-ok/10 text-ok-deep" },
  pending: { label: "განხილვის პროცესში", className: "bg-warn/10 text-warn-deep" },
  approved: { label: "დამტკიცებული", className: "bg-ok/10 text-ok-deep" },
  rejected: { label: "უარყოფილი", className: "bg-brand/10 text-brand" },
};

export function Pill({ status, label }: { status: Status; label?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[0.74rem] font-bold tracking-[.06em] ${config.className}`}
    >
      {label ?? config.label}
    </span>
  );
}
