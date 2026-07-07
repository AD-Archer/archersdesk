import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME =
  "/Users/arch/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const OUT = "/private/tmp/claude-501/-Users-arch-Projects-archersdesk/ae52eed5-a030-4858-94e2-76aa19add4bc/scratchpad";

const jar = fs.readFileSync(`${OUT}/jar.txt`, "utf8");
const token = jar.split("\n").find((l) => l.includes("desk_session"))?.trim().split(/\s+/).pop();

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--force-device-scale-factor=2"],
});

const page = await browser.newPage();
await page.setViewport({ width: 960, height: 480, deviceScaleFactor: 2 });
await browser.setCookie({ name: "desk_session", value: token, domain: "localhost", path: "/", httpOnly: true });
const issues = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") issues.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => issues.push(`[pageerror] ${String(e).slice(0, 300)}`));

// the user's sketch: a1 / b2 / cc / d3
const settings = {
  theme: "ember",
  location: { name: "Burlington", region: "Vermont · United States", latitude: 44.47588, longitude: -73.21207 },
  units: "fahrenheit",
  layout: {
    rows: [
      { type: "split", left: "clock", right: "nowplaying" },
      { type: "split", left: "calendar", right: "weather" },
      { type: "dual", widget: "forecast" },
      { type: "split", left: "worldclock", right: "timer" },
    ],
  },
  standby: { showTemp: true, showAlarm: true },
  lastfm: { username: "antoniodoesmusic", apiKey: "" },
  alarms: [{ time: "07:30", label: "school", days: ["mon", "tue", "wed", "thu", "fri"], enabled: true }],
  worldclock: [
    { label: "london", tz: "Europe/London" },
    { label: "tokyo", tz: "Asia/Tokyo" },
    { label: "los angeles", tz: "America/Los_Angeles" },
  ],
};

await page.goto("http://localhost:3000/", { waitUntil: "networkidle0", timeout: 30000 });
await page.evaluate(async (s) => {
  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: s }),
  });
}, settings);
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1800));
await page.screenshot({ path: `${OUT}/41-row1.png` });

// swipe down through rows via arrow keys
await page.keyboard.press("ArrowDown");
await new Promise((r) => setTimeout(r, 700));
await page.keyboard.press("ArrowDown");
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}/42-row3-dual.png` });

await page.keyboard.press("ArrowDown");
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}/43-row4.png` });

// real touch swipe up (row4 -> stays) then down->up gesture check: swipe up moves next, here test swipe down (goes back up a row)
await page.touchscreen.touchStart(480, 350);
await page.touchscreen.touchMove(480, 260);
await page.touchscreen.touchMove(480, 160);
await page.touchscreen.touchEnd();
await new Promise((r) => setTimeout(r, 800));

// settings row manager
await page.click(".gear");
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}/44-row-manager.png` });

fs.writeFileSync(`${OUT}/console-issues.txt`, issues.join("\n") || "no issues");
await browser.close();
console.log(issues.length ? `ISSUES:\n${issues.join("\n")}` : "console clean");
