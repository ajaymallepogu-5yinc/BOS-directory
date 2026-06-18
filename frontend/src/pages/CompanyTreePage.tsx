import { useState } from "react";
import { fetchCompanyTree } from "../api/employeeApi";
import OrgTree from "../components/OrgChart/OrgTree";
import { useOrgTree } from "../hooks/useOrgTree";

export default function CompanyTreePage() {
  const [search, setSearch] = useState("");
  const { roots, loading, error } = useOrgTree(fetchCompanyTree, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-200 bg-white px-6 py-3">
        <div>
          <h1 className="font-display text-base font-bold text-ink-900">Company Tree</h1>
          <p className="text-xs text-ink-400">Everyone, from the top down</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a person..."
          className="w-64 rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-brand-light focus:ring-1 focus:ring-brand-light"
        />
      </div>

      {loading && <div className="p-10 text-sm text-ink-400">Loading the chart...</div>}
      {error && <div className="p-10 text-sm text-rose-600">{error}</div>}
      {!loading && !error && <OrgTree roots={roots} searchTerm={search} />}
    </div>
  );
}
