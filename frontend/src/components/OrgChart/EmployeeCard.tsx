import type { OrgTreeNode } from "../../api/types";
import { getAvatarColor, getInitials } from "../../utils/avatarColor";

interface Props {
  node: OrgTreeNode;
  highlighted?: boolean;
}

import { useTreeContext } from "./TreeContext";

export default function EmployeeCard({ node, highlighted }: Props) {
  const avatarColor = getAvatarColor(node.fullName);
  const deptColor = node.departmentColor || "#CBD5E1";
  
  const { selectedNodeId, setSelectedNodeId } = useTreeContext();
  const isSelected = selectedNodeId === node.id;
  const isManager = node.children && node.children.length > 0;

  const cardClass = `w-48 shrink-0 rounded-2xl bg-slate-950/20 backdrop-blur-[20px] p-3 border transition-all duration-300 hover:scale-[1.02] hover:bg-slate-950/30 cursor-pointer ${
    isSelected
      ? "border-amber-400 ring-2 ring-amber-400/20 scale-[1.01]"
      : highlighted
      ? "border-cyan-400 ring-2 ring-cyan-400/25"
      : "border-white/15"
  }`;

  const cardStyleAttr = {
    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)",
  };

  return (
    <div 
      className={cardClass} 
      style={cardStyleAttr}
      onClick={() => setSelectedNodeId(node.id)}
    >
      <div className="flex items-center gap-2.5 py-0.5">
        {node.avatarUrl ? (
          <img
            src={node.avatarUrl}
            alt={node.fullName}
            className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
            style={{ boxShadow: `0 0 0 1.5px ${deptColor}30` }}
          />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-bold text-white shadow-sm"
            style={{ 
              backgroundColor: avatarColor,
              boxShadow: `0 0 0 1.5px ${deptColor}30`
            }}
          >
            {getInitials(node.fullName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-white font-bold font-display text-xs leading-tight truncate" title={node.fullName}>
            {node.fullName}
          </p>
          <p className="truncate text-[9px] font-semibold text-cyan-400 mt-0.5">
            {node.title}
          </p>
          {isManager && (
            <p className="text-[8px] font-medium text-white/50 mt-0.5 flex items-center gap-1">
              <span>👥</span> {node.children.length} reports
            </p>
          )}
        </div>
      </div>
    </div>
  );
}



