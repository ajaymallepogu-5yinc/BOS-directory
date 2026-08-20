// Fixed set of broad job-role categories - distinct from an employee's free-text Title.
// Same "hardcoded list, no admin CRUD" pattern as the Timesheet's activity codes.
export const JOB_ROLES = [
  "Architect",
  "QA",
  "Dev",
  "Project Manager",
  "Engagement Manager",
  "Designer",
  "Cloud Ops",
  "HR"
] as const;
