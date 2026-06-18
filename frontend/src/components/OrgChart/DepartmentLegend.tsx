import type { Department } from "../../api/types";

interface Props {
  departments: Department[];
  activeId: number | null;
  onSelect: (id: number) => void;
}

export default function DepartmentLegend({ departments, activeId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {departments.map((dept) => {
        const active = dept.id === activeId;
        return (
          <button
            key={dept.id}
            onClick={() => onSelect(dept.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-transparent text-white"
                : "border-ink-200 bg-white text-ink-600 hover:border-ink-400"
            }`}
            style={active ? { backgroundColor: dept.colorHex } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: active ? "white" : dept.colorHex }}
            />
            {dept.name}
            <span className="font-mono text-[10px] opacity-70">{dept.employeeCount}</span>
          </button>
        );
      })}
    </div>
  );
}
