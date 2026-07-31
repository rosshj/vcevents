import { HOUSE_CONFIG, GRADES } from "./config";
import { FIRST_NAMES, LAST_NAMES } from "./names";
import type {
  Checkin,
  House,
  PointAward,
  SchoolEvent,
  StaffUser,
  Student,
} from "./types";

export interface Db {
  version: number;
  houses: House[];
  students: Student[];
  events: SchoolEvent[];
  checkins: Checkin[];
  awards: PointAward[];
  staff: StaffUser[];
}

export const DB_VERSION = 2;

/** Deterministic PRNG so "reset data" always rebuilds the same world. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function buildSeedDb(): Db {
  const rand = mulberry32(20260901);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

  const houses: House[] = HOUSE_CONFIG.map((h) => ({ ...h }));

  // ~600 students, ~100 per grade, houses dealt round-robin per grade so
  // every house has a similar footprint in every grade.
  const students: Student[] = [];
  const usedNumbers = new Set<string>();
  const usedNames = new Set<string>();
  let idCounter = 1;
  for (const grade of GRADES) {
    const count = 96 + Math.floor(rand() * 9); // 96-104 per grade
    for (let i = 0; i < count; i++) {
      let firstName = pick(FIRST_NAMES);
      let lastName = pick(LAST_NAMES);
      // Avoid exact duplicate full names; they confuse manual search testing.
      let guard = 0;
      while (usedNames.has(`${firstName} ${lastName}`) && guard++ < 20) {
        firstName = pick(FIRST_NAMES);
        lastName = pick(LAST_NAMES);
      }
      usedNames.add(`${firstName} ${lastName}`);

      let studentNumber = "";
      do {
        studentNumber = String(100000 + Math.floor(rand() * 900000));
      } while (usedNumbers.has(studentNumber));
      usedNumbers.add(studentNumber);

      students.push({
        id: `stu_${String(idCounter++).padStart(4, "0")}`,
        firstName,
        lastName,
        grade,
        houseId: houses[i % houses.length].id,
        studentNumber,
      });
    }
  }

  const staff: StaffUser[] = [
    { id: "staff_01", name: "Mr. D. Kelly", role: "house_director" },
    { id: "staff_02", name: "Ms. R. Fontaine", role: "community_teacher" },
    { id: "staff_03", name: "Mr. J. Abello", role: "community_teacher" },
    { id: "staff_04", name: "Br. T. Murphy", role: "community_teacher" },
    { id: "staff_05", name: "Marcus Yee (Gr. 12 Exec)", role: "house_executive" },
    { id: "staff_06", name: "Aidan Walsh (Gr. 11 Exec)", role: "house_executive" },
  ];

  // 3 past, 1 today, 2 future.
  const events: SchoolEvent[] = [
    {
      id: "evt_bbq",
      name: "Welcome Back BBQ",
      date: localDateString(dateOffset(-28)),
      tier: "major",
      pointsPool: 1000,
    },
    {
      id: "evt_movie",
      name: "Grade 7 Movie Night",
      date: localDateString(dateOffset(-14)),
      tier: "minor",
      pointsPool: 400,
    },
    {
      id: "evt_terryfox",
      name: "Terry Fox Run",
      date: localDateString(dateOffset(-7)),
      tier: "minor",
      pointsPool: 400,
    },
    {
      id: "evt_assembly",
      name: "House Games Assembly",
      date: localDateString(dateOffset(0)),
      tier: "minor",
      pointsPool: 400,
    },
    {
      id: "evt_openhouse",
      name: "Open House Volunteer Night",
      date: localDateString(dateOffset(8)),
      tier: "minor",
      pointsPool: 400,
    },
    {
      id: "evt_concert",
      name: "Christmas Concert",
      date: localDateString(dateOffset(22)),
      tier: "major",
      pointsPool: 1000,
    },
  ];

  // Check-ins for the past events. Houses and grades get distinct
  // personalities so the reports have real texture: Loyola shows up in
  // force, Aquinas is struggling, grade 9 dips, seniors carry.
  const houseFactor: Record<string, number> = {
    loyola: 1.3,
    brebeuf: 1.05,
    xavier: 0.9,
    aquinas: 0.62,
  };
  const gradeFactor: Record<number, number> = {
    7: 0.72,
    8: 0.95,
    9: 0.68,
    10: 1.0,
    11: 1.18,
    12: 1.32,
  };
  const checkins: Checkin[] = [];
  const seedCheckinsFor = (
    event: SchoolEvent,
    attendance: number,
    daysAgo: number,
    gradeOverride?: (grade: number) => number
  ) => {
    const eventDay = dateOffset(-daysAgo);
    eventDay.setHours(17, 30, 0, 0);
    for (const s of students) {
      const gf = gradeOverride
        ? gradeOverride(s.grade)
        : gradeFactor[s.grade] ?? 1;
      const p = Math.min(
        attendance * (houseFactor[s.houseId] ?? 1) * gf,
        0.97
      );
      if (rand() < p) {
        const method =
          rand() < 0.55 ? "qr" : rand() < 0.75 ? "id_scan" : "manual";
        const at = new Date(eventDay.getTime() + Math.floor(rand() * 90) * 60000);
        checkins.push({
          id: `chk_seed_${event.id}_${s.id}`,
          eventId: event.id,
          studentId: s.id,
          method,
          operatorId: pick(staff).id,
          createdAt: at.toISOString(),
        });
      }
    }
  };
  seedCheckinsFor(events[0], 0.6, 28);
  // Movie night skews heavily junior — seniors mostly skip it.
  seedCheckinsFor(events[1], 0.42, 14, (grade) =>
    grade <= 8 ? 1.5 : grade === 9 ? 0.9 : 0.25
  );
  seedCheckinsFor(events[2], 0.4, 7);

  // Point awards for the two past events (human-decided numbers).
  const awardedAt = (daysAgo: number) => {
    const d = dateOffset(-daysAgo);
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
  };
  const awards: PointAward[] = [
    { eventId: "evt_bbq", houseId: "loyola", points: 400, note: "Highest turnout and ran the grill crew" },
    { eventId: "evt_bbq", houseId: "brebeuf", points: 300, note: "Second in turnout, strong setup help" },
    { eventId: "evt_bbq", houseId: "xavier", points: 200, note: "Solid showing" },
    { eventId: "evt_bbq", houseId: "aquinas", points: 100, note: "Lower turnout this time" },
    { eventId: "evt_terryfox", houseId: "aquinas", points: 160, note: "Top fundraising per runner" },
    { eventId: "evt_terryfox", houseId: "xavier", points: 120, note: "Best turnout on the day" },
    { eventId: "evt_terryfox", houseId: "loyola", points: 80, note: "Good spirit section" },
    { eventId: "evt_terryfox", houseId: "brebeuf", points: 40, note: "Participation" },
  ].map((a, i) => ({
    ...a,
    id: `awd_seed_${i + 1}`,
    awardedBy: "staff_01",
    createdAt: awardedAt(a.eventId === "evt_bbq" ? 20 : 6),
  }));

  return { version: DB_VERSION, houses, students, events, checkins, awards, staff };
}
