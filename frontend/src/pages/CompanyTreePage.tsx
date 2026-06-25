import { fetchCompanyTree } from "../api/employeeApi";
import OrgTree from "../components/OrgChart/OrgTree";
import { useOrgTree } from "../hooks/useOrgTree";

export default function CompanyTreePage() {
  const { roots, loading, error } = useOrgTree(fetchCompanyTree, []);

  return (
    <div className="relative flex h-full flex-col bg-tree-canvas">
      <OrgTree roots={roots} />

      {loading && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{
            background: "rgba(7,13,25,0.40)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
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
              Loading…
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}
    </div>
  );
}
