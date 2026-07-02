import { Handle, Position } from "@xyflow/react";
import type { OrgTreeNode } from "../../api/types";

interface EmployeeNodeProps {
  data: {
    employee: OrgTreeNode;
    direction: "TB" | "LR";
    isExpanded: boolean;
    hasChildren: boolean;
    onToggleExpand?: (id: number) => void;
  };
  selected?: boolean;
}

export default function EmployeeNode({ data, selected }: EmployeeNodeProps) {
  const { employee, direction, isExpanded, hasChildren, onToggleExpand } = data;

  const targetPosition = direction === "TB" ? Position.Top : Position.Left;
  const sourcePosition = direction === "TB" ? Position.Bottom : Position.Right;

  // Generate initials for avatar placeholder
  const getInitials = (name: string) => {
    if (!name) return "EE";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={`relative flex items-center gap-3.5 rounded-xl border bg-white p-3.5 shadow-card transition-all duration-300 w-[270px] ${
        selected
          ? "border-brand ring-2 ring-brand/15 shadow-cardHover scale-105"
          : "border-ink-200 hover:border-ink-300 hover:shadow-cardHover"
      }`}
      style={{
        borderLeft: `4px solid ${employee.departmentColor || "#94A3B8"}`,
        borderColor: selected ? undefined : `${employee.departmentColor || "#94A3B8"}35`,
        boxShadow: selected
          ? "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
          : "0 4px 18px -3px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)"
      }}
    >
      {/* Target Handle (Incoming reporting line) */}
      <Handle
        type="target"
        position={targetPosition}
        style={{ background: employee.departmentColor || "#94A3B8", width: 8, height: 8 }}
        className="!border-white"
      />

      {/* Avatar / Photo */}
      <div className="relative shrink-0">
        {employee.avatarUrl ? (
          <img
            src={employee.avatarUrl}
            alt={employee.fullName}
            className="h-11 w-11 rounded-full object-cover border border-ink-100"
          />
        ) : (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold text-white shadow-inner"
            style={{
              background: `linear-gradient(135deg, ${employee.departmentColor || "#94A3B8"} 0%, ${
                adjustColorBrightness(employee.departmentColor || "#94A3B8", -20)
              } 100%)`,
            }}
          >
            {getInitials(employee.fullName)}
          </div>
        )}
      </div>

      {/* Details info */}
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-extrabold text-ink-900 leading-tight truncate">
          {employee.fullName}
        </p>
        <p className="text-[11px] text-ink-600 leading-snug mt-0.5 truncate">
          {employee.title}
        </p>
        
        {/* Department Badge */}
        <div className="mt-1.5 flex">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase"
            style={{
              backgroundColor: `${employee.departmentColor || "#94A3B8"}15`,
              color: employee.departmentColor || "#64748B",
            }}
          >
            {employee.department || "General"}
          </span>
        </div>
      </div>

      {/* Expand/Collapse Button (positioned on the bottom or right handle line) */}
      {hasChildren && onToggleExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(employee.id);
          }}
          className={`absolute z-10 flex items-center justify-center rounded-full bg-white border border-ink-200 text-ink-600 shadow-sm transition-all hover:bg-ink-100 hover:text-ink-900 hover:scale-110 active:scale-95 ${
            direction === "TB"
              ? "left-1/2 -bottom-3 -translate-x-1/2 h-6 px-1.5 min-w-[24px]"
              : "top-1/2 -right-3 -translate-y-1/2 h-6 px-1.5 min-w-[24px]"
          }`}
        >
          <span className="text-[9px] font-bold leading-none select-none">
            {isExpanded ? "−" : `+${employee.totalReportCount}`}
          </span>
        </button>
      )}

      {/* Source Handle (Outgoing reports) */}
      <Handle
        type="source"
        position={sourcePosition}
        style={{
          background: employee.departmentColor || "#94A3B8",
          width: 8,
          height: 8,
          // Hide source handle if collapsed, so we don't render floating handles
          visibility: isExpanded ? "visible" : "hidden",
        }}
        className="!border-white"
      />
    </div>
  );
}

/**
 * Helper to adjust hex color brightness for initials gradient
 */
function adjustColorBrightness(hex: string, percent: number): string {
  // Strip the # if present
  let color = hex.replace(/^\s*#|\s*$/g, "");
  
  if (color.length === 3) {
    color = color.replace(/(.)/g, "$1$1");
  }

  let r = parseInt(color.substr(0, 2), 16);
  let g = parseInt(color.substr(2, 2), 16);
  let b = parseInt(color.substr(4, 2), 16);

  r = Math.max(0, Math.min(255, r + (r * percent) / 100));
  g = Math.max(0, Math.min(255, g + (g * percent) / 100));
  b = Math.max(0, Math.min(255, b + (b * percent) / 100));

  const rHex = Math.round(r).toString(16).padStart(2, "0");
  const gHex = Math.round(g).toString(16).padStart(2, "0");
  const bHex = Math.round(b).toString(16).padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`;
}
