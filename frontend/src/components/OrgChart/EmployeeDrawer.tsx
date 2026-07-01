import React, { useEffect, useState } from "react";
import type { OrgTreeNode } from "../../api/types";

interface EmployeeDrawerProps {
  employeeId: number | null;
  treeData: OrgTreeNode[];
  onClose: () => void;
  onSelectEmployee: (id: number) => void;
}

// Generate unique HSL color based on string hash for initials avatar
function getInitialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 42%)`;
}

// Helper to find a node and its manager in the tree
function findEmployeeInTree(
  nodes: OrgTreeNode[],
  id: number,
  parentNode: OrgTreeNode | null = null
): { node: OrgTreeNode; parent: OrgTreeNode | null } | null {
  for (const node of nodes) {
    if (node.id === id) {
      return { node, parent: parentNode };
    }
    if (node.children) {
      const found = findEmployeeInTree(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

export const EmployeeDrawer: React.FC<EmployeeDrawerProps> = ({
  employeeId,
  treeData,
  onClose,
  onSelectEmployee,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (employeeId !== null) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [employeeId]);

  if (employeeId === null) return null;

  const result = findEmployeeInTree(treeData, employeeId);
  if (!result) return null;

  const { node: emp, parent: manager } = result;
  const initials = emp.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300); // Allow exit transition to complete
  };

  const handleSelectLink = (id: number) => {
    onSelectEmployee(id);
  };

  return (
    <>
      {/* Semi-transparent Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink-950/20 backdrop-blur-[1px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Drawer Container */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col border-l border-ink-150 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-ink-150 px-5 py-4 shrink-0">
          <h3 className="font-display text-sm font-extrabold text-ink-900">Profile Details</h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1 hover:bg-ink-50 text-ink-400 hover:text-ink-600 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-none space-y-6">
          {/* Avatar Profile Intro */}
          <div className="flex flex-col items-center text-center space-y-3">
            {emp.avatarUrl ? (
              <img
                src={emp.avatarUrl}
                alt={emp.fullName}
                className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
                style={{ backgroundColor: getInitialsColor(emp.fullName) }}
              >
                {initials}
              </div>
            )}

            <div>
              <h4 className="text-base font-extrabold text-ink-900">{emp.fullName}</h4>
              <p className="text-xs font-semibold text-brand mt-0.5">{emp.title}</p>
            </div>

            <span
              className="rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide uppercase shadow-sm border border-transparent"
              style={{
                backgroundColor: `${emp.departmentColor}12`,
                color: emp.departmentColor,
              }}
            >
              {emp.department}
            </span>
          </div>

          <hr className="border-ink-100" />

          {/* Details list */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">Information</h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <p className="text-[10px] font-bold text-ink-400">Company</p>
                <p className="text-xs font-semibold text-ink-800 mt-0.5 truncate">{emp.company || "5yinc"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400">Department</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: emp.departmentColor }}
                  />
                  <p className="text-xs font-semibold text-ink-800 truncate">{emp.department}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400">Direct Reports</p>
                <p className="text-xs font-bold text-ink-800 mt-0.5">
                  {emp.children ? emp.children.length : 0} people
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400">Total Org Reports</p>
                <p className="text-xs font-bold text-ink-800 mt-0.5">{emp.totalReportCount} people</p>
              </div>
            </div>
          </div>

          <hr className="border-ink-100" />

          {/* Manager reporting link */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">Reports To</h5>
            {manager ? (
              <button
                onClick={() => handleSelectLink(manager.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-ink-150 bg-white p-3 text-left shadow-sm hover:border-brand hover:shadow-md hover:-translate-y-[1px] transition-all cursor-pointer group"
              >
                {manager.avatarUrl ? (
                  <img
                    src={manager.avatarUrl}
                    alt={manager.fullName}
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: getInitialsColor(manager.fullName) }}
                  >
                    {manager.fullName
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-900 truncate group-hover:text-brand transition-colors">
                    {manager.fullName}
                  </p>
                  <p className="text-[10px] font-medium text-ink-500 truncate">{manager.title}</p>
                </div>
                <svg className="h-4 w-4 text-ink-400 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-ink-200 p-4 text-center">
                <p className="text-xs font-medium text-ink-500">No Manager (Top of Hierarchy)</p>
              </div>
            )}
          </div>

          <hr className="border-ink-100" />

          {/* Direct reports grid list */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-bold tracking-wider text-ink-400 uppercase">
              Direct Reports ({emp.children ? emp.children.length : 0})
            </h5>
            {emp.children && emp.children.length > 0 ? (
              <div className="space-y-2">
                {emp.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleSelectLink(child.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-ink-150 bg-white p-3 text-left shadow-sm hover:border-brand hover:shadow-md hover:-translate-y-[1px] transition-all cursor-pointer group"
                  >
                    {child.avatarUrl ? (
                      <img
                        src={child.avatarUrl}
                        alt={child.fullName}
                        className="h-9 w-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: getInitialsColor(child.fullName) }}
                      >
                        {child.fullName
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 truncate group-hover:text-brand transition-colors">
                        {child.fullName}
                      </p>
                      <p className="text-[10px] font-medium text-ink-500 truncate">{child.title}</p>
                    </div>
                    <svg className="h-4 w-4 text-ink-400 shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-ink-200 p-4 text-center">
                <p className="text-xs font-medium text-ink-500">No Direct Reports</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
