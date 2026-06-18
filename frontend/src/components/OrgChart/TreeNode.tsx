import { useState } from "react";
import type { OrgTreeNode } from "../../api/types";
import EmployeeCard from "./EmployeeCard";

interface Props {
  node: OrgTreeNode;
  searchTerm?: string;
}

function matchesSearch(node: OrgTreeNode, term: string): boolean {
  const haystack = `${node.fullName} ${node.title} ${node.department}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export default function TreeNode({ node, searchTerm = "" }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const isMatch = searchTerm.trim().length > 0 && matchesSearch(node, searchTerm);

  return (
    <div className="flex flex-col items-center">
      <EmployeeCard node={node} highlighted={isMatch} />

      {hasChildren && (
        <>
          {/* stem from the card down to the badge / row */}
          <div className="relative h-6 w-px bg-ink-200">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? `Show ${node.totalReportCount} hidden report(s)` : "Collapse this branch"}
              className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand font-mono text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-light"
            >
              {collapsed ? node.totalReportCount : "−"}
            </button>
          </div>

          {!collapsed && (
            <div className="flex">
              {node.children.map((child, idx) => (
                <div key={child.id} className="relative flex flex-col items-center px-5">
                  {/* horizontal bus segment - only contributes the part relevant to this child's position */}
                  <div
                    className="absolute top-0 h-px bg-ink-200"
                    style={{
                      left: idx === 0 ? "50%" : 0,
                      right: idx === node.children.length - 1 ? "50%" : 0,
                    }}
                  />
                  {/* stem up from the bus line into this child's card */}
                  <div className="h-6 w-px bg-ink-200" />
                  <TreeNode node={child} searchTerm={searchTerm} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
