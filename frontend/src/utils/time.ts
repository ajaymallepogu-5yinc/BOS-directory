// Rounds to the nearest minute first, so arbitrary minute entries (e.g. 59 minutes = 0.98333...
// decimal hours) format cleanly instead of leaking floating-point noise like "8.983333333333333".
export function formatHoursLabel(hours: number): string {
  const totalMinutes = Math.max(0, Math.round((hours || 0) * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
