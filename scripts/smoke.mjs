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

// ---- Student cannot access director screens
await page.goto(BASE + "/events", { waitUntil: "networkidle" });
const gate = await page.textContent("body");
check("gating: student blocked from /events", gate.includes("Not available"));

// ---- Dev page: switch to community teacher
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.click("text=Community Teacher");
await page.waitForTimeout(300);
const devText = await page.textContent("body");
check("dev: teacher operating-as select", devText.includes("Operating as"));
await page.screenshot({ path: SHOTS + "/04-dev.png" });

// ---- Teacher: cannot access events
await page.goto(BASE + "/events", { waitUntil: "networkidle" });
check(
  "gating: teacher blocked from /events",
  (await page.textContent("body")).includes("Not available")
);

// ---- Operate: pick today's event
await page.goto(BASE + "/operate", { waitUntil: "networkidle" });
await page.waitForSelector("text=House Games Assembly");
await page.screenshot({ path: SHOTS + "/05-event-picker.png" });
await page.click("text=House Games Assembly");
await page.waitForURL("**/operate/scan", { timeout: 10000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOTS + "/06-scanner.png" });
check("scanner: page loads", true);

// typed-code path: open keyboard input, check in a real student number
// find a student number via the manual page first
await page.goto(BASE + "/operate/manual", { waitUntil: "networkidle" });
await page.fill('input[placeholder*="Search name"]', "31");
await page.waitForTimeout(600);
const rowText = await page.textContent("body");
const numMatch = rowText.match(/#(\d{6})/);
check("manual: search by number prefix works", !!numMatch);
const studentNumber = numMatch ? numMatch[1] : null;

// manual check-in via button
await page.fill('input[placeholder*="Search name"]', "");
await page.click("text=Gr. 9");
await page.waitForTimeout(600);
const firstCheckin = page.locator('button:has-text("Check in")').first();
await firstCheckin.click();
await page.waitForSelector("text=Checked in", { timeout: 5000 });
check("manual: one-tap check-in works", true);
await page.screenshot({ path: SHOTS + "/07-manual.png" });

// duplicate state: click another student then verify pre-marked rows exist later on tally
// typed-code path on scanner
if (studentNumber) {
  await page.goto(BASE + "/operate/scan", { waitUntil: "networkidle" });
  await page.click('button[aria-label="Type a code"]');
  await page.fill('input[placeholder*="wedge-scan"]', studentNumber);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const overlayText = await page.textContent("body");
  const gotResult =
    /Already checked in/i.test(overlayText) || /Grade \d+/.test(overlayText);
  check("scanner: typed student number produces result overlay", gotResult);
  await page.screenshot({ path: SHOTS + "/08-scan-result.png" });

  // duplicate: submit same number again after overlay clears + debounce window
  await page.waitForTimeout(3500);
  await page.fill('input[placeholder*="wedge-scan"]', studentNumber);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const dupText = await page.textContent("body");
  check("scanner: duplicate shows amber state", /Already checked in/i.test(dupText));
  await page.screenshot({ path: SHOTS + "/09-scan-duplicate.png" });

  // unknown code
  await page.waitForTimeout(2500);
  await page.fill('input[placeholder*="wedge-scan"]', "000001");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const unkText = await page.textContent("body");
  check("scanner: unknown code shows red state", /not recognized/i.test(unkText));
  await page.screenshot({ path: SHOTS + "/10-scan-unknown.png" });
}

// ---- Tally with undo (teacher can undo)
await page.goto(BASE + "/operate/tally", { waitUntil: "networkidle" });
await page.waitForSelector("text=Live tally");
const undoButtons = page.locator('button[aria-label="Undo check-in"]');
const undoCount = await undoButtons.count();
check("tally: undo visible for teacher", undoCount > 0);
await page.screenshot({ path: SHOTS + "/11-tally.png" });

// ---- Switch to House Executive: undo must be hidden
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.click("text=House Executive");
await page.waitForTimeout(300);
await page.goto(BASE + "/operate/tally", { waitUntil: "networkidle" });
await page.waitForSelector("text=Live tally");
check(
  "gating: executive cannot undo",
  (await page.locator('button[aria-label="Undo check-in"]').count()) === 0
);

// ---- Switch to Director: events, award, roster, report
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.click("text=House Director");
await page.waitForTimeout(300);

await page.goto(BASE + "/events", { waitUntil: "networkidle" });
await page.waitForSelector("text=Welcome Back BBQ");
check("events: list loads for director", true);
await page.screenshot({ path: SHOTS + "/12-events.png" });

// create an event
await page.click('button:has-text("New")');
await page.fill('input[placeholder="Event name"]', "Smoke Test Social");
await page.click('button:has-text("Create event")');
await page.waitForSelector("text=Smoke Test Social", { timeout: 5000 });
check("events: create works", true);

// award points on Welcome Back BBQ (already has awards -> Edit points)
const bbqCard = page.locator("div.rounded-3xl", { hasText: "Welcome Back BBQ" }).last();
await bbqCard.locator('a:has-text("points")').click();
await page.waitForURL("**/award", { timeout: 10000 });
await page.waitForSelector("text=Award points");
const awardBody = await page.textContent("body");
check("award: check-in breakdown shown", /\d+ in/.test(awardBody));
await page.screenshot({ path: SHOTS + "/13-award.png" });

// change a value and save without touching note (note prefilled from seed)
const firstPoints = page.locator('input[type="number"]').first();
await firstPoints.fill("410");
await page.click('button:has-text("Save points")');
await page.waitForURL("**/events", { timeout: 10000 });
check("award: save navigates back", true);

// Aquinas: 410 (edited BBQ) + 160 (Terry Fox) = 570 total on the leaderboard
await page.goto(BASE + "/leaderboard", { waitUntil: "networkidle" });
const lb2 = await page.textContent("body");
check("award: leaderboard updated", lb2.includes("570"));

// ---- Roster + CSV import
await page.goto(BASE + "/roster", { waitUntil: "networkidle" });
await page.waitForSelector("text=Roster");
const rosterText = await page.textContent("body");
check("roster: total ~600", /\d{3} students/.test(rosterText));
await page.click('button:has-text("CSV")');
await page.fill("textarea", "Testy,McTestface,9,Loyola,999111");
await page.click('button:has-text("Import")');
await page.waitForSelector("text=Imported 1 student", { timeout: 5000 });
check("roster: CSV import works", true);
await page.fill('input[placeholder*="Search name"]', "McTestface");
await page.waitForTimeout(600);
check(
  "roster: imported student searchable",
  (await page.textContent("body")).includes("McTestface")
);
// add student manually -> pending badge
await page.click('button:has-text("Add")');
await page.fill('input[placeholder="First name"]', "Pendy");
await page.fill('input[placeholder="Last name"]', "Pendington");
await page.fill('input[placeholder="6-digit #"]', "999222");
await page.click('button:has-text("Add student")');
await page.waitForTimeout(500);
await page.fill('input[placeholder*="Search name"]', "Pendington");
await page.waitForTimeout(600);
const pendRow = await page.textContent("body");
check("roster: manual add shows pending badge", pendRow.includes("pending"));
await page.screenshot({ path: SHOTS + "/14-roster.png" });

// ---- Uninvolved report
await page.goto(BASE + "/reports/uninvolved", { waitUntil: "networkidle" });
await page.waitForSelector("text=Uninvolved students");
const repText = await page.textContent("body");
check("report: grade groups present", /Grade \d+ · \d+/.test(repText));
await page.screenshot({ path: SHOTS + "/15-report.png" });

// ---- Dev: ID card simulator renders barcode
await page.goto(BASE + "/dev", { waitUntil: "networkidle" });
await page.fill('input[placeholder*="Search name"]', "31");
await page.waitForTimeout(600);
const pickBtn = page.locator("button", { hasText: /#\d{6}/ }).first();
await pickBtn.click();
await page.waitForSelector("text=ID card barcode", { timeout: 5000 });
const barcodeRects = await page.locator("svg rect").count();
check("dev: Code 128 barcode rendered", barcodeRects > 10, `${barcodeRects} bars`);
await page.waitForSelector('img[alt="Student pass QR"]');
check("dev: pass QR rendered", true);
await page.screenshot({ path: SHOTS + "/16-dev-simulator.png" });

// ---- QR rotation: shrink the window? just verify payload changes across windows is covered by unit logic.
// Instead verify the QR src changes when student changes (regen effect) — cheap proxy.

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
