import { useEffect, useState, useRef } from "react";
import type { Department, Employee, EmployeeFormValues, ManagerOption } from "../../api/types";

interface Props {
  open: boolean;
  initial?: Employee | null;
  departments: Department[];
  managerOptions: ManagerOption[];
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
}

const emptyForm: EmployeeFormValues = {
  fullName: "",
  title: "",
  company: "",
  avatarUrl: "",
  managerId: null,
  departmentId: null,
};

export default function EmployeeFormDrawer({
  open,
  initial,
  departments,
  managerOptions,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<EmployeeFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setValues({
        fullName: initial.fullName,
        title: initial.title,
        company: initial.company,
        avatarUrl: initial.avatarUrl ?? "",
        managerId: initial.managerId ?? null,
        departmentId: initial.departmentId,
      });
    } else {
      setValues(emptyForm);
    }
  }, [initial, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/30">
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
      >
        <div className="border-b border-ink-200 px-6 py-4">
          <h2 className="font-display text-base font-bold text-ink-900">
            {initial ? "Edit employee" : "Add employee"}
          </h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Field label="Full name">
            <input
              required
              value={values.fullName}
              onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
              className="input"
            />
          </Field>

          <Field label="Title">
            <input
              required
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              className="input"
            />
          </Field>

          <Field label="Company">
            <input
              required
              value={values.company}
              onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))}
              className="input"
            />
          </Field>

          <Field label="Department">
            <CustomSelect
              value={values.departmentId}
              onChange={(val) => setValues((v) => ({ ...v, departmentId: val !== null ? Number(val) : null }))}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              emptyLabel="Select a department"
            />
          </Field>

          <Field label="Reports to">
            <CustomSelect
              value={values.managerId}
              onChange={(val) => setValues((v) => ({ ...v, managerId: val !== null ? Number(val) : null }))}
              options={managerOptions
                .filter((m) => !initial || m.id !== initial.id)
                .map((m) => ({ value: m.id, label: `${m.fullName} — ${m.title}` }))}
              emptyLabel="No one (this is the top of the org)"
            />
          </Field>

          <Field label="Photo URL (optional)">
            <input
              value={values.avatarUrl}
              onChange={(e) => setValues((v) => ({ ...v, avatarUrl: e.target.value }))}
              placeholder="https://..."
              className="input"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : initial ? "Save changes" : "Add employee"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

function CustomSelect({
  value,
  onChange,
  options,
  emptyLabel
}: {
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  options: { value: string | number; label: string }[];
  emptyLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className="flex w-full items-center justify-between rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs text-ink-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand hover:bg-ink-50/50 transition-colors"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : emptyLabel}
        </span>
        <span className="text-ink-400 select-none text-[10px]">▼</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1 z-50 w-full rounded-lg border border-ink-200 bg-white shadow-lg overflow-hidden flex flex-col max-h-60">
          {/* Search Box if list is long */}
          {options.length > 5 && (
            <div className="border-b border-ink-100 p-2 bg-ink-50/20">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-ink-200 px-2 py-1 text-[11px] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto py-1 max-h-48 divide-y divide-ink-50/50">
            {/* Empty Option */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`flex w-full px-3 py-2 text-left text-xs transition-colors hover:bg-brand/10 hover:text-brand ${
                value === null || value === "" ? "font-bold text-brand bg-brand/5" : "text-ink-700"
              }`}
            >
              {emptyLabel}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-ink-400 text-center">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full px-3 py-2 text-left text-xs transition-colors hover:bg-brand/10 hover:text-brand ${
                    opt.value === value ? "font-bold text-brand bg-brand/5" : "text-ink-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
