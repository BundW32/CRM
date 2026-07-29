import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;

const browser = await chromium.launch();
async function login(email, password) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "de-DE",
  });
  const p = await ctx.newPage();
  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', password);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 });
  await p.close();
  return ctx;
}

// Wirtschaftsplan-Detail (Verwalter): die eigentliche Plantabelle
const mgr = await login("admin@bundwimmobilien.de", "BundW-Start2026!");
let page = await mgr.newPage();
await page.goto(BASE + "/verwaltung/weg/cms63c7td0009rt7dlnxb9w4g/wirtschaftsplan", {
  waitUntil: "networkidle",
});
await page.getByText("Wirtschaftsjahr 2026").first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/vw-plan-detail.png` });
console.log("ok plan-detail", page.url());
await page.close();
await mgr.close();

// Eigentümer: „Mein Hausgeld im Detail"
const owner = await login("eigentuemer@demo.de", "Demo-2026!");
page = await owner.newPage();
await page.goto(BASE + "/finanzen", { waitUntil: "networkidle" });
await page.getByRole("link", { name: /Mein Hausgeld im Detail/i }).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/eig-hausgeld-detail.png` });
console.log("ok hausgeld-detail", page.url());
await page.close();
await owner.close();

await browser.close();
