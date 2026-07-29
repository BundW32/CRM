import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

// Screens for the owner/WEG-focused explainer. Captured at 2x for crisp video frames.
const AS_OWNER = [
  ["dashboard", "/dashboard"],
  ["vorgaenge", "/vorgaenge"],
  ["finanzen", "/finanzen"],
  ["dokumente", "/dokumente"],
  ["beschluesse", "/beschluesse"],
  ["versammlungen", "/versammlungen"],
  ["verbrauch", "/verbrauch"],
  ["nachrichten", "/nachrichten"],
];
const AS_MANAGER = [
  ["weg", "/verwaltung/weg"],
  ["verwaltung", "/verwaltung"],
];

async function shoot(ctx, name, path) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("ok", name, page.url());
  } catch (e) {
    console.log("FAIL", name, e.message);
  }
  await page.close();
}

async function login(browser, email, password) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "de-DE",
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 });
  await page.close();
  return ctx;
}

const browser = await chromium.launch();

// public pages
const pub = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "de-DE",
});
await shoot(pub, "startseite", "/");
await shoot(pub, "login", "/login");
await pub.close();

const owner = await login(browser, "eigentuemer@demo.de", "Demo-2026!");
for (const [n, p] of AS_OWNER) await shoot(owner, "eig-" + n, p);
await owner.close();

const mgr = await login(browser, "admin@bundwimmobilien.de", "BundW-Start2026!");
for (const [n, p] of AS_MANAGER) await shoot(mgr, "vw-" + n, p);
// WEG detail pages need the property id from the list
const page = await mgr.newPage();
await page.goto(BASE + "/verwaltung/weg", { waitUntil: "networkidle" });
const href = await page
  .locator('a[href*="/verwaltung/weg/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);
await page.close();
if (href) {
  for (const sub of ["wirtschaftsplan", "jahresabrechnung", "hausgeld", "erhaltungsplanung"]) {
    await shoot(mgr, "vw-weg-" + sub, `${href}/${sub}`);
  }
  await shoot(mgr, "vw-weg-detail", href);
}
await mgr.close();

await browser.close();
