import type { OrgTreeNode } from "../../api/types";
import { getAvatarColor, getInitials } from "../../utils/avatarColor";

interface Props {
  node: OrgTreeNode;
  highlighted?: boolean;
}

export default function EmployeeCard({ node, highlighted }: Props) {
  const avatarColor = getAvatarColor(node.fullName);

  return (
    <div
      className={`w-64 shrink-0 rounded-xl border bg-white p-4 shadow-card transition-shadow hover:shadow-cardHover ${
        highlighted ? "border-brand-light ring-1 ring-brand-light/40" : "border-ink-200"
      }`}
    >
      <div className="flex items-start gap-3">
        {node.avatarUrl ? (
          <img
            src={node.avatarUrl}
            alt={node.fullName}
            className="h-11 w-11 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(node.fullName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-ink-900" title={node.fullName}>
            {node.fullName}
          </p>
          <p className="truncate text-xs text-ink-600">{node.title}</p>
          <p className="truncate text-xs text-ink-400">{node.company}</p>
        </div>
      </div>

      {node.department && (
        <span
          className="mt-3 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: `${node.departmentColor}1A`, color: node.departmentColor }}
        >
          {node.department}
        </span>
      )}
    </div>
  );
}
