import { useState, useRef, useEffect, useMemo, type MouseEvent } from "react";
import type { OrgTreeNode } from "../../api/types";
import TreeNode from "./TreeNode";
import { TreeContext } from "./TreeContext";
import { findEmployeePath, findEmployeeById, flattenTree } from "../../utils/treePathHelper";
import { getAvatarColor, getInitials } from "../../utils/avatarColor";

interface ConnectionLinesProps {
  roots: OrgTreeNode[];
  expandedNodeIds: Set<number>;
  scale: number;
}

function ConnectionLines({ roots, expandedNodeIds, scale }: ConnectionLinesProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const containerRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let active = true;
    const startTime = Date.now();
    const duration = 500; // run tracking loop for 500ms to match transition duration

    // Helper to calculate unscaled coordinates relative to the tree container
    const getLocalPos = (element: HTMLElement, container: HTMLElement) => {
      let x = 0;
      let y = 0;
      let curr = element;
      let foundContainer = false;

      while (curr) {
        if (curr === container) {
          foundContainer = true;
          break;
        }
        x += curr.offsetLeft || 0;
        y += curr.offsetTop || 0;
        curr = curr.offsetParent as HTMLElement;
      }

      if (foundContainer) {
        return {
          x,
          y,
          width: element.offsetWidth || 0,
          height: element.offsetHeight || 0,
        };
      }

      // Fallback to clientRect if offsetParent chain is broken
      const containerRect = container.getBoundingClientRect();
      const elemRect = element.getBoundingClientRect();
      return {
        x: (elemRect.left - containerRect.left) / scale,
        y: (elemRect.top - containerRect.top) / scale,
        width: elemRect.width / scale,
        height: elemRect.height / scale,
      };
    };

    const calculate = () => {
      if (!active) return;
      const svgElement = containerRef.current;
      if (!svgElement) return;

      const container = svgElement.parentElement;
      if (!container) return;

      const connections: Array<{ parentId: number; childId: number }> = [];
      const traverse = (node: OrgTreeNode) => {
        if (node.children && node.children.length > 0 && expandedNodeIds.has(node.id)) {
          node.children.forEach((child) => {
            connections.push({ parentId: node.id, childId: child.id });
            traverse(child);
          });
        }
      };
      roots.forEach(traverse);

      const calculatedPaths: string[] = [];
      connections.forEach(({ parentId, childId }) => {
        const parentCard = container.querySelector(`[data-card-id="${parentId}"]`) as HTMLElement;
        const childCard = container.querySelector(`[data-card-id="${childId}"]`) as HTMLElement;

        if (parentCard && childCard) {
          const parentLocal = getLocalPos(parentCard, container);
          const childLocal = getLocalPos(childCard, container);

          // Calculate horizontal L2R start and end points relative to the tree container
          const startX = parentLocal.x + parentLocal.width;
          const startY = parentLocal.y + parentLocal.height / 2;

          const endX = childLocal.x;
          const endY = childLocal.y + childLocal.height / 2;

          // Draw a smooth curved Bezier path
          const controlOffset = Math.max(24, (endX - startX) * 0.45);
          const cp1X = startX + controlOffset;
          const cp1Y = startY;
          const cp2X = endX - controlOffset;
          const cp2Y = endY;

          const pathD = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
          calculatedPaths.push(pathD);
        }
      });

      setPaths(calculatedPaths);
    };

    let rafId: number;
    const tick = () => {
      calculate();
      if (Date.now() - startTime < duration) {
        rafId = requestAnimationFrame(tick);
      }
    };

    // Start tracking loop
    tick();

    // Settle calculation at 550ms
    const timer = setTimeout(calculate, 550);

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [roots, expandedNodeIds, scale]);

  return (
    <svg
      ref={containerRef}
      className="absolute inset-0 pointer-events-none w-full h-full z-0 overflow-visible"
    >
      {paths.map((d, idx) => (
        <path
          key={idx}
          d={d}
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

interface Props {
  roots: OrgTreeNode[];
  searchTerm?: string;
  contentOpacity?: number;
}

export default function OrgTree({ roots, searchTerm: externalSearch, contentOpacity = 1 }: Props) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [internalSearch, setInternalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- States for the interactive org tree ---
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<"horizontal" | "vertical">("horizontal");

  // Initialize expanded state on mount/roots load: expand CEO/roots by default
  useEffect(() => {
    if (roots && roots.length > 0) {
      const initial = new Set<number>();
      roots.forEach((r) => initial.add(r.id));
      setExpandedNodeIds(initial);
    }
  }, [roots]);

  // Support both external search (from page) and internal floating search
  const searchTerm = externalSearch ?? internalSearch;

  // Flatten tree to support search dropdown matches
  const allEmployees = useMemo(() => flattenTree(roots), [roots]);
  const showSearchDropdown = searchOpen && internalSearch.trim().length > 0;
  const searchResults = showSearchDropdown
    ? allEmployees.filter((emp) =>
        emp.fullName.toLowerCase().includes(internalSearch.toLowerCase()) ||
        emp.title.toLowerCase().includes(internalSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(internalSearch.toLowerCase())
      ).slice(0, 5) // Limit to top 5 matches
    : [];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelRaw = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.08;
      const direction = e.deltaY < 0 ? 1 : -1;
      
      setScale((s) => {
        const newScale = s + direction * zoomFactor * s;
        return Math.max(0.15, Math.min(newScale, 3.0));
      });
    };

    container.addEventListener("wheel", handleWheelRaw, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheelRaw);
    };
  }, [roots]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest(".employee-detail-panel")) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.15, 3.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.15, 0.15));
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Center and fit a specific node and its subtree into the viewport
  const fitNode = (nodeId: number) => {
    const viewport = containerRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    const element = canvas.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    if (!element) return;

    const elemRect = element.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // Calculate dimensions relative to the canvas's unscaled, untranslated coordinates
    const relLeft = (elemRect.left - canvasRect.left) / scale;
    const relTop = (elemRect.top - canvasRect.top) / scale;
    const relWidth = elemRect.width / scale;
    const relHeight = elemRect.height / scale;

    const viewWidth = viewport.clientWidth;
    const viewHeight = viewport.clientHeight;

    const pad = 60;
    const targetScaleX = (viewWidth - pad * 2) / relWidth;
    const targetScaleY = (viewHeight - pad * 2) / relHeight;

    let targetScale = Math.min(targetScaleX, targetScaleY);
    targetScale = Math.max(0.25, Math.min(targetScale, 1.25));

    const relCenterX = relLeft + relWidth / 2;
    const relCenterY = relTop + relHeight / 2;

    const cX = canvas.clientWidth / 2;
    const cY = canvas.clientHeight / 2;

    const targetX = -(relCenterX - cX) * targetScale;
    const targetY = -(relCenterY - cY) * targetScale;

    setScale(targetScale);
    setPosition({ x: targetX, y: targetY });
  };

  // Dynamic layout selection and zoom-to-fit on selection change
  useEffect(() => {
    if (selectedNodeId === null) return;

    const viewport = containerRef.current;
    if (!viewport) return;

    const node = allEmployees.find((e) => e.id === selectedNodeId);
    if (node) {
      const viewWidth = viewport.clientWidth;
      const hasLargeSubtree = node.children && node.children.length > 3;
      const isNarrowScreen = viewWidth < 1024;
      const idealLayout = hasLargeSubtree || isNarrowScreen ? "vertical" : "horizontal";

      if (layoutMode !== idealLayout) {
        setLayoutMode(idealLayout);
        const timer = setTimeout(() => {
          fitNode(selectedNodeId);
        }, 150);
        return () => clearTimeout(timer);
      }
    }

    const timer = setTimeout(() => {
      fitNode(selectedNodeId);
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedNodeId, layoutMode, allEmployees]);

  // Toggle node expansion
  const toggleExpand = (nodeId: number, _siblingIds: number[]) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Handle selecting an employee from search results (with path auto-expansion)
  const handleSelectSearchEmployee = (empId: number) => {
    const path = findEmployeePath(roots, empId);
    if (path) {
      setExpandedNodeIds((prev) => {
        const next = new Set(prev);
        // Expand all managers along the path (exclude target if they aren't a manager/parent)
        path.forEach((node) => {
          if (node.id !== empId || (node.children && node.children.length > 0)) {
            next.add(node.id);
          }
        });
        return next;
      });

      // Select employee and center/scale view
      setSelectedNodeId(empId);
      setInternalSearch("");
      setSearchOpen(false);
      setScale(1.1); // zoom in slightly to focus
      setPosition({ x: 0, y: 30 }); // reset center
    }
  };

  // Fetch details of selected employee/manager
  const selectedEmployee = selectedNodeId !== null ? findEmployeeById(roots, selectedNodeId) : null;
  const selectedPath = selectedNodeId !== null ? findEmployeePath(roots, selectedNodeId) : null;

  return (
    <TreeContext.Provider
      value={{
        expandedNodeIds,
        toggleExpand,
        selectedNodeId,
        setSelectedNodeId,
        layoutMode,
      }}
    >
      <div className="relative h-full w-full overflow-hidden select-none bg-tree-canvas flex flex-row">
        
        {/* Main Canvas View */}
        <div className="flex-1 h-full w-full overflow-hidden relative">

          {/* ── Breadcrumb Bar (top-left) ── */}
          {selectedPath && selectedPath.length > 0 && (
            <div 
              className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-white/10 bg-slate-950/40 backdrop-blur-md text-[11px] text-white/80 font-medium shadow-xl"
              style={{ pointerEvents: "auto" }}
            >
              {selectedPath.map((item, idx) => (
                <span key={item.id} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-white/20 font-mono">&gt;</span>}
                  <button
                    onClick={() => setSelectedNodeId(item.id)}
                    className={`hover:text-white transition-colors duration-150 ${
                      item.id === selectedNodeId ? "text-amber-400 font-bold" : ""
                    }`}
                  >
                    {item.fullName}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ── Search bar (top-right) ── */}
          <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-1.5">
            <div
              className="flex items-center"
              style={{
                background: "rgba(255,255,255,0.13)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: "999px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.15)",
                width: searchOpen ? "220px" : "28px",
                height: "28px",
                overflow: "hidden",
                transition: "width 0.35s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              {/* Input */}
              <input
                ref={searchInputRef}
                value={internalSearch}
                onChange={(e) => setInternalSearch(e.target.value)}
                placeholder="Search employee..."
                className="search-glass-input min-w-0 bg-transparent outline-none text-xs font-medium"
                style={{
                  color: "rgba(255,255,255,0.95)",
                  caretColor: "rgba(255,255,255,0.95)",
                  opacity: searchOpen ? 1 : 0,
                  width: searchOpen ? "100%" : "0px",
                  padding: searchOpen ? "0 6px 0 12px" : "0",
                  transition: "opacity 0.25s ease, width 0.35s cubic-bezier(0.4,0,0.2,1)",
                  pointerEvents: searchOpen ? "auto" : "none",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              />

              {/* Clear button */}
              {searchOpen && internalSearch && (
                <button
                  onClick={() => setInternalSearch("")}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full mr-1 transition-all duration-150"
                  style={{ background: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.8)" }}
                >
                  <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Search icon */}
              <button
                onClick={() => {
                  const next = !searchOpen;
                  setSearchOpen(next);
                  if (next) {
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  } else {
                    setInternalSearch("");
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex shrink-0 items-center justify-center rounded-full transition-all duration-200 ml-auto"
                style={{
                  width: "28px",
                  height: "28px",
                  minWidth: "28px",
                  color: "rgba(255,255,255,0.95)",
                }}
                title={searchOpen ? "Close search" : "Search"}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            {/* ── Search Dropdown Results ── */}
            {searchResults.length > 0 && (
              <div 
                className="w-[220px] rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-lg shadow-2xl p-1.5 flex flex-col gap-0.5"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {searchResults.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleSelectSearchEmployee(emp.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-left"
                  >
                    <div 
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-inner"
                      style={{ backgroundColor: getAvatarColor(emp.fullName) }}
                    >
                      {getInitials(emp.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-white truncate">{emp.fullName}</p>
                      <p className="text-[8px] text-white/50 truncate">{emp.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom HUD */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1.5 shadow-lg">
            <button
              onClick={zoomOut}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-ink-100 text-ink-600 transition-colors text-sm font-bold"
              title="Zoom Out"
            >
              −
            </button>
            <span className="text-[10px] font-semibold text-ink-500 min-w-[36px] text-center font-mono">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-ink-100 text-ink-600 transition-colors text-sm font-bold"
              title="Zoom In"
            >
              +
            </button>
            <div className="h-4 w-[1px] bg-ink-200 mx-1" />
            <button
              onClick={resetZoom}
              className="px-2.5 py-1 text-[10px] font-semibold text-brand bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
              title="Reset Zoom"
            >
              Reset
            </button>
            <div className="h-4 w-[1px] bg-ink-200 mx-1" />
            <button
              onClick={() => setLayoutMode((m) => (m === "horizontal" ? "vertical" : "horizontal"))}
              className="px-2.5 py-1 text-[10px] font-semibold text-brand bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
              title="Switch Layout"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {layoutMode === "horizontal" ? "Vertical View" : "Horizontal View"}
            </button>
          </div>

          {/* Interactive canvas */}
          <div
            style={{
              opacity: contentOpacity,
              transition: "opacity 0.18s ease",
              height: "100%",
              width: "100%",
            }}
          >
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`h-full w-full overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <div
                ref={canvasRef}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.15s ease-out",
                }}
                className="flex h-full w-full items-center justify-center"
              >
                <div className={`flex relative ${layoutMode === "vertical" ? "flex-col items-start gap-12" : "min-w-fit justify-center gap-16"} p-20`}>
                  {layoutMode === "vertical" && (
                    <ConnectionLines
                      roots={roots}
                      expandedNodeIds={expandedNodeIds}
                      scale={scale}
                    />
                  )}
                  {roots.map((root) => (
                    <TreeNode key={root.id} node={root} searchTerm={searchTerm} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sliding Detail Side Panel (right side) ── */}
        {selectedEmployee && (
          <div 
            className="employee-detail-panel h-full w-80 shrink-0 border-l border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-2xl flex flex-col text-white transition-all duration-300 z-40 relative"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header / Profile summary */}
            <div className="p-5 border-b border-white/10 flex flex-col items-center text-center relative shrink-0">
              <button
                onClick={() => setSelectedNodeId(null)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                title="Close Panel"
              >
                ✕
              </button>

              {selectedEmployee.avatarUrl ? (
                <img
                  src={selectedEmployee.avatarUrl}
                  alt={selectedEmployee.fullName}
                  className="h-20 w-20 rounded-full object-cover shadow-2xl border-2 border-amber-400/40"
                />
              ) : (
                <div 
                  className="h-20 w-20 rounded-full flex items-center justify-center font-display text-2xl font-bold shadow-2xl border-2 border-amber-400/40 text-white"
                  style={{ backgroundColor: getAvatarColor(selectedEmployee.fullName) }}
                >
                  {getInitials(selectedEmployee.fullName)}
                </div>
              )}

              <h2 className="mt-3.5 font-display text-base font-bold tracking-tight">{selectedEmployee.fullName}</h2>
              <p className="text-xs text-cyan-400 font-semibold mt-0.5">{selectedEmployee.title}</p>
              
              <div className="mt-3 px-3 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: selectedEmployee.departmentColor + "25", color: selectedEmployee.departmentColor, border: `1px solid ${selectedEmployee.departmentColor}40` }}>
                {selectedEmployee.department}
              </div>
            </div>

            {/* Direct Reports Panel Section */}
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Direct Reports</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/5 text-amber-400">{selectedEmployee.children.length} reports</span>
              </div>

              {selectedEmployee.children && selectedEmployee.children.length > 0 ? (
                <div className="flex flex-col gap-2 mt-3.5">
                  {selectedEmployee.children.map((report) => {
                    const isReportManager = report.children && report.children.length > 0;
                    return (
                      <button
                        key={report.id}
                        onClick={() => setSelectedNodeId(report.id)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left"
                      >
                        <div 
                          className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner shrink-0 text-white"
                          style={{ backgroundColor: getAvatarColor(report.fullName) }}
                        >
                          {getInitials(report.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate text-white">{report.fullName}</p>
                          <p className="text-[9px] text-white/55 truncate">{report.title}</p>
                        </div>
                        {isReportManager && (
                          <div className="text-[9px] font-bold font-mono text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                            Manager ({report.children.length})
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-white/35 text-center mt-8">Individual Contributor (no direct reports)</p>
              )}
            </div>
          </div>
        )}
      </div>
    </TreeContext.Provider>
  );
}
