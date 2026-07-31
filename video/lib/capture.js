// Gemeinsame Aufnahme-Werkzeuge für alle Szenen.
//
// Zwei Erkenntnisse stecken hier drin, beide teuer erkauft:
//  1. Playwrights `recordVideo` ignoriert `deviceScaleFactor`. Echte 2×-Schärfe
//     gibt es nur über den Startschalter --force-device-scale-factor=2, dann
//     aufgenommen in doppelter Fenstergröße.
//  2. Der vorinstallierte Chromium ist älter als das npm-Paket. Deshalb
//     executablePath explizit setzen; `playwright install` ist hier gesperrt.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const VIEW = { width: 1280, height: 720 };
const REC = { width: 2560, height: 1440 };

const BASE = process.env.PREVIEW_BASE_URL || "http://127.0.0.1:3000";

async function launch() {
  return chromium.launch({
    executablePath: CHROME,
    args: ["--force-device-scale-factor=2", "--hide-scrollbars", "--force-color-profile=srgb"],
  });
}

// Marken: Jede Szene schreibt mit, WANN etwas passiert ist — relativ zum Beginn
// der Aufnahme. Vorher wurden die Schnittzeiten geschätzt, und weil das Laden
// der Seite mal 0,5 und mal 1,5 Sekunden dauert, landeten Zoomfahrten mitten
// in einer noch sichtbaren Unterzeile. Geschätzte Zeiten sind bei einer
// Pipeline, die nach jedem Design-Update neu läuft, ohnehin nicht haltbar.
function clock(dir) {
  const t0 = Date.now();
  const marks = {};
  return {
    mark(name) {
      marks[name] = +((Date.now() - t0) / 1000).toFixed(2);
    },
    save() {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "marks.json"), JSON.stringify(marks, null, 2));
    },
  };
}

async function newClip(browser, dir, opts = {}) {
  const context = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir, size: REC },
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    reducedMotion: opts.reducedMotion || "no-preference",
    storageState: opts.storageState,
  });
  const page = await context.newPage();
  return { context, page, clock: clock(dir) };
}

// ── Synthetischer Mauszeiger ────────────────────────────────────────────────
// Der echte, aufgezeichnete Zeiger springt von Punkt zu Punkt und wirkt
// roboterhaft. Dieser hier fährt eine gekrümmte Bahn, bremst weich ab und
// schwingt minimal über — so bewegt sich eine Hand.
const CURSOR_CSS = `
#__cur { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
  width: 22px; height: 22px; margin: -2px 0 0 -2px; opacity: 0; transition: opacity .25s ease; }
#__cur svg { display:block; filter: drop-shadow(0 2px 5px rgba(0,0,0,.45)); }
#__pulse { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: 999px;
  border: 2px solid rgba(240,150,50,.95); width: 12px; height: 12px; margin: -6px 0 0 -6px; opacity: 0; }
`;

async function installCursor(page) {
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate(() => {
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 2l14 8.5-6.2 1.2 3.4 6.6-2.9 1.5-3.4-6.6L5 18V2z" fill="#fff" stroke="#111" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const p = document.createElement("div");
    p.id = "__pulse";
    document.body.appendChild(p);
    window.__curAt = (x, y) => {
      const e = document.getElementById("__cur");
      e.style.transform = `translate(${x}px, ${y}px)`;
      e.style.opacity = "1";
    };
    window.__curHide = () => {
      const e = document.getElementById("__cur");
      if (e) e.style.opacity = "0";
    };
    window.__pulseAt = (x, y) => {
      const p = document.getElementById("__pulse");
      p.style.transform = `translate(${x}px, ${y}px)`;
      p.animate(
        [
          { opacity: 0.9, width: "12px", height: "12px", margin: "-6px 0 0 -6px" },
          { opacity: 0, width: "54px", height: "54px", margin: "-27px 0 0 -27px" },
        ],
        { duration: 520, easing: "cubic-bezier(.22,.61,.36,1)" },
      );
    };
  });
}

// ease-out-cubic: schnell los, weich ankommen. Niemals linear.
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

async function moveCursor(page, to, opts = {}) {
  const steps = opts.steps || 34;
  const from = opts.from || { x: 640, y: 640 };
  // Leichter Bogen quer zur Bewegungsrichtung — eine Hand fährt keine Gerade.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bow = opts.bow ?? 0.12;
  for (let i = 0; i <= steps; i++) {
    const t = easeOut(i / steps);
    const arc = Math.sin((i / steps) * Math.PI) * bow;
    const x = from.x + dx * t - dy * arc;
    const y = from.y + dy * t + dx * arc;
    await page.evaluate(([x, y]) => window.__curAt(x, y), [x, y]);
    await page.waitForTimeout(opts.frameMs || 16);
  }
  // Minimales Überschwingen und Zurückfedern.
  for (const [ox, oy] of [[3, 2], [-1, -1], [0, 0]]) {
    await page.evaluate(([x, y]) => window.__curAt(x, y), [to.x + ox, to.y + oy]);
    await page.waitForTimeout(40);
  }
}

async function clickAt(page, sel) {
  const box = await page.locator(sel).boundingBox();
  const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(([x, y]) => window.__pulseAt(x, y), [p.x, p.y]);
  await page.waitForTimeout(120);
  await page.locator(sel).click();
  return p;
}

// Tippen in Menschengeschwindigkeit: nie echte Tastaturrate, immer mit Streuung.
async function humanType(page, sel, text) {
  const el = page.locator(sel);
  await el.click();
  for (const ch of text) {
    await el.press(ch === " " ? "Space" : ch, { delay: 0 }).catch(async () => {
      await el.type(ch);
    });
    const base = 34;
    const jitter = Math.random() * 26 - 8;
    await page.waitForTimeout(Math.max(14, base + jitter + (",.?".includes(ch) ? 90 : 0)));
  }
}

// ── Unterzeile über der Oberfläche ──────────────────────────────────────────
// Volltafeln zwischen jeder Szene ergäben eine Diashow. Eine Unterzeile lässt
// das Produkt im Bild und nennt die Aussage dazu. Sie wird in die Seite
// injiziert und mit aufgenommen — kein nachträgliches Compositing nötig.
//
// Alle Stile über element.style: <style>-Tags gehen zwar durch die CSP, aber
// so bleibt die Unterzeile unabhängig von den Regeln der Seite.
async function installCaption(page) {
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.id = "__cap";
    Object.assign(box.style, {
      position: "fixed", left: "0", right: "0", bottom: "0", zIndex: "2147483000",
      padding: "96px 56px 58px", pointerEvents: "none",
      background: "linear-gradient(to top, rgba(8,6,5,.95) 0%, rgba(8,6,5,.86) 40%, rgba(10,8,6,0) 100%)",
      opacity: "0", transition: "opacity .35s cubic-bezier(.22,.61,.36,1)",
      fontFamily: '"Plus Jakarta Sans","Inter",sans-serif',
    });
    const t = document.createElement("div");
    t.id = "__capT";
    Object.assign(t.style, {
      color: "#fff", fontSize: "40px", fontWeight: "800", letterSpacing: "-0.02em",
      lineHeight: "1.15", textShadow: "0 2px 18px rgba(0,0,0,.6)",
      transform: "translateY(14px)", transition: "transform .4s cubic-bezier(.22,.61,.36,1)",
    });
    box.appendChild(t);
    document.body.appendChild(box);

    window.__cap = (html) => {
      const b = document.getElementById("__cap");
      const el = document.getElementById("__capT");
      el.innerHTML = html.replace(/\*(.+?)\*/g, '<span style="color:#f69018">$1</span>');
      b.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };
    window.__capOff = () => {
      const b = document.getElementById("__cap");
      const el = document.getElementById("__capT");
      b.style.opacity = "0";
      el.style.transform = "translateY(14px)";
    };
  });
}

// Standzeit aus der Textlänge: ~14 Zeichen je Sekunde, nie unter 2 s.
// Fest verdrahtete Standzeiten sind der häufigste Grund für unlesbare Videos.
function holdMs(text) {
  const clean = text.replace(/[*|]/g, "");
  return Math.max(2000, Math.round((clean.length / 14) * 1000));
}

async function caption(page, text, opts = {}) {
  await page.evaluate((t) => window.__cap(t), text);
  await page.waitForTimeout(opts.hold ?? holdMs(text));
  if (opts.keep) return;
  await page.evaluate(() => window.__capOff());
  await page.waitForTimeout(350);
}

// Sanftes Scrollen statt Sprung: ein harter Sprung liest sich im Video als Schnitt.
async function smoothScroll(page, to, ms = 900) {
  await page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min(1, (t - t0) / ms);
          const e = 1 - Math.pow(1 - p, 3);
          window.scrollTo(0, from + (to - from) * e);
          p < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    [to, ms],
  );
}

module.exports = {
  launch, newClip, clock, installCursor, moveCursor, clickAt, humanType,
  installCaption, caption, holdMs, smoothScroll,
  BASE, VIEW, REC, easeOut,
};
