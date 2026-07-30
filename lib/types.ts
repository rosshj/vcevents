export type Role =
  | "house_director"
  | "community_teacher"
  | "house_executive"
  | "student";

export interface House {
  id: string;
  name: string;
  color: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: number; // 7-12
  houseId: string;
  studentNumber: string; // 6 digits
  /** Manually-added students are "pending" until reconciled with the SIS. */
  pending?: boolean;
}

export type EventTier = "major" | "minor";

export interface SchoolEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD (local)
  tier: EventTier;
  pointsPool: number;
}

export type CheckinMethod = "qr" | "id_scan" | "manual";

export interface Checkin {
  id: string; // uuid
  eventId: string;
  studentId: string;
  method: CheckinMethod;
  operatorId: string;
  createdAt: string; // ISO
}

export interface PointAward {
  id: string;
  eventId: string;
  houseId: string;
  points: number;
  awardedBy: string; // staff id
  note: string;
  createdAt: string; // ISO
}

export type StaffRole = Exclude<Role, "student">;

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
}

/** Mock-auth session; in production this comes from Supabase auth. */
export interface SessionState {
  role: Role;
  /** Which student "I" am when role === 'student'. */
  studentId: string | null;
  /** Operator identity for staff roles. */
  staffId: string | null;
  /** Event currently being operated (check-in screens). */
  activeEventId: string | null;
}

export type CheckinResult =
  | { status: "created"; checkin: Checkin }
  | { status: "duplicate"; checkin: Checkin };

export interface LeaderboardRow {
  house: House;
  points: number;
}

export interface CsvImportResult {
  added: number;
  errors: string[];
}
