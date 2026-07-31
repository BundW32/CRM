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

// ── Spotlight ───────────────────────────────────────────────────────────────
// Dunkelt alles ab AUSSER einem Element. Erzeugt in einem Zug den Blickfang,
// für den man sonst stark zoomen müsste — und zoomen schneidet Beschriftungen
// ab. Umgesetzt als ein einziges Element mit riesigem box-shadow: Das Loch ist
// das Element selbst, der Schatten deckt den Rest.
async function spotlight(page, selector, opts = {}) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`Spotlight findet nichts: ${selector}`);
  const pad = opts.pad ?? 10;
  await page.evaluate(
    ([b, pad]) => {
      let el = document.getElementById("__spot");
      if (!el) {
        el = document.createElement("div");
        el.id = "__spot";
        Object.assign(el.style, {
          position: "fixed", zIndex: "2147482000", pointerEvents: "none",
          borderRadius: "14px", opacity: "0",
          transition: "opacity .45s cubic-bezier(.22,.61,.36,1), all .5s cubic-bezier(.22,.61,.36,1)",
          boxShadow: "0 0 0 9999px rgba(8,6,5,.72)",
          outline: "2px solid rgba(246,144,24,.85)",
        });
        document.body.appendChild(el);
      }
      el.style.left = b.x - pad + "px";
      el.style.top = b.y - pad + "px";
      el.style.width = b.width + pad * 2 + "px";
      el.style.height = b.height + pad * 2 + "px";
      el.style.opacity = "1";
    },
    [box, pad],
  );
  await page.waitForTimeout(opts.wait ?? 500);
}

async function spotlightOff(page) {
  await page.evaluate(() => {
    const el = document.getElementById("__spot");
    if (el) el.style.opacity = "0";
  });
  await page.waitForTimeout(450);
}

// ── Klicken wie ein Mensch ──────────────────────────────────────────────────
// Zeiger hinfahren, Ring-Impuls, dann erst klicken. Ein Klick ohne sichtbaren
// Zeiger wirkt im Video wie ein Sprung ohne Ursache.
async function moveAndClick(page, selector, opts = {}) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  const to = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 24) };
  await moveCursor(page, to, opts);
  await page.evaluate(([x, y]) => window.__pulseAt(x, y), [to.x, to.y]);
  await page.waitForTimeout(140);
  await el.click({ timeout: 15000 });
  return to;
}

// ── Scrollfahrt mit Tempowechsel ────────────────────────────────────────────
// Schnell über das Bekannte, langsam auf das Ziel. Gleichmäßiges Scrollen ist
// so tot wie ein Standbild; der Bremsvorgang erzeugt die Erwartung.
async function scrollFahrt(page, to, opts = {}) {
  const ms = opts.ms ?? 1500;
  await page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min(1, (t - t0) / ms);
          // schnell los, spät stark abbremsen
          const e = p < 0.65 ? 1.35 * p : 1 - Math.pow(1 - p, 3) * 0.62;
          window.scrollTo(0, from + (to - from) * Math.min(1, e));
          p < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    [to, ms],
  );
  await page.waitForTimeout(opts.settle ?? 500);
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
  spotlight, spotlightOff, moveAndClick, scrollFahrt,
  BASE, VIEW, REC, easeOut,
};
