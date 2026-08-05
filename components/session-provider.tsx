"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { repo } from "@/lib/repo";
import type {
  House,
  Role,
  SessionState,
  StaffUser,
  Student,
} from "@/lib/types";
import { isStaff } from "@/lib/permissions";
import { DATA_CHANGED_EVENT } from "@/lib/data-events";

interface SessionContextValue {
  ready: boolean;
  session: SessionState;
  houses: House[];
  staff: StaffUser[];
  currentStudent: Student | null;
  currentStaff: StaffUser | null;
  setRole: (role: Role, opts?: { studentId?: string; staffId?: string }) => void;
  setStudentId: (studentId: string) => void;
  setStaffId: (staffId: string) => void;
  setActiveEventId: (eventId: string | null) => void;
  houseById: (id: string) => House | undefined;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const DEFAULT_SESSION: SessionState = {
  role: "student",
  studentId: null,
  staffId: null,
  activeEventId: null,
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSessionState] = useState<SessionState>(DEFAULT_SESSION);
  const [houses, setHouses] = useState<House[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await repo.ensureSeeded();
      const [housesList, staffList, stored] = await Promise.all([
        repo.listHouses(),
        repo.listStaff(),
        repo.getSession(),
      ]);
      let s = stored;
      if (!s) {
        // First run: be a student so the pass screen is the first thing seen.
        const students = await repo.listStudents();
        s = { ...DEFAULT_SESSION, studentId: students[0]?.id ?? null };
        await repo.setSession(s);
      }
      const student = s.studentId ? await repo.getStudent(s.studentId) : null;
      if (cancelled) return;
      setHouses(housesList);
      setStaff(staffList);
      setSessionState(s);
      setCurrentStudent(student);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Setters read the latest session from a ref and run side effects
  // OUTSIDE the state updater — updaters must stay pure (StrictMode
  // re-invokes them, which double-wrote localStorage before).
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Houses are edited at runtime now (Houses tab CRUD), so the cached
  // list has to follow the same broadcast contract as every other write.
  useEffect(() => {
    const refresh = () => {
      void repo.listHouses().then(setHouses);
    };
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, refresh);
  }, []);

  const persist = useCallback(async (next: SessionState) => {
    setSessionState(next);
    sessionRef.current = next;
    await repo.setSession(next);
    setCurrentStudent(next.studentId ? await repo.getStudent(next.studentId) : null);
  }, []);

  const setRole = useCallback(
    (role: Role, opts?: { studentId?: string; staffId?: string }) => {
      const prev = sessionRef.current;
      const next: SessionState = { ...prev, role };
      if (role === "student") {
        next.staffId = null;
        if (opts?.studentId) next.studentId = opts.studentId;
      } else {
        const match =
          opts?.staffId ??
          prev.staffId ??
          staff.find((st) => st.role === role)?.id ??
          null;
        // Keep the staff identity consistent with the chosen role.
        const staffUser = staff.find((st) => st.id === match);
        next.staffId =
          staffUser && staffUser.role === role
            ? staffUser.id
            : staff.find((st) => st.role === role)?.id ?? null;
      }
      void persist(next);
    },
    [staff, persist]
  );

  const setStudentId = useCallback(
    (studentId: string) => {
      void persist({ ...sessionRef.current, studentId });
    },
    [persist]
  );

  const setStaffId = useCallback(
    (staffId: string) => {
      const prev = sessionRef.current;
      const staffUser = staff.find((st) => st.id === staffId);
      void persist({
        ...prev,
        staffId,
        role: staffUser && isStaff(staffUser.role) ? staffUser.role : prev.role,
      });
    },
    [staff, persist]
  );

  const setActiveEventId = useCallback(
    (eventId: string | null) => {
      void persist({ ...sessionRef.current, activeEventId: eventId });
    },
    [persist]
  );

  const value = useMemo<SessionContextValue>(() => {
    const currentStaff = staff.find((st) => st.id === session.staffId) ?? null;
    return {
      ready,
      session,
      houses,
      staff,
      currentStudent,
      currentStaff,
      setRole,
      setStudentId,
      setStaffId,
      setActiveEventId,
      houseById: (id: string) => houses.find((h) => h.id === id),
    };
  }, [
    ready,
    session,
    houses,
    staff,
    currentStudent,
    setRole,
    setStudentId,
    setStaffId,
    setActiveEventId,
  ]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
