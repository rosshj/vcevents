# VC House Points — UX Prototype

A local-only prototype of the Vancouver College house points check-in app.
Students check in to school events (rotating QR pass, ID-card barcode scan, or
manual lookup), staff award points to houses per event, and everyone watches
the house leaderboard.

**This phase is fake-data only**: no Supabase, no network, no real auth.
Everything runs from seeded data persisted in the browser's localStorage. The
goal is to nail the flows and screens before wiring anything real.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 on a phone-sized viewport. First load seeds
4 houses, ~600 students, 5 events (2 past with check-ins and point awards,
1 today, 2 future), and a handful of staff operators.

## Mock auth

The chip in the top-right corner opens **/dev**, where you can:

- Switch between the four roles (House Director, Community Teacher, House
  Executive, Student) and pick *which* student or staff member you are.
  The selection persists across reloads.
- Render any student's **Code 128 ID-card barcode** and current **pass QR**
  to point a second device's scanner at.
- **Reset data** back to the seeded state.

Role gates mirror production:

| | Director | Teacher | Executive | Student |
|---|---|---|---|---|
| Check-in screens (scan / manual / tally) | ✓ | ✓ | ✓ | – |
| Undo a check-in | ✓ | ✓ | – | – |
| Add students (pending) | ✓ | ✓ | ✓ | – |
| Events + award points | ✓ | – | – | – |
| CSV import, uninvolved report | ✓ | – | – | – |
| Own pass / points / leaderboard | – | – | – | ✓ |

## Architecture notes for the Supabase swap

- **All data access goes through `lib/repo.ts`** (`Repo` interface, async
  throughout). Components never touch localStorage. Swapping to Supabase (and
  slotting in an offline sync queue) means replacing `LocalStorageRepo` only.
- **Types in `lib/types.ts` mirror the planned Postgres schema** (Student,
  House, Event, Checkin, PointAward, Role). The repo enforces unique
  `(eventId, studentId)` per check-in.
- **The QR pass payload** (`lib/qr.ts`) encodes `{sid, tw, sig}` with a
  60-second rotating time window. `sig` is a fake hash today; production
  swaps in a server-issued HMAC without changing the payload shape.
- **House names/colors are placeholders** — configurable in `lib/config.ts`.
- Scanning uses `@zxing/browser` (QR + Code 128/39, works in mobile Safari);
  QR rendering uses `qrcode`; the dev-page barcode uses `jsbarcode`.

## Screens

- **Student**: `/pass` (rotating QR, today's event, offline chip),
  `/points` (my check-ins, house-contribution framing), `/leaderboard`.
- **Operator**: `/operate` (event picker), `/operate/scan` (camera scanner
  with green/amber/red full-screen results, typed/wedge-scan fallback, live
  tally chip), `/operate/manual` (search + grade chips + one-tap check-in +
  add student), `/operate/tally` (list with per-house counts and undo).
- **Director**: `/events` (create/edit, tier, points pool),
  `/events/[id]/award` (check-in breakdown by house as the input; points are
  always human-decided; note required), `/roster` (search, pending-flagged
  manual adds, CSV import `firstName,lastName,grade,house,studentNumber`),
  `/reports/uninvolved` (zero check-ins this year, grouped by grade).
