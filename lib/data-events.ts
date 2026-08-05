/**
 * The app's write-broadcast contract.
 *
 * Every mutation — check-in, undo, award, student/event/house CRUD —
 * announces itself so live views (the events hub hero, the scanner bar's
 * tally, the session's house cache) refetch. Lives in `lib/` rather than
 * beside any one sheet so providers can subscribe without importing a
 * component (and creating an import cycle).
 */
export const DATA_CHANGED_EVENT = "vc:data-changed";

export function notifyDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
  }
}
