import type { Employee } from "../../api/types";

interface Props {
  employees: Employee[];
  currentUserId?: number;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleAdmin: (employee: Employee) => void;
}

export default function EmployeeTable({ employees, currentUserId, onEdit, onDelete, onToggleAdmin }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Reports to</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-ink-50/60">
              <td className="px-4 py-3 font-medium text-ink-900">{emp.fullName}</td>
              <td className="px-4 py-3 text-ink-600 font-mono text-xs">{emp.appEmail}</td>
              <td className="px-4 py-3 text-ink-600">{emp.title}</td>
              <td className="px-4 py-3 text-ink-600">{emp.department}</td>
              <td className="px-4 py-3 text-ink-400">{emp.managerName ?? "—"}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    emp.isAdmin ? "bg-brand/10 text-brand-light" : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {emp.isAdmin ? "Admin" : "Employee"}
                </span>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => onToggleAdmin(emp)}
                  disabled={emp.id === currentUserId}
                  title={emp.id === currentUserId ? "You cannot change your own Admin role" : undefined}
                  className="mr-3 text-brand-light hover:underline disabled:cursor-not-allowed disabled:text-ink-300 disabled:no-underline"
                >
                  {emp.isAdmin ? "Remove Admin" : "Make Admin"}
                </button>
                <button
                  onClick={() => onEdit(emp)}
                  className="mr-3 text-brand-light hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(emp)}
                  className="text-rose-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {employees.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-ink-400">No employees yet. Add the first one.</p>
      )}
    </div>
  );
}
