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

const put = (settings) =>
  page.evaluate(async (s) => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: s }),
    });
  }, settings);

const base = {
  theme: "ember",
  location: { name: "Burlington", region: "Vermont · United States", latitude: 44.47588, longitude: -73.21207 },
  units: "fahrenheit",
  layout: { mode: "split", left: "forecast", right: "sun", dual: "clock" },
  standby: { showTemp: true, showAlarm: true },
  lastfm: { username: "antoniodoesmusic", apiKey: "" },
  alarms: [{ time: "07:30", label: "school", days: ["mon", "tue", "wed", "thu", "fri"], enabled: true }],
  worldclock: [
    { label: "london", tz: "Europe/London" },
    { label: "tokyo", tz: "Asia/Tokyo" },
    { label: "los angeles", tz: "America/Los_Angeles" },
  ],
};

async function shot(name, settings, opts = {}) {
  if (settings) await put(settings);
  await page.reload({ waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, opts.wait ?? 1400));
  if (opts.before) await opts.before();
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// 1. meadow forecast + sun
await page.goto("http://localhost:3000/", { waitUntil: "networkidle0", timeout: 30000 });
await shot("21-meadow-forecast-sun", { ...base, theme: "meadow" });

// 2. moonlight analog + moon
await shot("22-moonlight-analog-moon", {
  ...base,
  theme: "moonlight",
  layout: { ...base.layout, left: "analog", right: "moon" },
});

// 3. paper worldclock + timer
await shot("23-paper-worldclock-timer", {
  ...base,
  theme: "paper",
  layout: { ...base.layout, left: "worldclock", right: "timer" },
});

// 4. rose quote dual
await shot("24-rose-quote-dual", {
  ...base,
  theme: "rose",
  layout: { ...base.layout, mode: "dual", dual: "quote" },
});

// 5. moonlight standby
await put({ ...base, theme: "moonlight" });
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
await page.keyboard.press("ArrowRight");
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}/25-moonlight-standby.png` });
await page.keyboard.press("ArrowLeft");
await new Promise((r) => setTimeout(r, 700));

// 6-9. settings tabs (ember)
await put(base);
await page.reload({ waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));
await page.click(".gear");
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}/26-settings-layout.png` });

// widget picker
await page.click(".slot");
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/27-settings-picker.png` });

// theme tab
const tabs = await page.$$(".tab");
await tabs[1].click();
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/28-settings-theme.png` });

// alarms tab, open editor
await tabs[2].click();
await new Promise((r) => setTimeout(r, 300));
await page.click(".al-set-info");
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/29-settings-alarms.png` });

// location tab with search results
await tabs[3].click();
await new Promise((r) => setTimeout(r, 300));
await page.type(".field input", "montpel");
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/30-settings-location.png` });

await browser.close();
console.log("done");
