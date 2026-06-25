import type { OrgTreeNode } from "../../api/types";
import EmployeeCard from "./EmployeeCard";
import { useTreeContext } from "./TreeContext";

interface Props {
  node: OrgTreeNode;
  searchTerm?: string;
  depth?: number;
  siblingIds?: number[];
}

function matchesSearch(node: OrgTreeNode, term: string): boolean {
  const haystack = `${node.fullName} ${node.title} ${node.department}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

export default function TreeNode({ node, searchTerm = "", depth = 0, siblingIds = [] }: Props) {
  const { expandedNodeIds, toggleExpand, layoutMode } = useTreeContext();
  const hasChildren = node.children && node.children.length > 0;
  const isMatch = searchTerm.trim().length > 0 && matchesSearch(node, searchTerm);

  // Connection line color for Glass Dark
  const lineClass = "bg-white/45";

  // Expand/collapse button style for Glass Dark (glass circle style, no solid black background)
  const btnClass = "absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/40 backdrop-blur-[10px] border border-white/15 font-mono text-[11px] font-bold text-white/80 shadow-lg transition-all hover:scale-110 hover:border-cyan-400 hover:text-white hover:bg-slate-950/60 z-10";

  const isExpanded = expandedNodeIds.has(node.id);
  const use2Column = node.children.length > 3 && node.children.every(c => c.children.length === 0);

  if (layoutMode === "vertical") {
    return (
      <div className="flex items-center gap-9 relative" data-node-id={node.id}>
        {/* Card wrapper to position the toggle button (pr-3 gives layout space so button is not cut off) */}
        <div className="relative pr-3" data-card-id={node.id}>
          <EmployeeCard node={node} highlighted={isMatch} />
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleExpand(node.id, siblingIds)}
              title={isExpanded ? "Collapse this branch" : `Show reports`}
              className="absolute right-3 top-1/2 translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/40 backdrop-blur-[10px] border border-white/15 font-mono text-[11px] font-bold text-white/80 shadow-lg transition-all hover:scale-110 hover:border-cyan-400 hover:text-white hover:bg-slate-950/60 z-10"
            >
              {isExpanded ? "−" : "+"}
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col gap-6 relative animate-expand-right">
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                searchTerm={searchTerm}
                depth={depth + 1}
                siblingIds={node.children.filter(x => x.id !== child.id).map(x => x.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Horizontal View Rendering (unchanged top-down) ---
  return (
    <div
      data-node-id={node.id}
      className="flex flex-col items-center"
    >
      <div className="relative" data-card-id={node.id}>
        <EmployeeCard node={node} highlighted={isMatch} />
      </div>

      {hasChildren && (
        <>
          {/* stem from the card down to the badge / row */}
          <div className={`relative h-6 w-px ${lineClass}`}>
            <button
              type="button"
              onClick={() => toggleExpand(node.id, siblingIds)}
              title={isExpanded ? "Collapse this branch" : `Show reports`}
              className={btnClass}
            >
              {isExpanded ? "−" : "+"}
            </button>
          </div>

          {isExpanded && (
            use2Column ? (
              <div className="flex flex-col items-center relative w-full animate-expand-down">
                {(() => {
                  const rows: OrgTreeNode[][] = [];
                  for (let i = 0; i < node.children.length; i += 2) {
                    rows.push(node.children.slice(i, i + 2));
                  }
                  return rows.map((row, idx) => (
                    <div key={idx} className="flex justify-center gap-16 w-full py-3 relative">
                      {/* Center vertical spine segment */}
                      <div
                        className={`absolute w-px ${lineClass}`}
                        style={{
                          left: "50%",
                          top: idx === 0 ? 0 : "-12px",
                          bottom: idx === rows.length - 1 ? "50%" : "-12px",
                        }}
                      />

                      {/* Left Column Slot */}
                      <div className="w-48 flex justify-end relative">
                        {row[0] && (
                          <>
                            {/* Horizontal connector to center spine */}
                            <div
                              className={`absolute h-px ${lineClass}`}
                              style={{
                                right: "-32px",
                                width: "32px",
                                top: "50%",
                              }}
                            />
                            <TreeNode 
                              node={row[0]} 
                              searchTerm={searchTerm} 
                              depth={depth + 1} 
                              siblingIds={node.children.filter(x => x.id !== row[0].id).map(x => x.id)}
                            />
                          </>
                        )}
                      </div>

                      {/* Right Column Slot */}
                      <div className="w-48 flex justify-start relative">
                        {row[1] && (
                          <>
                            {/* Horizontal connector to center spine */}
                            <div
                              className={`absolute h-px ${lineClass}`}
                              style={{
                                left: "-32px",
                                width: "32px",
                                top: "50%",
                              }}
                            />
                            <TreeNode 
                              node={row[1]} 
                              searchTerm={searchTerm} 
                              depth={depth + 1} 
                              siblingIds={node.children.filter(x => x.id !== row[1].id).map(x => x.id)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="flex animate-expand-down">
                {node.children.map((child, idx) => (
                  <div key={child.id} className="relative flex flex-col items-center px-3">
                    {/* horizontal bus segment - only contributes the part relevant to this child's position */}
                    <div
                      className={`absolute top-0 h-px ${lineClass}`}
                      style={{
                        left: idx === 0 ? "50%" : 0,
                        right: idx === node.children.length - 1 ? "50%" : 0,
                      }}
                    />
                    {/* stem up from the bus line into this child's card */}
                    <div className={`h-6 w-px ${lineClass}`} />
                    <TreeNode 
                      node={child} 
                      searchTerm={searchTerm} 
                      depth={depth + 1} 
                      siblingIds={node.children.filter(x => x.id !== child.id).map(x => x.id)}
                    />
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}


