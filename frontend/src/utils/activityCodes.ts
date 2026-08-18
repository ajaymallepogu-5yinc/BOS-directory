export interface ActivityCode {
  code: string;
  type: string;
  explanation: string;
}

export const ACTIVITY_CODES: ActivityCode[] = [
  { code: "DSM", type: "Daily Standup Meetings", explanation: "Daily Scrum/Standup/Syncup Meeting" },
  { code: "SRM", type: "Sprint Review Meetings", explanation: "Sprint Kick off Meeting, Mid Sprint Review, Sprint Product Review, Sprint Retrospection" },
  { code: "CSM", type: "Customer meetings", explanation: "Customer/Client meetings" },
  { code: "ISM", type: "Products + Services", explanation: "Internal Stakeholder Meeting" },
  { code: "LDM", type: "Leadership", explanation: "Leadership Meeting" },
  { code: "AHM", type: "All Hands Meeting", explanation: "All Hands Meeting with entire Organization" },
  { code: "INTM", type: "Internal Meetings", explanation: "Other internal Team Meetings, syncups, checkins, reviews, 1-1, etc." },
  { code: "EXTM", type: "External Meetings", explanation: "With external persons/vendors/third-party" },
  { code: "OTH", type: "Other", explanation: "Other - describe it in the field that appears once picked" },
  { code: "PRA", type: "", explanation: "Pull Request review and approval" },
  { code: "PRC", type: "", explanation: "Conflict resolution" },
  { code: "ARB", type: "Architectural Review", explanation: "Technical Architecture / Implementation approach Reviews" },
  { code: "RPT", type: "Reports", explanation: "WSR/MSR/QSR - Weekly/Monthly/Quarterly Status Review" },
  { code: "DOC", type: "Documentation", explanation: "Process documentation/ any other documentation other than project doc" },
  { code: "REV", type: "Review", explanation: "Work review/ Validation/ Follow ups/ Coordination" },
  { code: "DLV", type: "Delivery", explanation: "Delivery to the Customer (Updates to the Customer / Customer Support Items)" },
  { code: "SLK", type: "Slack", explanation: "Reverting to team on slack messages - only for PM and above" },
  { code: "DES", type: "Design", explanation: "Designing on various work items" },
  { code: "KTS", type: "Keka Timesheets", explanation: "Keka Timesheets, Attendance, Leaves, WFH - review/approval" },
  { code: "SAM", type: "Sales & Marketing", explanation: "Tasks related to Sales and Marketing" },
  { code: "LVE", type: "Leave", explanation: "Approved leave, vacation, sick day, or other time off" }
];

// "CODE — Full Name" so the code is never shown on its own without its meaning next to it.
export function activityCodeLabel(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const found = ACTIVITY_CODES.find((a) => a.code === code);
  if (!found) return code;
  return `${found.code} — ${found.type || found.explanation}`;
}
