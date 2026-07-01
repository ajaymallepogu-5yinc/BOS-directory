import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Background,
  useReactFlow,
  Panel,
  type Connection,
} from "@xyflow/react";
import { fetchDepartmentTree, fetchDepartments, updateEmployeeManager } from "../api/employeeApi";
import type { OrgTreeNode, Department } from "../api/types";
import { getLayoutedElements } from "../utils/treeLayout";
import EmployeeNode from "../components/OrgChart/EmployeeNode";
import { EmployeeDrawer } from "../components/OrgChart/EmployeeDrawer";

const nodeTypes = {
  employeeNode: EmployeeNode,
};

function DepartmentTreeInner() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [treeData, setTreeData] = useState<OrgTreeNode[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Selected employee profile details drawer state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  const { fitView, setNodes } = useReactFlow();

  // Load departments list on mount
  useEffect(() => {
    async function loadDepts() {
      try {
        setLoadingDepartments(true);
        const depts = await fetchDepartments();
        setDepartments(depts);
        if (depts.length > 0) {
          // Select first department by default
          setSelectedDeptId(depts[0].id);
        }
        setError(null);
      } catch (err) {
        console.error("Error loading departments:", err);
        setError("Failed to load departments. Please make sure the backend server is running.");
      } finally {
        setLoadingDepartments(false);
      }
    }
    loadDepts();
  }, []);

  // Fetch department tree when selected department changes
  useEffect(() => {
    const deptId = selectedDeptId;
    if (deptId === null) return;

    async function loadTree(id: number) {
      try {
        setLoadingTree(true);
        const tree = await fetchDepartmentTree(id);
        setTreeData(tree);

        // Expand all nodes by default
        const allIds = new Set<number>();
        function extractIds(nodes: OrgTreeNode[]) {
          for (const node of nodes) {
            allIds.add(node.id);
            if (node.children) {
              extractIds(node.children);
            }
          }
        }
        extractIds(tree);
        setExpandedNodes(allIds);

        // Clear search box on department change
        setSearchQuery("");
        setShowSuggestions(false);
        setError(null);
      } catch (err) {
        console.error("Error loading department tree:", err);
        setError("Failed to load department tree structure.");
      } finally {
        setLoadingTree(false);
      }
    }
    loadTree(deptId);
  }, [selectedDeptId]);

  // Flattened employee data for search autocomplete within selected department
  const flatEmployees = useMemo(() => {
    const list: { id: number; fullName: string; title: string; department: string; color: string }[] = [];
    function flatten(nodes: OrgTreeNode[]) {
      for (const node of nodes) {
        list.push({
          id: node.id,
          fullName: node.fullName,
          title: node.title,
          department: node.department,
          color: node.departmentColor,
        });
        if (node.children) {
          flatten(node.children);
        }
      }
    }
    flatten(treeData);
    return list;
  }, [treeData]);

  // Toggle node visibility
  const handleToggleExpand = useCallback((id: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Drag and Connect reports chain
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const managerId = Number(connection.source);
      const employeeId = Number(connection.target);
      const deptId = selectedDeptId;
      if (deptId === null) return;

      try {
        await updateEmployeeManager(employeeId, managerId);
        
        const tree = await fetchDepartmentTree(deptId);
        setTreeData(tree);

        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.add(managerId);
          next.add(employeeId);
          return next;
        });
      } catch (err) {
        console.error("Error updating manager connection:", err);
        alert("Failed to update reporting line. Drag-and-connect re-organization is only supported in Manual mode.");
      }
    },
    [selectedDeptId]
  );

  // Filtered search list suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return flatEmployees.filter((emp) => {
      const nameWords = emp.fullName.toLowerCase().split(/\s+/);
      const titleWords = emp.title.toLowerCase().split(/\s+/);
      return (
        nameWords.some((word) => word.startsWith(query)) ||
        titleWords.some((word) => word.startsWith(query))
      );
    });
  }, [searchQuery, flatEmployees]);

  // Path finder to node
  const findPathToNode = useCallback(
    (nodes: OrgTreeNode[], targetId: number, currentPath: number[] = []): number[] | null => {
      for (const node of nodes) {
        const path = [...currentPath, node.id];
        if (node.id === targetId) {
          return path;
        }
        if (node.children) {
          const found = findPathToNode(node.children, targetId, path);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  // Autofocus searched employee node
  const handleSelectEmployee = useCallback(
    (empId: number, fullName: string) => {
      if (fullName) {
        setSearchQuery(fullName);
      }
      setShowSuggestions(false);
      setSelectedEmployeeId(empId);

      const path = findPathToNode(treeData, empId);
      if (path) {
        // Expand parents
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          for (let i = 0; i < path.length - 1; i++) {
            next.add(path[i]);
          }
          return next;
        });

        // Zoom and center
        setTimeout(() => {
          fitView({
            nodes: [{ id: String(empId) }],
            duration: 800,
            maxZoom: 1.0,
          });

          setNodes((nodes) =>
            nodes.map((node) => ({
              ...node,
              selected: node.id === String(empId),
            }))
          );
        }, 80);
      }
    },
    [treeData, findPathToNode, fitView, setNodes]
  );

  // Handle clicking directly on an employee node card
  const onNodeClick = useCallback((_event: React.MouseEvent, node: any) => {
    setSelectedEmployeeId(Number(node.id));
  }, []);

  // Expand search input and focus it
  const handleIconClick = useCallback(() => {
    setSearchExpanded(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Clear search text, or collapse if already empty
  const handleClearOrCollapse = useCallback(() => {
    if (searchQuery) {
      setSearchQuery("");
      setShowSuggestions(false);
      inputRef.current?.focus();
    } else {
      setSearchExpanded(false);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  // Handle clicking outside to close suggestions or department dropdown & collapse search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        if (!searchQuery.trim()) {
          setSearchExpanded(false);
        }
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchQuery]);

  // Compute Layout elements
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const result = getLayoutedElements(treeData, expandedNodes, direction);
    return {
      nodes: result.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onToggleExpand: handleToggleExpand,
        },
      })),
      edges: result.edges,
    };
  }, [treeData, expandedNodes, direction, handleToggleExpand]);

  const [nodes, setNodesState, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync state when elements change
  useEffect(() => {
    setNodesState(layoutedNodes);
    setEdgesState(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodesState, setEdgesState]);

  // Fit View/Reset Zoom
  const handleResetView = useCallback(() => {
    fitView({ duration: 800, padding: 0.1, maxZoom: 1.0 });
  }, [fitView]);

  // Auto-center viewport when layout direction or tree data changes
  useEffect(() => {
    if (treeData.length > 0) {
      const timer = setTimeout(() => {
        fitView({ duration: 600, padding: 0.1, maxZoom: 1.0 });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [direction, treeData, fitView]);

  if (loadingDepartments) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-ink-50">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ink-200 border-t-brand" />
        <p className="mt-4 text-xs font-semibold text-ink-600">Loading departments list...</p>
      </div>
    );
  }

  if (error && departments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-ink-50 px-6 text-center">
        <div className="rounded-2xl bg-red-50 p-4 text-red-500 max-w-md shadow-sm border border-red-100">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="mt-3 font-display text-sm font-extrabold text-red-800">Connection Error</h3>
          <p className="mt-1 text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const activeDept = departments.find((d) => d.id === selectedDeptId);

  return (
    <div className="relative h-full w-full bg-tree-canvas overflow-hidden">
      {/* Floating Canvas Header */}
      <div className="absolute left-6 right-6 top-6 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Department Selector & Title */}
        <div ref={dropdownRef} className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 bg-white rounded-xl border border-ink-200 px-3 py-1.5 shadow-sm text-left hover:border-ink-300 transition-colors"
          >
            <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-brand/5">
              <svg className="h-4 w-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="block text-[8px] font-extrabold uppercase tracking-widest text-ink-400 leading-none">
                Department
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-display text-xs font-extrabold text-ink-900 truncate max-w-[120px]">
                  {activeDept ? activeDept.name : "Select Department"}
                </span>
                {activeDept && (
                  <span className="text-[10px] text-ink-400 font-bold">
                    ({activeDept.employeeCount})
                  </span>
                )}
              </div>
            </div>
            <svg className={`h-4 w-4 text-ink-400 transition-transform duration-200 shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Custom dropdown menu */}
          {dropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-56 rounded-xl border border-ink-150 bg-white p-1.5 shadow-xl z-20 max-h-60 !overflow-y-auto scrollbar-none animate-expand-down">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => {
                    setSelectedDeptId(dept.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-ink-50 ${
                    dept.id === selectedDeptId
                      ? "bg-brand/5 font-bold text-brand"
                      : "text-ink-800 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: dept.colorHex }}
                    />
                    <span className="truncate">{dept.name}</span>
                  </div>
                  <span className="text-[10px] text-ink-400 shrink-0 ml-2">({dept.employeeCount})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layout Orientation Controls removed from header */}

        {/* Search bar within department */}
        <div
          ref={searchRef}
          onClick={() => {
            if (!searchExpanded && !(loadingTree || treeData.length === 0)) handleIconClick();
          }}
          className={`relative flex items-center rounded-xl border border-ink-200 bg-white shadow-sm transition-all duration-300 h-[34px] ${
            searchExpanded
              ? "w-64 md:w-80 px-2.5 cursor-default"
              : "w-[34px] justify-center cursor-pointer hover:bg-ink-50"
          } ${loadingTree || treeData.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
        >
          <button
            onClick={(e) => {
              if (searchExpanded) {
                e.stopPropagation();
              } else {
                handleIconClick();
              }
            }}
            className={`flex items-center justify-center text-ink-400 transition-colors shrink-0 ${
              searchExpanded ? "hover:text-ink-600 cursor-default" : "cursor-pointer hover:text-ink-600"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder={`Search in ${activeDept?.name ?? "department"}...`}
            value={searchQuery}
            disabled={loadingTree || treeData.length === 0}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className={`bg-transparent text-xs text-ink-900 placeholder-ink-400 outline-none font-medium transition-all duration-300 ${
              searchExpanded ? "opacity-100 w-full ml-2" : "opacity-0 w-0 pointer-events-none"
            }`}
          />

          {searchExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearOrCollapse();
              }}
              className="rounded-full p-0.5 hover:bg-ink-100 text-ink-400 hover:text-ink-600 transition-colors shrink-0 ml-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Autocomplete Dropdown list */}
          {searchExpanded && showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-60 !overflow-y-auto rounded-2xl border border-ink-150 bg-white p-2.5 shadow-2xl z-20 scrollbar-none animate-expand-down">
              {suggestions.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp.id, emp.fullName)}
                  className="flex w-full flex-col gap-0.5 rounded-xl px-3.5 py-2 text-left transition-colors hover:bg-ink-50 active:bg-ink-100"
                >
                  <p className="text-xs font-bold text-ink-900">{emp.fullName}</p>
                  <span className="text-[10px] text-ink-600 truncate mt-0.5">{emp.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading Indicator for tree fetching */}
      {loadingTree ? (
        <div className="flex h-full flex-col items-center justify-center bg-transparent">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-white" />
          <p className="mt-4 text-xs font-semibold text-white/70">Updating department tree hierarchy...</p>
        </div>
      ) : treeData.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center bg-transparent text-center px-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 max-w-sm shadow-xl">
            <svg className="mx-auto h-12 w-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-4 font-display text-sm font-extrabold text-white">Empty Department</h3>
            <p className="mt-1.5 text-xs text-white/60">
              There are currently no employees assigned to the {activeDept?.name ?? "selected"} department.
            </p>
          </div>
        </div>
      ) : (
        /* React Flow Canvas */
        <>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.0 }}
            minZoom={0.15}
            maxZoom={2}
            defaultMarkerColor="#94A3B8"
            nodesFocusable={true}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd5e1" style={{ opacity: 0.3 }} gap={16} size={1} />

            {/* Bottom-Right Controls Panel (Layout Toggle + Reset Zoom) */}
            <Panel position="bottom-right" className="m-6 flex items-center gap-2">
              {/* Layout Orientation Controls */}
              <div className="flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
                <button
                  onClick={() => setDirection("TB")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                    direction === "TB"
                      ? "bg-brand text-white shadow-sm"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-6l-7 7-7-7" />
                  </svg>
                  Vertical
                </button>
                <button
                  onClick={() => setDirection("LR")}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                    direction === "LR"
                      ? "bg-brand text-white shadow-sm"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Horizontal
                </button>
              </div>

              {/* Reset Zoom Control */}
              <div className="flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
                <button
                  onClick={handleResetView}
                  title="Reset Zoom & Center Tree"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors shadow-sm cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7M21 15v6h-6M3 9V3h6M21 21l-7-7M3 3l7 7" />
                  </svg>
                </button>
              </div>
            </Panel>
          </ReactFlow>

          {/* Profile Details Side Drawer */}
          <EmployeeDrawer
            employeeId={selectedEmployeeId}
            treeData={treeData}
            onClose={() => setSelectedEmployeeId(null)}
            onSelectEmployee={(id) => handleSelectEmployee(id, "")}
          />
        </>
      )}
    </div>
  );
}

export default function DepartmentTreePage() {
  return (
    <ReactFlowProvider>
      <DepartmentTreeInner />
    </ReactFlowProvider>
  );
}
