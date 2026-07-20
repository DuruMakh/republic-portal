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
  profile_completed: { label: "პროფილი შევსებულია", className: "bg-info/10 text-info" },
  active_member: { label: "აქტიური წევრი", className: "bg-ok/10 text-ok" },
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
