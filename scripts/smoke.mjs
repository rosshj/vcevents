/**
 * End-to-end smoke test. Run the dev server first, then:
 *   npm run smoke
 * Assumes a fresh browser profile (fresh localStorage), so it always starts
 * from the seeded state. Screenshots land in .smoke-shots/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const SHOTS = new URL("../.smoke-shots", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch({
  // Point at a system Chromium if the Playwright-managed one isn't installed.
  executablePath: process.env.SMOKE_CHROMIUM_PATH || undefined,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ["camera"],
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

// ---- Student: pass screen (default role)
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForURL("**/pass", { timeout: 15000 });
await page.waitForSelector('img[alt="Your check-in QR code"]', { timeout: 15000 });
check("pass: QR rendered", true);
const refreshText = await page.textContent("body");
check("pass: countdown visible", /refreshes in \d+s/i.test(refreshText));
check("pass: today's event shown", refreshText.includes("House Games Assembly"));
check("pass: offline chip", refreshText.includes("Ready for offline"));
await page.screenshot({ path: SHOTS + "/01-pass.png" });

// ---- Leaderboard
await page.goto(BASE + "/leaderboard", { waitUntil: "networkidle" });
await page.waitForSelector("text=House Standings");
const lb = await page.textContent("body");
check("leaderboard: Loyola present", lb.includes("Loyola"));
check("leaderboard: has points", /points/i.test(lb));
await page.screenshot({ path: SHOTS + "/02-leaderboard.png" });

// ---- My points
await page.goto(BASE + "/points", { waitUntil: "networkidle" });
await page.waitForSelector("text=My check-ins");
await page.screenshot({ path: SHOTS + "/03-points.png" });
check("points: page loads", true);

// ---- Student cannot access staff screens
await page.goto(BASE + "/events", { waitUntil: "networkidle" });
check(
  "gating: student blocked from /events",
  (await page.textContent("body")).includes("Not available")
);
await page.goto(BASE + "/reports", { waitUntil: "networkidle" });
check(
  "gating: student blocked from /reports",
  (await page.textContent("body")).includes("Not available")
);

// ---- Dev page: switch to community teacher
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.click("text=Community Teacher");
await page.waitForTimeout(300);
const devText = await page.textContent("body");
check("dev: teacher operating-as select", devText.includes("Operating as"));
await page.screenshot({ path: SHOTS + "/04-dev.png" });

// ---- Teacher: sees events hub but no manage/report powers
await page.goto(BASE + "/events", { waitUntil: "networkidle" });
await page.waitForSelector("text=House Games Assembly");
check(
  "events: teacher sees list without New button",
  (await page.getByRole("button", { name: "New", exact: true }).count()) === 0
);
await page.goto(BASE + "/reports", { waitUntil: "networkidle" });
check(
  "gating: teacher blocked from /reports",
  (await page.textContent("body")).includes("Not available")
);
await page.screenshot({ path: SHOTS + "/05-events-hub.png" });

// ---- Event detail: live scoreboard + start scanning
await page.goto(BASE + "/events", { waitUntil: "networkidle" });
await page.click("text=House Games Assembly");
await page.waitForSelector("text=House race");
const detailText = await page.textContent("body");
check("event detail: scoreboard section", detailText.includes("checked in"));
check(
  "event detail: teacher has no award/edit",
  !detailText.includes("Award points") && !/\bEdit\b/.test(detailText)
);
await page.screenshot({ path: SHOTS + "/06-event-detail.png" });
// The docked bar is the scan control — tapping it starts + opens the sheet.
await page.click('button[aria-label="Start scanning"]');
await page.waitForSelector('button[aria-label="Minimize scanner"]', {
  timeout: 10000,
});
await page.waitForTimeout(2500);
await page.screenshot({ path: SHOTS + "/07-scanner.png" });
check("scanner: sheet opens", true);
// Regression guard: the camera must actually start (fake device in CI),
// not sit on "Starting camera…" forever.
const camOn = await page.evaluate(() => {
  const v = document.querySelector("video");
  return Boolean(v && !v.paused && v.readyState >= 2);
});
check("scanner: camera stream started", camOn);

// ---- Manual check-in
await page.goto(BASE + "/operate/manual", { waitUntil: "networkidle" });
await page.fill('input[placeholder*="Search name"]', "31");
await page.waitForTimeout(600);
const rowText = await page.textContent("body");
const numMatch = rowText.match(/#(\d{6})/);
check("manual: search by number prefix works", !!numMatch);
const studentNumber = numMatch ? numMatch[1] : null;

await page.fill('input[placeholder*="Search name"]', "");
await page.click("text=G9");
await page.waitForTimeout(600);
await page.locator('button:has-text("Check in")').first().click();
await page.waitForSelector("text=Checked in", { timeout: 5000 });
check("manual: one-tap check-in works", true);
await page.screenshot({ path: SHOTS + "/08-manual.png" });

// ---- Scanner wedge-scan paths (the legacy /operate/scan URL re-opens the
// sheet; there's no keyboard button — wedge scanners type straight into the
// sheet, and so does the test)
if (studentNumber) {
  await page.goto(BASE + "/operate/scan", { waitUntil: "networkidle" });
  await page.waitForSelector('button[aria-label="Minimize scanner"]', {
    timeout: 10000,
  });
  check(
    "scanner: session stats visible",
    (await page.textContent("body")).includes("of school")
  );
  await page.keyboard.type(studentNumber);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const overlayText = await page.textContent("body");
  check(
    "scanner: wedge-scanned student number produces result overlay",
    /Already checked in/i.test(overlayText) || /Grade \d+/.test(overlayText)
  );
  await page.screenshot({ path: SHOTS + "/09-scan-result.png" });

  await page.waitForTimeout(3500);
  await page.keyboard.type(studentNumber);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  check(
    "scanner: duplicate shows amber state",
    /Already checked in/i.test(await page.textContent("body"))
  );

  await page.waitForTimeout(2500);
  await page.keyboard.type("000001");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  check(
    "scanner: unknown code shows red state",
    /not recognized/i.test(await page.textContent("body"))
  );
}

// ---- Minimizing the sheet reveals the event detail underneath
await page.click('button[aria-label="Minimize scanner"]');
await page.waitForSelector("text=House race");
check("scanner: minimize reveals event detail", true);
check(
  "event detail: undo visible for teacher",
  (await page.locator('button[aria-label="Undo check-in"]').count()) > 0
);

// ---- Operating bar: docked above the tab bar on root tabs
await page.goto(BASE + "/leaderboard", { waitUntil: "networkidle" });
await page.waitForSelector("text=Scanning ·");
check("operating bar: shows while operating", true);
await page.screenshot({ path: SHOTS + "/09b-operating-bar.png" });
// Tapping the bar expands the scanner sheet again.
await page.click('button[aria-label="Expand scanner"]');
await page.waitForSelector('button[aria-label="Minimize scanner"]', {
  timeout: 5000,
});
check("operating bar: tap expands the sheet", true);
await page.click('button[aria-label="Minimize scanner"]');
await page.waitForSelector('button[aria-label="Stop operating this event"]', {
  timeout: 5000,
});
await page.click('button[aria-label="Stop operating this event"]');
// allow the exit animation to finish before asserting removal
await page.waitForTimeout(900);
check(
  "operating bar: stop clears it",
  (await page.locator("text=Scanning ·").count()) === 0
);

// ---- Executive: no undo on event detail
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.click("text=House Executive");
await page.waitForTimeout(300);
await page.goto(BASE + "/events", { waitUntil: "networkidle" });
await page.click("text=House Games Assembly");
await page.waitForSelector("text=House race");
check(
  "gating: executive cannot undo",
  (await page.locator('button[aria-label="Undo check-in"]').count()) === 0
);

// ---- Director: create event, award points
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.click("text=House Director");
await page.waitForTimeout(300);

await page.goto(BASE + "/events", { waitUntil: "networkidle" });
await page.waitForSelector("text=Welcome Back BBQ");
// New event opens a sheet in place rather than routing away.
await page.getByRole("button", { name: "New", exact: true }).click();
await page.waitForSelector("#event-name", { timeout: 5000 });
await page.waitForTimeout(900); // let the sheet finish travelling
await page.fill("#event-name", "Smoke Test Social");
// tier segmented control drives the default pool
await page.click('[role="radio"]:has-text("Major")');
const poolVal = await page.inputValue("#event-pool");
check("events: tier picks default pool", poolVal === "1000", poolVal);
await page.click('button:has-text("Create event")');
await page.waitForSelector("#event-name", { state: "detached", timeout: 5000 });
await page.waitForSelector("text=Smoke Test Social", { timeout: 5000 });
check("events: director create works", true);

await page.click("text=Welcome Back BBQ");
await page.waitForSelector("text=Attendance by house");
// Edit opens the same form sheet, prefilled.
await page.getByRole("button", { name: "Edit", exact: true }).click();
await page.waitForSelector("#event-name", { timeout: 5000 });
await page.waitForTimeout(900);
check(
  "events: edit opens prefilled sheet",
  (await page.inputValue("#event-name")) === "Welcome Back BBQ"
);
await page.keyboard.press("Escape");
await page.waitForSelector("#event-name", { state: "detached", timeout: 5000 });
await page.locator('a[href$="/award"]').click();
await page.waitForURL("**/award", { timeout: 10000 });
await page.waitForSelector("text=Award points");
check("award: check-in breakdown shown", /\d+ in/.test(await page.textContent("body")));
await page.screenshot({ path: SHOTS + "/10-award.png" });
await page.locator('input[type="number"]').first().fill("410");
await page.click('button:has-text("Save points")');
await page.waitForURL("**/events", { timeout: 10000 });
check("award: save navigates back", true);

// Aquinas: 410 (edited BBQ) + 160 (Terry Fox) = 570 total on the leaderboard
await page.goto(BASE + "/leaderboard", { waitUntil: "networkidle" });
check("award: leaderboard updated", (await page.textContent("body")).includes("570"));

// ---- Students: list, CSV import, add, detail
await page.goto(BASE + "/students", { waitUntil: "networkidle" });
await page.waitForSelector("text=Students");
check("students: total ~600", /\d{3} students/.test(await page.textContent("body")));
await page.click('a[href="/students/import"]');
await page.waitForURL("**/students/import", { timeout: 5000 });
await page.fill("#csv", "Testy,McTestface,9,Loyola,999111");
await page.click('button:has-text("Import")');
await page.waitForSelector("text=Imported 1 student", { timeout: 5000 });
check("students: CSV import works", true);
await page.goto(BASE + "/students", { waitUntil: "networkidle" });
await page.fill('input[placeholder*="Search name"]', "McTestface");
await page.waitForTimeout(600);
check(
  "students: imported student searchable",
  (await page.textContent("body")).includes("McTestface")
);
// Add student now opens a Silk sheet in place rather than routing away.
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForSelector("#student-first", { timeout: 5000 });
// Let the sheet finish travelling before interacting — mid-animation the
// controls are still below the fold.
await page.waitForTimeout(900);
check(
  "students: add form opens in a sheet",
  (await page.locator("#student-first").boundingBox()).y < 400
);
await page.fill("#student-first", "Pendy");
await page.fill("#student-last", "Pendington");
await page.click('[role="radio"]:has-text("Xavier")');
await page.fill("#student-number", "999222");
await page.click('button:has-text("Add student")');
await page.waitForSelector("#student-first", { state: "detached", timeout: 5000 });
check("students: sheet closes after save", true);
await page.fill('input[placeholder*="Search name"]', "Pendington");
await page.waitForTimeout(600);
const addedRow = await page.textContent("body");
check(
  "students: manual add shows pending badge",
  addedRow.includes("pending") && addedRow.includes("Xavier")
);

// student detail via row tap
await page.click("text=Pendington, Pendy");
await page.waitForSelector("text=Check-in history");
const sdText = await page.textContent("body");
check(
  "student detail: identity + empty history",
  sdText.includes("#999222") && sdText.includes("No check-ins yet")
);
await page.screenshot({ path: SHOTS + "/11-student-detail.png" });

// ---- Reports hub + drill-downs
await page.goto(BASE + "/reports", { waitUntil: "networkidle" });
await page.waitForSelector("text=Participation by grade");
await page.waitForSelector("text=Check-ins per event", { timeout: 10000 });
await page.waitForTimeout(1500); // chart enter animations
const repText = await page.textContent("body");
check("reports: hub has house participation", repText.includes("Participation by house"));
check("reports: hub links to nudge lists", repText.includes("One-and-done"));
check(
  "reports: bklit charts render",
  (await page.locator("svg").count()) >= 3 &&
    repText.includes("Check-ins by house") &&
    repText.includes("House engagement by grade")
);
await page.screenshot({ path: SHOTS + "/12-reports.png" });
await page.click("text=Uninvolved students");
await page.waitForURL("**/reports/uninvolved", { timeout: 5000 });
await page.waitForSelector("text=worth a nudge");
check("reports: uninvolved grade groups", /Grade \d+ · \d+/.test(await page.textContent("body")));
await page.goto(BASE + "/reports/one-and-done", { waitUntil: "networkidle" });
await page.waitForSelector("text=One-and-done");
check("reports: one-and-done loads", true);

// ---- Dev: ID card simulator renders barcode
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.fill('input[placeholder*="Search name"]', "31");
await page.waitForTimeout(600);
await page.locator("button", { hasText: /#\d{6}/ }).first().click();
await page.waitForSelector("text=ID card barcode", { timeout: 5000 });
const barcodeRects = await page.locator("svg rect").count();
check("dev: Code 128 barcode rendered", barcodeRects > 10, `${barcodeRects} bars`);
await page.waitForSelector('img[alt="Student pass QR"]');
check("dev: pass QR rendered", true);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
const realErrors = errors.filter(
  (e) => !e.includes("Download the React DevTools") && !e.includes("favicon")
);
if (realErrors.length) {
  console.log("CONSOLE/PAGE ERRORS:");
  for (const e of realErrors.slice(0, 10)) console.log("  " + e.slice(0, 300));
}
await browser.close();
process.exit(failed.length || realErrors.length ? 1 : 0);
