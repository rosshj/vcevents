"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { Guard, Screen } from "@/components/guard";
import { usePageHeader } from "@/components/page-header";
import { canAddStudents } from "@/lib/permissions";
import { repo } from "@/lib/repo";
import { StudentForm } from "@/components/student-form";

function NewStudentScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useSession();
  // Manual check-in links here with ?checkin=1: add the student, check
  // them in to the event being operated, and return to the search.
  const checkinMode = searchParams.get("checkin") === "1" && Boolean(session.activeEventId);
  const backHref = checkinMode ? "/operate/manual" : "/students";
  usePageHeader("Add student", backHref);

  return (
    <Screen>
      <StudentForm
        submitLabel={checkinMode ? "Add & check in" : "Add student"}
        onSaved={async (student) => {
          if (checkinMode && session.activeEventId) {
            await repo.createCheckin({
              eventId: session.activeEventId,
              studentId: student.id,
              method: "manual",
              operatorId: session.staffId ?? "unknown",
            });
          }
          router.push(backHref);
        }}
      />
    </Screen>
  );
}

export default function NewStudentPage() {
  return (
    <Guard allow={canAddStudents}>
      <Suspense fallback={null}>
        <NewStudentScreen />
      </Suspense>
    </Guard>
  );
}
