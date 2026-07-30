import type { Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  house_director: "House Director",
  community_teacher: "Community Teacher",
  house_executive: "House Executive",
  student: "Student",
};

export const isStaff = (r: Role) => r !== "student";

/** Run check-in screens (scanner, manual, tally). */
export const canOperate = isStaff;

/** Create/edit events. Director only. */
export const canManageEvents = (r: Role) => r === "house_director";

/** Award points to houses. Director only. */
export const canAwardPoints = (r: Role) => r === "house_director";

/** Undo an individual check-in. Director or teacher — not executives. */
export const canUndoCheckin = (r: Role) =>
  r === "house_director" || r === "community_teacher";

/** Add a student manually (marked pending). All staff. */
export const canAddStudents = isStaff;

/** View/search the full roster. All staff. */
export const canViewRoster = isStaff;

/** CSV import. Director only. */
export const canImportCsv = (r: Role) => r === "house_director";

/** Uninvolved report. Director only. */
export const canViewReports = (r: Role) => r === "house_director";
