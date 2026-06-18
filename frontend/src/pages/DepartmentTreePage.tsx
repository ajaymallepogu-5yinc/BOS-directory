import { useEffect, useState } from "react";
import { fetchDepartmentTree, fetchDepartments } from "../api/employeeApi";
import DepartmentLegend from "../components/OrgChart/DepartmentLegend";
import OrgTree from "../components/OrgChart/OrgTree";
import type { Department } from "../api/types";
import { useOrgTree } from "../hooks/useOrgTree";

export default function DepartmentTreePage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    fetchDepartments().then((data) => {
      setDepartments(data);
      if (data.length > 0) setActiveId(data[0].id);
    });
  }, []);

  const { roots, loading, error } = useOrgTree(
    () => (activeId ? fetchDepartmentTree(activeId) : Promise.resolve([])),
    [activeId]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-200 bg-white px-6 py-3">
        <h1 className="font-display text-base font-bold text-ink-900">Department Tree</h1>
        <p className="mb-3 text-xs text-ink-400">One department's reporting structure at a time</p>
        <DepartmentLegend departments={departments} activeId={activeId} onSelect={setActiveId} />
      </div>

      {loading && <div className="p-10 text-sm text-ink-400">Loading the chart...</div>}
      {error && <div className="p-10 text-sm text-rose-600">{error}</div>}
      {!loading && !error && <OrgTree roots={roots} />}
    </div>
  );
}
