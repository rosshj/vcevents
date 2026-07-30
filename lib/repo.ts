/**
 * Data-access layer. Every read/write in the app goes through `repo` —
 * components never touch localStorage directly. The interface is async
 * throughout so the localStorage implementation can be swapped for
 * Supabase (and a sync queue) without touching any component.
 */
import { buildSeedDb, DB_VERSION, type Db } from "./seed";
import type {
  Checkin,
  CheckinMethod,
  CheckinResult,
  CsvImportResult,
  House,
  LeaderboardRow,
  PointAward,
  SchoolEvent,
  SessionState,
  StaffUser,
  Student,
} from "./types";
import { GRADES } from "./config";

const DB_KEY = "vc.housepoints.db.v1";
const SESSION_KEY = "vc.housepoints.session.v1";

export interface Repo {
  ensureSeeded(): Promise<void>;
  resetData(): Promise<void>;

  listHouses(): Promise<House[]>;
  listStaff(): Promise<StaffUser[]>;

  listStudents(): Promise<Student[]>;
  getStudent(id: string): Promise<Student | null>;
  findStudentByNumber(studentNumber: string): Promise<Student | null>;
  searchStudents(query: string, grade?: number): Promise<Student[]>;
  addStudent(
    s: Omit<Student, "id" | "pending">,
    opts?: { pending?: boolean }
  ): Promise<Student>;
  importStudentsCsv(csv: string): Promise<CsvImportResult>;

  listEvents(): Promise<SchoolEvent[]>;
  getEvent(id: string): Promise<SchoolEvent | null>;
  getTodaysEvent(): Promise<SchoolEvent | null>;
  createEvent(e: Omit<SchoolEvent, "id">): Promise<SchoolEvent>;
  updateEvent(
    id: string,
    patch: Partial<Omit<SchoolEvent, "id">>
  ): Promise<SchoolEvent>;

  listCheckins(eventId: string): Promise<Checkin[]>;
  listCheckinsByStudent(studentId: string): Promise<Checkin[]>;
  countCheckins(eventId: string): Promise<number>;
  /** Enforces unique (eventId, studentId): returns the existing check-in as 'duplicate'. */
  createCheckin(input: {
    eventId: string;
    studentId: string;
    method: CheckinMethod;
    operatorId: string;
  }): Promise<CheckinResult>;
  undoCheckin(checkinId: string): Promise<void>;

  listAwards(eventId?: string): Promise<PointAward[]>;
  /** Replaces the awards for an event (points are set per house, human-decided). */
  awardPoints(
    eventId: string,
    entries: { houseId: string; points: number }[],
    awardedBy: string,
    note: string
  ): Promise<PointAward[]>;
  leaderboard(): Promise<LeaderboardRow[]>;

  /** Students with zero check-ins across all events ("this year"). */
  uninvolvedStudents(): Promise<Student[]>;

  getSession(): Promise<SessionState | null>;
  setSession(s: SessionState): Promise<void>;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function todayString(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

class LocalStorageRepo implements Repo {
  private cache: Db | null = null;

  private load(): Db {
    if (this.cache) return this.cache;
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed.version === DB_VERSION) {
        this.cache = parsed;
        return parsed;
      }
    }
    const db = buildSeedDb();
    this.cache = db;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  private save(db: Db) {
    this.cache = db;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  async ensureSeeded(): Promise<void> {
    this.load();
  }

  async resetData(): Promise<void> {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
    this.cache = null;
    this.load();
  }

  async listHouses(): Promise<House[]> {
    return this.load().houses;
  }

  async listStaff(): Promise<StaffUser[]> {
    return this.load().staff;
  }

  async listStudents(): Promise<Student[]> {
    return this.load().students;
  }

  async getStudent(id: string): Promise<Student | null> {
    return this.load().students.find((s) => s.id === id) ?? null;
  }

  async findStudentByNumber(studentNumber: string): Promise<Student | null> {
    return (
      this.load().students.find((s) => s.studentNumber === studentNumber) ??
      null
    );
  }

  async searchStudents(query: string, grade?: number): Promise<Student[]> {
    const q = query.trim().toLowerCase();
    let results = this.load().students;
    if (grade) results = results.filter((s) => s.grade === grade);
    if (q) {
      results = results.filter((s) => {
        const full = `${s.firstName} ${s.lastName}`.toLowerCase();
        const reversed = `${s.lastName} ${s.firstName}`.toLowerCase();
        return (
          full.includes(q) ||
          reversed.includes(q) ||
          s.studentNumber.startsWith(q)
        );
      });
    }
    return [...results].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
  }

  async addStudent(
    s: Omit<Student, "id" | "pending">,
    opts?: { pending?: boolean }
  ): Promise<Student> {
    const db = this.load();
    if (db.students.some((x) => x.studentNumber === s.studentNumber)) {
      throw new Error(`Student number ${s.studentNumber} already exists`);
    }
    const student: Student = {
      ...s,
      id: `stu_${uuid()}`,
      pending: opts?.pending ?? true,
    };
    db.students.push(student);
    this.save(db);
    return student;
  }

  async importStudentsCsv(csv: string): Promise<CsvImportResult> {
    const db = this.load();
    const houseByName = new Map(
      db.houses.map((h) => [h.name.toLowerCase(), h.id])
    );
    const errors: string[] = [];
    let added = 0;
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && /firstname/i.test(line)) continue; // header row
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length !== 5) {
        errors.push(`Line ${i + 1}: expected 5 columns, got ${parts.length}`);
        continue;
      }
      const [firstName, lastName, gradeRaw, houseRaw, studentNumber] = parts;
      const grade = Number(gradeRaw);
      if (!GRADES.includes(grade as (typeof GRADES)[number])) {
        errors.push(`Line ${i + 1}: invalid grade "${gradeRaw}"`);
        continue;
      }
      const houseId = houseByName.get(houseRaw.toLowerCase());
      if (!houseId) {
        errors.push(`Line ${i + 1}: unknown house "${houseRaw}"`);
        continue;
      }
      if (!/^\d{6}$/.test(studentNumber)) {
        errors.push(`Line ${i + 1}: student number must be 6 digits`);
        continue;
      }
      if (db.students.some((s) => s.studentNumber === studentNumber)) {
        errors.push(`Line ${i + 1}: student number ${studentNumber} already exists`);
        continue;
      }
      db.students.push({
        id: `stu_${uuid()}`,
        firstName,
        lastName,
        grade,
        houseId,
        studentNumber,
      });
      added++;
    }
    if (added > 0) this.save(db);
    return { added, errors };
  }

  async listEvents(): Promise<SchoolEvent[]> {
    return [...this.load().events].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getEvent(id: string): Promise<SchoolEvent | null> {
    return this.load().events.find((e) => e.id === id) ?? null;
  }

  async getTodaysEvent(): Promise<SchoolEvent | null> {
    const today = todayString();
    return this.load().events.find((e) => e.date === today) ?? null;
  }

  async createEvent(e: Omit<SchoolEvent, "id">): Promise<SchoolEvent> {
    const db = this.load();
    const event: SchoolEvent = { ...e, id: `evt_${uuid()}` };
    db.events.push(event);
    this.save(db);
    return event;
  }

  async updateEvent(
    id: string,
    patch: Partial<Omit<SchoolEvent, "id">>
  ): Promise<SchoolEvent> {
    const db = this.load();
    const event = db.events.find((e) => e.id === id);
    if (!event) throw new Error(`Event ${id} not found`);
    Object.assign(event, patch);
    this.save(db);
    return event;
  }

  async listCheckins(eventId: string): Promise<Checkin[]> {
    return this.load()
      .checkins.filter((c) => c.eventId === eventId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listCheckinsByStudent(studentId: string): Promise<Checkin[]> {
    return this.load()
      .checkins.filter((c) => c.studentId === studentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async countCheckins(eventId: string): Promise<number> {
    return this.load().checkins.filter((c) => c.eventId === eventId).length;
  }

  async createCheckin(input: {
    eventId: string;
    studentId: string;
    method: CheckinMethod;
    operatorId: string;
  }): Promise<CheckinResult> {
    const db = this.load();
    const existing = db.checkins.find(
      (c) => c.eventId === input.eventId && c.studentId === input.studentId
    );
    if (existing) return { status: "duplicate", checkin: existing };
    const checkin: Checkin = {
      id: uuid(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    db.checkins.push(checkin);
    this.save(db);
    return { status: "created", checkin };
  }

  async undoCheckin(checkinId: string): Promise<void> {
    const db = this.load();
    db.checkins = db.checkins.filter((c) => c.id !== checkinId);
    this.save(db);
  }

  async listAwards(eventId?: string): Promise<PointAward[]> {
    const awards = this.load().awards;
    return eventId ? awards.filter((a) => a.eventId === eventId) : awards;
  }

  async awardPoints(
    eventId: string,
    entries: { houseId: string; points: number }[],
    awardedBy: string,
    note: string
  ): Promise<PointAward[]> {
    if (!note.trim()) throw new Error("A note is required when awarding points");
    const db = this.load();
    db.awards = db.awards.filter((a) => a.eventId !== eventId);
    const createdAt = new Date().toISOString();
    const created = entries
      .filter((e) => e.points > 0)
      .map((e) => ({
        id: `awd_${uuid()}`,
        eventId,
        houseId: e.houseId,
        points: e.points,
        awardedBy,
        note: note.trim(),
        createdAt,
      }));
    db.awards.push(...created);
    this.save(db);
    return created;
  }

  async leaderboard(): Promise<LeaderboardRow[]> {
    const db = this.load();
    const totals = new Map<string, number>(db.houses.map((h) => [h.id, 0]));
    for (const a of db.awards) {
      totals.set(a.houseId, (totals.get(a.houseId) ?? 0) + a.points);
    }
    return db.houses
      .map((house) => ({ house, points: totals.get(house.id) ?? 0 }))
      .sort((a, b) => b.points - a.points);
  }

  async uninvolvedStudents(): Promise<Student[]> {
    const db = this.load();
    const involved = new Set(db.checkins.map((c) => c.studentId));
    return db.students
      .filter((s) => !involved.has(s.id))
      .sort(
        (a, b) =>
          a.grade - b.grade ||
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`
          )
      );
  }

  async getSession(): Promise<SessionState | null> {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  }

  async setSession(s: SessionState): Promise<void> {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
}

export const repo: Repo = new LocalStorageRepo();
