import type { Department } from "../../api/types";

interface Props {
  departments: Department[];
  activeId: number | null;
  onSelect: (id: number) => void;
}

export default function DepartmentLegend({ departments, activeId, onSelect }: Props) {
  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {departments.map((dept) => {
        const active = dept.id === activeId;
        return (
          <button
            key={dept.id}
            onClick={() => onSelect(dept.id)}
            className={`inline-flex items-center rounded-lg whitespace-nowrap text-sm px-3.5 py-1.5 transition-all duration-150 ${
              active
                ? "bg-white/15 text-white font-medium"
                : "text-white hover:bg-white/8 font-medium"
            }`}
          >
            {dept.name}
            <span
              className={`text-xs font-mono ml-1.5 ${
                active ? "text-white/70" : "text-white/40"
              }`}
            >
              {dept.employeeCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
