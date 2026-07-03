import type { Employee } from "../../api/types";

interface Props {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export default function EmployeeTable({ employees, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Reports to</th>
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
              <td className="px-4 py-3 text-right">
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
