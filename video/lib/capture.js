// Gemeinsame Aufnahme-Werkzeuge für alle Szenen.
//
// Zwei Erkenntnisse stecken hier drin, beide teuer erkauft:
//  1. Playwrights `recordVideo` ignoriert `deviceScaleFactor`. Echte 2×-Schärfe
//     gibt es nur über den Startschalter --force-device-scale-factor=2, dann
//     aufgenommen in doppelter Fenstergröße.
//  2. Der vorinstallierte Chromium ist älter als das npm-Paket. Deshalb
//     executablePath explizit setzen; `playwright install` ist hier gesperrt.
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
  return { context, page };
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

// ── Einblendungen (Untertitel) ─────────────────────────────────────────────
// Das Video ist stumm, also trägt die Schrift die Aussage. Sie steht auf einem
// Verlauf über dem unteren Bildrand: Der Blick liest entweder den Satz oder
// die Oberfläche darüber — beide konkurrieren nie um dieselbe Fläche.
const CAPTION_CSS = `
#__capscrim { position:fixed; left:0; right:0; bottom:0; height:38%; z-index:2147483644;
  pointer-events:none; opacity:0; transition:opacity .35s cubic-bezier(.22,.61,.36,1);
  background:linear-gradient(to top, rgba(8,6,5,.94) 0%, rgba(8,6,5,.80) 38%, rgba(8,6,5,0) 100%); }
#__cap { position:fixed; left:64px; right:64px; bottom:54px; z-index:2147483645; pointer-events:none;
  font-family:"Plus Jakarta Sans",var(--font-display,sans-serif); font-weight:800; font-size:40px;
  line-height:1.16; letter-spacing:-0.015em; color:#fff; text-wrap:balance;
  opacity:0; transform:translateY(12px); transition:opacity .4s cubic-bezier(.22,.61,.36,1), transform .4s cubic-bezier(.22,.61,.36,1); }
#__cap .rule { display:block; width:46px; height:5px; border-radius:3px; background:#f69018; margin-bottom:18px; }
#__cap .accent { color:#f69018; }
`;

// Lesegeschwindigkeit ~14 Zeichen/s, konservativ für eine nebenbei lesende
// Zielgruppe. Mindestens 2 s, höchstens 6 s — gerechnet, nicht geraten.
const holdMs = (text) =>
  Math.max(2000, Math.min(6000, Math.round((text.replace(/[*|]/g, "").length / 14) * 1000) + 550));

// Mehrfach aufrufbar: Die App navigiert clientseitig, der DOM überlebt den
// Seitenwechsel. Ohne das Aufräumen entstehen doppelte Ebenen, und die
// Einblendung landet auf der alten.
async function installOverlay(page) {
  await page.addStyleTag({ content: CURSOR_CSS + CAPTION_CSS });
  await page.evaluate(() => {
    for (const id of ["__capscrim", "__cap"]) document.getElementById(id)?.remove();
    for (const [id, html] of [
      ["__capscrim", ""],
      ["__cap", ""],
    ]) {
      const el = document.createElement("div");
      el.id = id;
      el.innerHTML = html;
      document.body.appendChild(el);
    }
    window.__capShow = (html) => {
      const cap = document.getElementById("__cap");
      const scrim = document.getElementById("__capscrim");
      cap.innerHTML = '<span class="rule"></span>' + html;
      scrim.style.opacity = "1";
      requestAnimationFrame(() => {
        cap.style.opacity = "1";
        cap.style.transform = "translateY(0)";
      });
    };
    window.__capHide = () => {
      const cap = document.getElementById("__cap");
      const scrim = document.getElementById("__capscrim");
      cap.style.opacity = "0";
      cap.style.transform = "translateY(8px)";
      scrim.style.opacity = "0";
    };
  });
}

// Zeigt eine Einblendung und wartet die gerechnete Standzeit ab.
// *Wort* hebt in Markenfarbe hervor, | trennt die Zeile.
// `during` läuft, während der Satz steht: Die Seite fährt dorthin, wo gelesen
// wird, statt die Standzeit hintendran zu hängen. Sonst wird jede Einstellung
// so lang wie Lesen plus Fahren — und das Video doppelt so lang wie geplant.
async function caption(page, text, opts = {}) {
  const html = text
    .replace(/\*(.+?)\*/g, '<span class="accent">$1</span>')
    .replace(/\|/g, "<br>");
  const hold = opts.ms || holdMs(text);
  const t0 = Date.now();
  await page.evaluate((h) => window.__capShow(h), html);
  if (opts.during) {
    await page.waitForTimeout(420); // erst lesen lassen, dann bewegen
    await opts.during();
  }
  const rest = hold - (Date.now() - t0);
  if (rest > 0) await page.waitForTimeout(rest);
  if (opts.keep !== true) {
    await page.evaluate(() => window.__capHide());
    await page.waitForTimeout(360);
  }
}

// Weiches Scrollen mit ease-out: Die Seite fährt dorthin, wo gleich gelesen
// wird, und kommt zur Ruhe — nie linear, nie über den Schnitt hinaus.
async function smoothScroll(page, to, ms = 900) {
  await page.evaluate(
    ([to, ms]) =>
      new Promise((done) => {
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          window.scrollTo(0, from + (to - from) * (1 - Math.pow(1 - t, 3)));
          t < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      }),
    [to, ms],
  );
  await page.waitForTimeout(120);
}

module.exports = {
  launch,
  newClip,
  installCursor,
  installOverlay,
  caption,
  holdMs,
  smoothScroll,
  moveCursor,
  clickAt,
  humanType,
  BASE,
  VIEW,
  REC,
  easeOut,
};
