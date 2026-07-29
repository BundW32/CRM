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
// Der Zeiger steht auf 150 %: Im fertigen Video ist das Bild auf ein Drittel
// heruntergerechnet, ein normal großer Zeiger verschwindet darin.
const CURSOR_CSS = `
#__cur { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
  width: 33px; height: 33px; margin: -3px 0 0 -3px; opacity: 0; transition: opacity .25s ease; }
#__cur svg { display:block; filter: drop-shadow(0 3px 7px rgba(0,0,0,.5)); }
#__pulse { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: 999px;
  border: 3px solid rgba(246,144,24,.95); width: 14px; height: 14px; margin: -7px 0 0 -7px; opacity: 0; }
/* Hervorhebung: liegt exakt auf dem Element, das die Aussage beweist. */
#__hl { position: fixed; z-index: 2147483643; pointer-events: none; border-radius: 10px;
  border: 3px solid #f69018; box-shadow: 0 0 0 4px rgba(246,144,24,.22), 0 0 26px rgba(246,144,24,.55);
  opacity: 0; transition: opacity .3s cubic-bezier(.22,.61,.36,1); }
`;

async function installCursor(page) {
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate(() => {
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML =
      '<svg viewBox="0 0 24 24" width="33" height="33"><path d="M5 2l14 8.5-6.2 1.2 3.4 6.6-2.9 1.5-3.4-6.6L5 18V2z" fill="#fff" stroke="#111" stroke-width="1.1" stroke-linejoin="round"/></svg>';
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

// Die Bahn wird **in der Seite** gerechnet, nicht Schritt für Schritt vom
// Skript aus gesetzt. Jeder Aufruf über die Fernsteuerung kostet rund 100 ms;
// der Zeiger lief damit mit neun Bildern je Sekunde und brauchte für einen Weg
// dreieinhalb Sekunden — länger als die ganze Einstellung. In der Seite läuft
// er mit voller Bildrate und exakt so lange, wie er soll.
async function moveCursor(page, to, opts = {}) {
  const from = opts.from || { x: 640, y: 640 };
  const ms = opts.ms || 850;
  const bow = opts.bow ?? 0.12;
  await page.evaluate(
    ([from, to, ms, bow]) =>
      new Promise((done) => {
        const t0 = performance.now();
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms);
          const t = 1 - Math.pow(1 - p, 3); // ease-out: weich ankommen
          // Leichter Bogen quer zur Richtung — eine Hand fährt keine Gerade.
          const arc = Math.sin(p * Math.PI) * bow;
          window.__curAt(from.x + dx * t - dy * arc, from.y + dy * t + dx * arc);
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    [from, to, ms, bow],
  );
  // Minimales Überschwingen und Zurückfedern.
  for (const [ox, oy] of [[3, 2], [-1, -1], [0, 0]]) {
    await page.evaluate(([x, y]) => window.__curAt(x, y), [to.x + ox, to.y + oy]);
    await page.waitForTimeout(45);
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
    for (const id of ["__capscrim", "__cap", "__hl"]) document.getElementById(id)?.remove();
    for (const [id, html] of [
      ["__capscrim", ""],
      ["__cap", ""],
      ["__hl", ""],
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
    window.__hlAt = (b) => {
      const el = document.getElementById("__hl");
      el.style.left = b.x - 6 + "px";
      el.style.top = b.y - 6 + "px";
      el.style.width = b.width + 12 + "px";
      el.style.height = b.height + 12 + "px";
      requestAnimationFrame(() => (el.style.opacity = "1"));
    };
    window.__hlOff = () => {
      const el = document.getElementById("__hl");
      if (el) el.style.opacity = "0";
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

// Der Kasten des Elements, auf das die Kamera fahren soll — in CSS-Pixeln des
// 1280×720-Fensters. Er wandert in die Schnittliste; der Schnitt rechnet die
// Zufahrt daraus. So wird kein Ausschnitt mehr geraten.
async function focusBox(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`kein Kasten für ${sel}`);
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}

// Oranger Rahmen auf dem Element, das die Aussage beweist. Ohne ihn sieht der
// Zuschauer die Veränderung nicht, die das Produkt belegt.
// Kasten eines Elements, das über seinen Text gefunden wird — und optional
// aufgeweitet, um die Spalte oder Zeile darunter mitzunehmen. Alles wird auf
// das Fenster begrenzt: Ein Ausschnitt außerhalb des Bildes verschiebt die
// Komposition, ohne dass ffmpeg es meldet.
async function textBox(page, text, grow = {}) {
  // Groß-/Kleinschreibung ignorieren: Spaltenköpfe stehen im Quelltext klein
  // und werden erst per CSS in Großbuchstaben gesetzt. Erst exakt suchen, dann
  // als Teilzeichenkette — sonst hängt die Aufnahme an einer Formatierung.
  const b = await page.evaluate((t) => {
    const norm = (v) => v.replace(/\s+/g, " ").trim().toLowerCase();
    const nodes = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0);
    const el =
      nodes.find((e) => norm(e.textContent) === norm(t)) ??
      nodes.find((e) => norm(e.textContent).includes(norm(t)));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, text);
  if (!b) throw new Error(`kein Element mit Text „${text}"`);
  const x = Math.max(0, b.x + (grow.dx ?? 0));
  const y = Math.max(0, b.y + (grow.dy ?? 0));
  const w = grow.w ?? b.w;
  const h = grow.h ?? b.h;
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(Math.min(w, 1280 - x)),
    h: Math.round(Math.min(h, 720 - y)),
  };
}

async function highlight(page, box, ms = 900) {
  await page.evaluate((b) => window.__hlAt(b), { x: box.x, y: box.y, width: box.w, height: box.h });
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__hlOff());
  await page.waitForTimeout(300);
}

module.exports = {
  launch,
  focusBox,
  textBox,
  highlight,
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
