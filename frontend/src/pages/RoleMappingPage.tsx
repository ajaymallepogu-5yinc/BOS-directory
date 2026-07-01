import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Background,
  useReactFlow,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchEmployees } from "../api/employeeApi";
import { fetchRoleTracks } from "../api/roleApi";
import type { Employee, CareerLevel } from "../api/types";
import RoleNode from "../components/OrgChart/RoleNode";

const nodeTypes = {
  roleNode: RoleNode,
};

interface RoleTreeNode {
  id: string;
  level: number;
  title: string;
  description: string;
  requirements: string;
  parentTitle: string | null;
  children: RoleTreeNode[];
}

// Tree builder utility
function buildRoleTree(levels: CareerLevel[]): RoleTreeNode[] {
  const nodeMap = new Map<string, RoleTreeNode>();

  levels.forEach((l) => {
    nodeMap.set(l.title, {
      id: l.title,
      level: l.level,
      title: l.title,
      description: l.description,
      requirements: l.requirements,
      parentTitle: l.parentTitle as string | null,
      children: [],
    });
  });

  const roots: RoleTreeNode[] = [];

  levels.forEach((l) => {
    const node = nodeMap.get(l.title)!;
    if (l.parentTitle && nodeMap.has(l.parentTitle)) {
      nodeMap.get(l.parentTitle)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// Helper to resolve track from employee title
function resolveTrack(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("ceo") || t.includes("chief") || t.includes("president")) {
    return "Executive Leadership";
  }
  if (t.includes("sales") || t.includes("marketing") || t.includes("consultant")) {
    return "Sales & Marketing";
  }
  if (t.includes("delivery") || t.includes("project manager") || t.includes("project lead") || t.includes("pm")) {
    return "Product & Project Delivery";
  }
  if (t.includes("operations") || t.includes("hr") || t.includes("human resources")) {
    return "Operations & HR";
  }
  return "Technology";
}

// Helper to resolve level from employee title
function resolveLevel(title: string, track: string): number {
  const t = title.toLowerCase();

  if (track === "Executive Leadership") {
    return 1;
  }

  if (track === "Technology") {
    if (t.includes("architect") || t.includes("head")) return 5; // Solution Architect
    if (t.includes("director") && t.includes("engineering")) return 5; // Director of Engineering
    if (t.includes("lead") || t.includes("director")) return 4; // Lead Engineer
    if (t.includes("manager") && t.includes("engineering")) return 4; // Engineering Manager
    if (t.includes("qa") || t.includes("admin") || t.includes("designer") || t.includes("console") || t.includes("specialist")) return 3; // Senior / Specialist
    if (t.includes("associate") || t.includes("junior") || t.includes("support")) return 1; // Associate
    return 2; // Developer
  }

  if (track === "Operations & HR") {
    if (t.includes("lead") || t.includes("director")) return 4;
    if (t.includes("manager")) return 3;
    if (t.includes("associate") || t.includes("assistant")) return 1;
    return 2;
  }

  if (track === "Product & Project Delivery") {
    if (t.includes("delivery") || t.includes("program")) return 3;
    if (t.includes("manager") || t.includes("lead") || t.includes("pm")) return 2;
    return 1;
  }

  if (track === "Sales & Marketing") {
    if (t.includes("consultant") || t.includes("senior")) return 3;
    if (t.includes("lead") || t.includes("manager")) return 2;
    return 1;
  }

  return 1;
}

// Custom layout elements generator
function getLayoutedRoleElements(
  roots: RoleTreeNode[],
  selectedLevelTitle: string | null,
  employees: Employee[],
  loggedInEmail: string,
  direction: "TB" | "LR" = "TB"
) {
  const nodes: any[] = [];
  const edges: any[] = [];

  let leafIndex = 0;
  const horizontalSpacing = direction === "TB" ? 300 : 340;
  const verticalSpacing = direction === "TB" ? 220 : 180;

  function traverse(node: RoleTreeNode, depth: number, parentId: string | null): { x: number; y: number } {
    const nodeId = node.id;
    const hasChildren = node.children && node.children.length > 0;

    let x = 0;
    let y = 0;

    if (!hasChildren) {
      if (direction === "TB") {
        x = leafIndex * horizontalSpacing;
        y = (5 - node.level) * verticalSpacing;
      } else {
        x = (node.level - 1) * horizontalSpacing;
        y = leafIndex * verticalSpacing;
      }
      leafIndex++;
    } else {
      const childPositions: { x: number; y: number }[] = [];
      for (const child of node.children) {
        const childPos = traverse(child, depth + 1, nodeId);
        childPositions.push(childPos);
      }

      if (direction === "TB") {
        const minX = childPositions[0].x;
        const maxX = childPositions[childPositions.length - 1].x;
        x = (minX + maxX) / 2;
        y = (5 - node.level) * verticalSpacing;
      } else {
        const minY = childPositions[0].y;
        const maxY = childPositions[childPositions.length - 1].y;
        x = (node.level - 1) * horizontalSpacing;
        y = (minY + maxY) / 2;
      }
    }

    // Filter employees assigned to this level and title
    const assignedEmployees = employees.filter(e => {
      const track = resolveTrack(e.title);
      const level = resolveLevel(e.title, track);
      return track === "Technology" && level === node.level && (
        (node.level === 4 && node.title === "Engineering Manager" && e.title.toLowerCase().includes("manager")) ||
        (node.level === 4 && node.title === "Lead Engineer" && !e.title.toLowerCase().includes("manager")) ||
        (node.level === 5 && node.title === "Director of Engineering" && e.title.toLowerCase().includes("director")) ||
        (node.level === 5 && node.title === "Solution Architect" && !e.title.toLowerCase().includes("director")) ||
        (node.level < 4)
      );
    });

    const isSelected = selectedLevelTitle === node.title;

    nodes.push({
      id: nodeId,
      type: "roleNode",
      position: { x, y },
      data: {
        level: node.level,
        title: node.title,
        description: node.description,
        direction,
        isSelected,
        status: "default",
        employees: assignedEmployees,
        loggedInEmail,
      },
    });

    if (parentId) {
      edges.push({
        id: `edge-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: "default",
        style: {
          stroke: "#cbd5e1",
          strokeWidth: 2,
        },
      });
    }

    return { x, y };
  }

  roots.forEach((root) => traverse(root, 0, null));

  return { nodes, edges };
}

function RoleMappingInner() {
  const LOGGED_IN_EMAIL = "gautham@bosframework.com";

  // Data loading states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [techLevels, setTechLevels] = useState<CareerLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected state
  const [activeLevelDetails, setActiveLevelDetails] = useState<CareerLevel | null>(null);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");

  const { fitView } = useReactFlow();

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [empList, trackList] = await Promise.all([
          fetchEmployees(),
          fetchRoleTracks(),
        ]);
        setEmployees(empList);

        const techTrack = trackList.find((t) => t.trackName === "Technology");
        if (techTrack) {
          setTechLevels(techTrack.levels);
          const currentUser = empList.find(e => e.appEmail?.toLowerCase() === LOGGED_IN_EMAIL);
          if (currentUser) {
            const track = resolveTrack(currentUser.title);
            const levelVal = resolveLevel(currentUser.title, track);
            const matchedLevel = techTrack.levels.find(l => l.level === levelVal);
            if (matchedLevel) {
              setActiveLevelDetails(matchedLevel);
            } else if (techTrack.levels.length > 0) {
              setActiveLevelDetails(techTrack.levels[0]);
            }
          } else if (techTrack.levels.length > 0) {
            setActiveLevelDetails(techTrack.levels[0]);
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load career data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Build tree levels hierarchy list
  const roleTreeRoots = useMemo(() => {
    return buildRoleTree(techLevels);
  }, [techLevels]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const selectedTitle = activeLevelDetails ? activeLevelDetails.title : null;
    return getLayoutedRoleElements(roleTreeRoots, selectedTitle, employees, LOGGED_IN_EMAIL, direction);
  }, [roleTreeRoots, activeLevelDetails, employees, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync React Flow nodes and edges when computed values shift
  useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Auto fit layout in viewport
    setTimeout(() => {
      fitView({ duration: 500, padding: 0.1 });
    }, 100);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges, fitView]);

  // Click on a tree node to display detailed expectations
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      const matched = techLevels.find((l) => l.title === node.id);
      if (matched) {
        setActiveLevelDetails(matched);
      }
    },
    [techLevels]
  );

  const handleResetView = useCallback(() => {
    fitView({ duration: 600, padding: 0.1 });
  }, [fitView]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-ink-50">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
          <span className="text-xs font-semibold text-ink-600">Loading career framework...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-ink-50 px-6 text-center">
        <div className="rounded-2xl bg-red-50 p-4 text-red-500 max-w-md shadow-sm border border-red-100">
          <h3 className="font-display text-sm font-extrabold text-red-800">Connection Error</h3>
          <p className="mt-1 text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col lg:flex-row bg-ink-100 p-6 gap-6 overflow-hidden">
      
      {/* Left Column: Visual Career Tree Workspace */}
      <div className="flex-1 bg-tree-canvas rounded-2xl border border-ink-150 overflow-hidden relative shadow-sm flex flex-col justify-stretch">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cbd5e1" style={{ opacity: 0.3 }} gap={16} size={1} />

          {/* Bottom Right Zoom controls */}
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
                Horizontal
              </button>
            </div>

            {/* Reset Zoom */}
            <button
              onClick={handleResetView}
              title="Reset Zoom & Center Tree"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors shadow-sm cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7M21 15v6h-6M3 9V3h6M21 21l-7-7M3 3l7 7" />
              </svg>
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Column: Detailed Expectations view */}
      {activeLevelDetails && (
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-ink-150 p-6 shadow-sm overflow-y-auto scrollbar-none shrink-0 flex flex-col relative">
          <div className="space-y-5 flex flex-col justify-start">
            <div className="border-b border-ink-150 pb-4 relative pr-8">
              <button
                onClick={() => setActiveLevelDetails(null)}
                title="Close Details"
                className="absolute top-0 right-0 flex h-6 w-6 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-ink-800 transition-colors cursor-pointer shadow-sm"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="rounded-md bg-brand/5 px-2 py-0.5 text-[9px] font-extrabold text-brand border border-brand/10 uppercase tracking-wide leading-none">
                Level {activeLevelDetails.level} Detailed Requirements
              </span>
              <h4 className="text-sm font-extrabold text-ink-900 mt-2 leading-snug">{activeLevelDetails.title}</h4>
            </div>

            <div>
              <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-brand leading-none">
                Expectations & Description
              </h5>
              <p className="text-xs font-semibold text-ink-600 mt-2 leading-relaxed whitespace-pre-line bg-ink-50/50 rounded-xl p-4.5 border border-ink-100/50">
                {activeLevelDetails.description}
              </p>
            </div>

            <div>
              <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-brand leading-none mt-2">
                Requirements for Progression
              </h5>
              <p className="text-xs font-semibold text-ink-600 mt-2 leading-relaxed whitespace-pre-line bg-ink-50/50 rounded-xl p-4.5 border border-ink-100/50">
                {activeLevelDetails.requirements}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function RoleMappingPage() {
  return (
    <ReactFlowProvider>
      <RoleMappingInner />
    </ReactFlowProvider>
  );
}
