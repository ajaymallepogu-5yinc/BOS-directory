// Some Jira sample/test tickets have their own project's name baked directly into the title
// (e.g. "Test Board 1 - Sample task 3") - strips that leading "ProjectName - " (any dash
// variant, case-insensitive) so it isn't shown twice alongside the project column/label.
export function stripLeadingProjectName(title: string, projectName?: string | null): string {
  if (!projectName) return title;
  const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = title.replace(new RegExp(`^\\s*${escaped}\\s*[-–—:]\\s*`, "i"), "").trim();
  return stripped || title;
}
