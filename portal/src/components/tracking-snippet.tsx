// First-Party-Tracking-Snippet, inline im Root-Layout (deutlich unter 2 KB).
//
// Cookiefrei: Das Script liest und setzt NICHTS am Browser — kein Cookie,
// kein localStorage. Es meldet Pfad, Referrer, UTM-Parameter und
// Bildschirmbreite an /api/t (gleiche Domain); die Besucher-Kennung entsteht
// erst serverseitig aus IP + User-Agent + Tages-Salt. SPA-Navigationen zählen
// mit: pushState wird umwickelt, popstate abonniert; derselbe Pfad zweimal
// hintereinander wird nicht doppelt gemeldet.
//
// Auf Preview-Deployments (VERCEL_ENV=preview) bleibt das Snippet weg — die
// Vorschau schreibt in dieselbe Datenbank und würde die Zahlen verfälschen.

const SNIPPET = `(()=>{var l,s=()=>{var p=location.pathname;if(p===l)return;l=p;var q=new URLSearchParams(location.search),d=JSON.stringify({t:"pageview",p:p,r:document.referrer||null,w:screen.width,us:q.get("utm_source"),um:q.get("utm_medium"),uc:q.get("utm_campaign")});try{navigator.sendBeacon&&navigator.sendBeacon("/api/t",d)||fetch("/api/t",{method:"POST",body:d,keepalive:!0})}catch(e){}};s();var h=history.pushState;history.pushState=function(){h.apply(this,arguments);s()};addEventListener("popstate",s)})();`;

export function TrackingSnippet() {
  if (process.env.VERCEL_ENV === "preview") return null;
  return <script dangerouslySetInnerHTML={{ __html: SNIPPET }} />;
}
