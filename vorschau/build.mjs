// Baut aus der laufenden App eine einzelne, in sich geschlossene HTML-Datei:
// Startseite und alle Unterseiten, Schriften, Logo und Fotos als Data-URIs
// eingebettet, dazu ein kleiner Treiber für das Scrollytelling und die
// Navigation. Die Datei läuft ohne Server — zum Herumschicken und Ansehen.
//
//   cd portal && npx next build && npx next start -p 3200
//   node vorschau/build.mjs        # → vorschau/out/startseite-vorschau.html
//
// Sie ist eine **Ausgabe**, keine Quelle: Bearbeitet wird die Seite selbst
// unter portal/src/app/ und portal/src/components/marketing/ — danach dieses
// Skript neu laufen lassen.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..', 'portal');
const BASE = process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:3200';
const routes = ['/', '/funktionen/finanzen', '/funktionen/hausgeld', '/funktionen/versammlung', '/funktionen/kommunikation', '/so-funktionierts'];

// ── Seiten holen ──
// Das Scrollytelling wird NICHT mehr durch eine Vanilla-Kopie ersetzt: die
// React-Komponente trägt data-Attribute, das servergerenderte Haus landet
// 1:1 in der Vorschau und der Treiber unten steuert dieselben Elemente.
let cssHref = null;
const pages = [];
for (const route of routes) {
  const html = await (await fetch(`${BASE}${route}`)).text();
  cssHref ??= html.match(/href="(\/_next\/static\/chunks\/[^"]+\.css)"/)?.[1];
  const main = html.match(/<main[\s\S]*<\/main>/)?.[0];
  if (!main) throw new Error(`kein <main> auf ${route}`);
  pages.push([route, main]);
}

// ── CSS + Fonts + Logo einbetten ──
let css = readFileSync(`${ROOT}/.next${cssHref.replace('/_next', '')}`, 'utf8');
css = css.replace(/url\((\/fonts\/[^)]+\.woff2)\)/g, (_, p) => `url(data:font/woff2;base64,${readFileSync(`${ROOT}/public${p}`).toString('base64')})`);
const logo = readFileSync(`${ROOT}/public/bw-logo.png`).toString('base64');

// Echte Fotos: next/image liefert optimierte /_next/image?url=...-Varianten
// (auch im srcset mehrfach) – für die statische Vorschau alle Vorkommen
// je Dateiname durch dieselbe eingebettete Data-URI ersetzen.
const photoNames = ['hero-building', 'finanzen', 'hausgeld', 'versammlung', 'kommunikation', 'so-funktionierts'];
const photoDataUris = Object.fromEntries(
  photoNames.map((n) => [n, `data:image/jpeg;base64,${readFileSync(`${ROOT}/public/images/marketing/${n}.jpg`).toString('base64')}`]),
);

let pageDivs = pages
  .map(([route, main]) => `<div data-page="${route}"${route === '/' ? '' : ' hidden'}>${main}</div>`)
  .join('\n')
  .replaceAll('src="/bw-logo.png"', `src="data:image/png;base64,${logo}"`);

// srcSet zuerst ganz entfernen (React rendert das Attribut camelCase –
// sonst landet dieselbe Data-URI pro Bild gleich mehrfach in der Datei,
// einmal je Breiten-Variante).
pageDivs = pageDivs.replace(/\s+srcSet="[^"]*"/g, "");
for (const name of photoNames) {
  const encodedPath = encodeURIComponent(`/images/marketing/${name}.jpg`);
  const pattern = new RegExp(`/_next/image\\?url=${encodedPath}[^"'\\s,]*`, 'g');
  pageDivs = pageDivs.replaceAll(pattern, photoDataUris[name]);
}

const out = `<title>WEG-Website – Vorschau</title>
<style>${css}</style>
<style>
  html,body{margin:0;background:#faf8f4}
  .preview-shell{min-height:100vh;display:flex;flex-direction:column}
  .preview-note{position:static;background:#f69018;color:#00241f;font:600 12px/1.4 Inter,sans-serif;text-align:center;padding:6px 12px}
</style>
<div class="preview-note">Vorschau · scrollen Sie auf der Startseite, um die Selbstverwaltung aufzubauen · Navigation funktioniert, Login/Registrierung sind deaktiviert</div>
<div class="preview-shell antialiased">
${pageDivs}
</div>
<script>
(function(){
  var routes = ${JSON.stringify(routes)};

  // Reveals
  var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}});},{threshold:0.15,rootMargin:'0px 0px -40px 0px'});
  function observeReveals(){var a=document.querySelector('[data-page]:not([hidden])');if(a)a.querySelectorAll('.mk-reveal:not(.is-visible)').forEach(function(el){io.observe(el);});}

  // ── Scrollytelling-Antrieb (Vanilla, spiegelt die React-Logik) ──
  var track = document.querySelector('section[aria-label^="So bauen"]');
  var STAGES = 6, ROOF_AT = 4, DONE_AT = 5;
  var GLASS_ON = '#ffd489', GLASS_OFF = '#cfe0dd';
  var WINGLOW = 'drop-shadow(0 0 5px rgba(246,144,24,0.85))';
  function clamp01(t){return Math.max(0,Math.min(1,t));}
  function easeOut(t){return 1-Math.pow(1-clamp01(t),3);}
  function applyStage(stage, p){
    if(!track) return;
    var done = stage >= DONE_AT;
    var subDone = clamp01(p*STAGES - DONE_AT);
    function ap(s){return stage>s ? 1 : (stage===s ? easeOut(clamp01(p*STAGES-s)) : 0);}
    // Fortschrittsleiste + Schritt-Ziffer
    track.querySelectorAll('[data-seg]').forEach(function(seg,i){seg.style.width=(clamp01(p*STAGES-i)*100)+'%';});
    var sn=track.querySelector('[data-stepnum]');if(sn)sn.textContent='0'+(stage+1);
    // Textpanels – richtungsabhängiger Cross-Fade
    track.querySelectorAll('[data-panel]').forEach(function(pl){
      var i=+pl.getAttribute('data-panel');var on=i===stage;
      pl.style.opacity=on?'1':'0';
      pl.style.transform=on?'translateY(0)':(i<stage?'translateY(-16px)':'translateY(16px)');
      pl.style.pointerEvents=on?'auto':'none';
      pl.setAttribute('aria-hidden',String(!on));
    });
    // Bauphasen des Comic-Hauses steigen stufenlos auf
    track.querySelectorAll('[data-part]').forEach(function(part){
      var s=+part.getAttribute('data-part');var a=ap(s);
      part.style.transform='translateY('+((1-a)*46)+'px)';
      part.style.opacity=a;
    });
    // Baukran: baut mit auf, verschwindet bei Fertigstellung
    var crane=track.querySelector('[data-crane]');
    if(crane){crane.style.transform='translateY('+((1-ap(0))*46)+'px)';crane.style.opacity=done?0:ap(0);}
    // Fenster gehen je Stockwerk einzeln an
    track.querySelectorAll('[data-win]').forEach(function(w){
      var fl=+w.getAttribute('data-wfloor'), idx=+w.getAttribute('data-widx'), cnt=+w.getAttribute('data-wcnt');
      var on=Math.round(ap(fl)*cnt)>idx;
      w.style.filter=on?WINGLOW:'none';
      var g=w.querySelector('[data-glass]');if(g)g.setAttribute('fill',on?GLASS_ON:GLASS_OFF);
    });
    // Rundes Dachfenster leuchtet bei Fertigstellung
    var attic=track.querySelector('[data-atticg]');
    if(attic){attic.style.filter=done?WINGLOW:'none';var ag=attic.querySelector('[data-glass]');if(ag)ag.setAttribute('fill',done?GLASS_ON:GLASS_OFF);}
    // Bewohner, Katze, Fahne & Rauch, Funkeln
    var figs=track.querySelector('[data-figs]');
    if(figs){var fon=stage>=ROOF_AT;figs.style.opacity=fon?'1':'0';figs.style.animation=fon?'mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 250ms both':'none';}
    var cat=track.querySelector('[data-cat]');if(cat)cat.style.opacity=done?'1':'0';
    var extra=track.querySelector('[data-doneextra]');
    if(extra){extra.style.opacity=done?'1':'0';var fp=extra.querySelector('path');if(fp)fp.style.animation=done?'mkFlag 2.4s ease-in-out infinite':'none';}
    var spk=track.querySelector('[data-sparkles]');if(spk)spk.style.opacity=done?'1':'0';
    // Glühen + Plakette + Scroll-Hinweis
    var glow=track.querySelector('[data-glow]');if(glow)glow.style.opacity=done?(0.55+0.45*subDone):0;
    var dn=track.querySelector('[data-done]');if(dn){dn.style.opacity=done?'1':'0';dn.style.transform='translateX(-50%) translateY('+(done?0:8)+'px)';}
    var hint=track.querySelector('[data-hint]');if(hint)hint.style.opacity=stage===DONE_AT?'0':'0.9';
    // Parallaxe des Gebäudes
    var bw=track.querySelector('[data-buildingwrap]');if(bw)bw.style.transform='translateY('+((0.5-p)*24)+'px)';
  }
  function updateScrolly(){
    if(!track||track.offsetParent===null) return; // versteckt
    var total=track.offsetHeight-window.innerHeight;
    var scrolled=Math.min(Math.max(-track.getBoundingClientRect().top,0),Math.max(total,1));
    var p=total>0?scrolled/total:0;
    applyStage(Math.min(STAGES-1,Math.floor(p*STAGES*1.001)),p);
  }
  window.addEventListener('scroll',updateScrolly,{passive:true});
  window.addEventListener('resize',updateScrolly);
  applyStage(0,0);
  updateScrolly();

  // ── Seiten-Navigation ──
  function show(path,hash){
    document.querySelectorAll('[data-page]').forEach(function(d){d.hidden=d.getAttribute('data-page')!==path;});
    window.scrollTo(0,0);
    if(hash){var el=document.getElementById(hash);if(el)el.scrollIntoView();}
    observeReveals();updateScrolly();
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');if(!a)return;
    var href=a.getAttribute('href')||'';
    if(href.indexOf('mailto:')===0)return;
    e.preventDefault();
    var parts=href.split('#');
    if(routes.indexOf(parts[0])!==-1) show(parts[0],parts[1]);
  });
  observeReveals();
})();
</script>`;

mkdirSync(path.join(DIR, 'out'), { recursive: true });
const file = path.join(DIR, 'out', 'startseite-vorschau.html');
writeFileSync(file, out);
console.log(`${file}\n${(out.length / 1024 / 1024).toFixed(1)} MB · ${pages.length} Seiten`);
