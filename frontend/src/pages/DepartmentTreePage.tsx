import { useEffect, useState, useRef } from "react";
import { fetchDepartmentTree, fetchDepartments } from "../api/employeeApi";
import DepartmentLegend from "../components/OrgChart/DepartmentLegend";
import OrgTree from "../components/OrgChart/OrgTree";
import type { Department, OrgTreeNode } from "../api/types";

export default function DepartmentTreePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [treeCache, setTreeCache] = useState<Record<number, OrgTreeNode[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [visible, setVisible] = useState(true); // for fade transition

  // Fetch all departments + all their trees in parallel on mount
  useEffect(() => {
    fetchDepartments().then(async (depts) => {
      setDepartments(depts);
      if (depts.length > 0) setActiveId(depts[0].id);

      // Fetch every department tree simultaneously
      const results = await Promise.all(
        depts.map((d) =>
          fetchDepartmentTree(d.id)
            .then((roots) => ({ id: d.id, roots }))
            .catch(() => ({ id: d.id, roots: [] as OrgTreeNode[] }))
        )
      );

      const cache: Record<number, OrgTreeNode[]> = {};
      results.forEach(({ id, roots }) => { cache[id] = roots; });
      setTreeCache(cache);
      setInitialLoading(false);
    });
  }, []);

  // Smooth fade when switching departments
  const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSelect = (id: number) => {
    if (id === activeId) return;
    // Fade out → switch → fade in
    setVisible(false);
    if (fadeTimeout.current) clearTimeout(fadeTimeout.current);
    fadeTimeout.current = setTimeout(() => {
      setActiveId(id);
      setVisible(true);
    }, 180);
  };

  const activeRoots = activeId != null ? (treeCache[activeId] ?? []) : [];

  return (
    <div className="flex h-full flex-col bg-tree-canvas">
      {/* Top Navbar */}
      <div className="border-b border-white/10 bg-transparent px-6 py-2.5 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="font-display text-sm font-semibold text-white">Departments</h1>
          <div className="h-4 w-[1px] bg-white/15" />
          <div className="max-w-[calc(100vw-350px)] overflow-x-auto scrollbar-none">
            <DepartmentLegend
              departments={departments}
              activeId={activeId}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </div>

      {/* Interactive canvas / OrgTree */}
      <div className="flex-1 min-h-0 relative">
        <OrgTree roots={activeRoots} contentOpacity={visible ? 1 : 0} />

        {/* Initial load overlay — only shown once on first page load */}
        {initialLoading && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center"
            style={{
              background: "rgba(7,13,25,0.60)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            <div
              className="flex items-center gap-2.5 rounded-full px-5 py-2.5"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <svg className="h-4 w-4 animate-spin" style={{ color: "rgba(255,255,255,0.7)" }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                Loading all departments…
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
