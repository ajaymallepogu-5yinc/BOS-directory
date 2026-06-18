import { useEffect, useState } from "react";
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
            <select
              required
              value={values.departmentId ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, departmentId: Number(e.target.value) }))}
              className="input"
            >
              <option value="" disabled>
                Select a department
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Reports to">
            <select
              value={values.managerId ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, managerId: e.target.value ? Number(e.target.value) : null }))
              }
              className="input"
            >
              <option value="">No one (this is the top of the org)</option>
              {managerOptions
                .filter((m) => !initial || m.id !== initial.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} — {m.title}
                  </option>
                ))}
            </select>
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
