type Status = "draft" | "profile_completed" | "active_member" | "pending" | "approved" | "rejected";

const config: Record<Status, { label: string; className: string }> = {
  draft: { label: "მონახაზი", className: "bg-surface text-muted-fg" },
  profile_completed: { label: "პროფილი შევსებულია", className: "bg-info/10 text-info" },
  active_member: { label: "აქტიური წევრი", className: "bg-ok/10 text-ok" },
  pending: { label: "განხილვის პროცესში", className: "bg-warn/10 text-warn" },
  approved: { label: "დამტკიცებული", className: "bg-ok/10 text-ok" },
  rejected: { label: "უარყოფილი", className: "bg-danger/10 text-danger" },
};

export function Pill({ status }: { status: Status }) {
  const { label, className } = config[status];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
