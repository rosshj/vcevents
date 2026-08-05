import type { Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  house_director: "House Director",
  community_teacher: "Community Teacher",
  house_executive: "House Executive",
  student: "Student",
};

export const isStaff = (r: Role) => r !== "student";

/** Run check-in screens (scanner, manual). */
export const canOperate = isStaff;

/** Browse events and event detail. All staff. */
export const canViewEvents = isStaff;

/** Create/edit events. Director only. */
export const canManageEvents = (r: Role) => r === "house_director";

/** Award points to houses. Director only. */
export const canAwardPoints = (r: Role) => r === "house_director";

/** Undo an individual check-in. Director or teacher — not executives. */
export const canUndoCheckin = (r: Role) =>
  r === "house_director" || r === "community_teacher";

/** Add a student manually (marked pending). All staff. */
export const canAddStudents = isStaff;

/** View/search the full student list. All staff. */
export const canViewStudents = isStaff;

/** CSV import. Director only. */
export const canImportCsv = (r: Role) => r === "house_director";

/** Uninvolved report. Director only. */
export const canViewReports = (r: Role) => r === "house_director";

/** Create, rename, recolor, or delete houses. Director only. */
export const canManageHouses = (r: Role) => r === "house_director";
