import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { Employee } from "../../api/types";

// HSL initials avatar color helper
function getInitialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

interface RoleNodeProps {
  data: {
    level: number;
    title: string;
    description: string;
    direction: "TB" | "LR";
    isSelected: boolean;
    employees: Employee[];
    status?: "next" | "default";
    loggedInEmail?: string;
  };
}

const RoleNode: React.FC<RoleNodeProps> = ({ data }) => {
  const isVertical = data.direction === "TB";
  const targetPos = isVertical ? Position.Bottom : Position.Left;
  const sourcePos = isVertical ? Position.Top : Position.Right;

  // Styling based on status - clean white card always, only border changes on selection
  let borderClass = "border-ink-200 bg-white hover:border-ink-300";
  let badgeClass = "bg-brand text-white";
  let statusLabel = `LEVEL ${data.level}`;

  if (data.isSelected) {
    borderClass = "border-blue-500 bg-white ring-2 ring-blue-400/20";
  }

  return (
    <div className={`px-4 py-3.5 rounded-xl border text-left shadow-lg transition-all duration-300 w-64 ${borderClass}`}>
      {/* Target connection point */}
      {data.level > 1 && (
        <Handle type="target" position={targetPos} className="!w-2 !h-2 !bg-ink-300 border-none" />
      )}

      {/* Header Level Badge */}
      <div className="flex items-center justify-between gap-2 border-b border-ink-150 pb-2 mb-2">
        <span className={`text-[8px] font-extrabold tracking-wide uppercase px-2 py-0.5 rounded leading-none shadow-sm ${badgeClass}`}>
          {statusLabel}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-ink-400">
          Career Step
        </span>
      </div>

      {/* Role Title */}
      <h5 className="text-[11px] font-extrabold text-ink-900 leading-snug truncate" title={data.title}>
        {data.title}
      </h5>

      {/* Mapped employees in this role */}
      <div className="mt-2.5 pt-2 border-t border-ink-100 space-y-1.5">
        <p className="text-[8px] font-extrabold uppercase tracking-widest text-ink-400 leading-none">
          Current Staff ({data.employees.length})
        </p>

        {data.employees.length > 0 ? (
          <div className="space-y-1.5 max-h-[110px] overflow-y-auto nowheel nodrag scrollbar-none select-none">
            {data.employees.map((emp) => {
              const isMe = emp.email?.toLowerCase() === data.loggedInEmail?.toLowerCase();
              return (
                <div key={emp.id} className="flex items-center gap-2 bg-ink-50/50 rounded-lg p-1.5 border border-ink-100/50">
                  {emp.avatarUrl ? (
                    <img
                      src={emp.avatarUrl}
                      alt={emp.fullName}
                      className="h-5.5 w-5.5 rounded-full object-cover border border-ink-150 shrink-0"
                    />
                  ) : (
                    <div
                      className="flex h-5.5 w-5.5 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm shrink-0"
                      style={{ backgroundColor: getInitialsColor(emp.fullName) }}
                    >
                      {emp.fullName
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[9px] font-extrabold text-ink-900 truncate leading-none">{emp.fullName}</p>
                      {isMe && (
                        <span className="bg-emerald-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded leading-none">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[8px] font-semibold text-ink-400 truncate mt-0.5 leading-none">
                      {emp.email || `${emp.fullName.toLowerCase().replace(/\s+/g, "")}@company.com`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[8px] font-bold text-ink-400 italic">No employees assigned</p>
        )}
      </div>

      {/* Source connection point */}
      <Handle type="source" position={sourcePos} className="!w-2 !h-2 !bg-ink-300 border-none" />
    </div>
  );
};

export default RoleNode;
