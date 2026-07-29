# Einbau-Spezifikation: Hero-Video auf der Startseite

Für die Umsetzung in `portal/src/app/page.tsx` bzw.
`portal/src/components/marketing/site.tsx`. Die Dateien liegen nach
`node video/hero-loop.js && VIDEO_NAME=hero-loop MANIFEST=manifest-loop.json node video/compose-werbevideo.mjs`
unter `video/out/` und gehören nach `portal/public/video/`.

## Überblick

Zwei Fassungen, zwei Aufgaben:

| Fassung | Dateien | Aufgabe |
|---|---|---|
| **Hero-Schleife**, 13,4 s | `hero-loop.mp4` (0,6 MB), `hero-loop.webm` (0,45 MB), `hero-loop-poster.jpg` | läuft stumm im Autoplay, sieht praktisch jeder Besucher |
| **Vollversion**, 51,9 s | `werbevideo.mp4` (3,4 MB), `werbevideo.webm` (2,7 MB), `werbevideo-poster.jpg` | hinter „Ansehen“, für die, die es genauer wissen wollen |

Beide sind **stumm**. Es gibt keine Tonspur, also auch kein Stummschalt-Symbol
und keinen Lautstärkeregler — die würden eine Tonspur versprechen, die es nicht
gibt.

## Platzierung

Die Schleife ersetzt **nicht** den Foto-Hero, sondern steht darunter, als
eigener Abschnitt vor der Scroll-Szene `ScrollyBuild`. Grund: Die Seite erklärt
den Aufbau bereits mit gezeichneten Elementen; das Video ist der **Beleg**, dass
es die Software wirklich gibt. Beweis nach Erklärung, nicht davor.

Breite wie die übrigen Abschnitte (`max-w-6xl`), Seitenverhältnis 16:9, Ecken
`rounded-2xl`, Rahmen `border-gray-200`, Schatten `shadow-e2`.

## Markup

```tsx
<video
  className="h-full w-full rounded-2xl object-cover"
  poster="/video/hero-loop-poster.jpg"
  autoPlay
  muted
  loop
  playsInline
  preload="metadata"
  aria-label="Kurzaufnahme aus dem Portal: Die Jahresabrechnung entsteht mit einem Klick."
>
  <source src="/video/hero-loop.webm" type="video/webm" />
  <source src="/video/hero-loop.mp4" type="video/mp4" />
</video>
```

- `muted` ist bei `autoPlay` **Pflicht**, sonst blockieren die Browser die
  Wiedergabe und es bleibt beim Poster.
- `playsInline` verhindert, dass iOS das Video im Vollbild öffnet.
- `preload="metadata"` statt `auto`: Die Schleife lädt erst, wenn sie sichtbar
  wird — bei 0,45 MB unkritisch, aber die Startseite trägt schon sechs Fotos.
- Reihenfolge `webm` vor `mp4`: Wer VP9 kann, lädt 25 % weniger.

## Zustände

| Zustand | Verhalten |
|---|---|
| Standard | Schleife läuft stumm, endlos |
| `prefers-reduced-motion: reduce` | **Kein Video.** Nur das Poster als `<img>`, gleiche Abmessungen |
| Video nicht ladbar | Poster bleibt stehen — das ist der letzte Frame und trägt allein |
| Tab im Hintergrund | Browser pausiert selbst, nichts zu tun |

Die Bewegungsabfrage gehört in die Komponente, nicht ins CSS: Ein per CSS
verstecktes Video lädt trotzdem und spielt trotzdem.

```tsx
const reduced = useReducedMotion();   // wie in scrolly-build.tsx
return reduced
  ? <img src="/video/hero-loop-poster.jpg" alt="…" className="…" />
  : <video …>…</video>;
```

## Vollversion hinter dem Klick

Ein Knopf unter der Schleife: **„Ganzes Video ansehen (51 s)“** — die Laufzeit
gehört in die Beschriftung, sonst klickt niemand ins Ungewisse. Der Klick öffnet
einen Dialog (`<dialog>` mit `showModal()`), darin die Vollversion mit
`controls`, ohne `autoPlay`.

| Element | Zustand | Verhalten |
|---|---|---|
| Knopf | Hover | wie `buttonClass`, Hintergrund `brand-orange-dark` |
| Dialog | offen | Fokus auf den Schließen-Knopf, `Esc` schließt |
| Dialog | geschlossen | Video pausieren und zurückspulen, sonst läuft es unsichtbar weiter |

## Transkript

Unter dem Video, in einem `<details>`-Element: **„Was das Video zeigt“**. Inhalt
sind die vierzehn Einblendungen der Vollversion in Reihenfolge — sie stehen
fertig in `video/sprechertext.md`. Das deckt Screenreader und alle ab, die kein
Video laden wollen.

Für die Schleife genügen die drei Sätze: „Keine Verwaltung für Ihre WEG?“ /
„Jahresabrechnung — auf Knopfdruck.“ / „Gesamt- und Einzelabrechnung, centgenau
geprüft.“

## Barrierefreiheit

- `aria-label` am Video beschreibt den **Inhalt**, nicht die Technik.
- Kein `<track>` nötig: keine Tonspur, keine Sprache — die Aussagen stehen als
  Text im Bild und zusätzlich im Transkript.
- Der Knopf zur Vollversion ist ein echter `<button>`, tastaturerreichbar, mit
  sichtbarem Fokusring.
- Ob das BFSG hier greift, ist eine Rechtsfrage für den Betreiber. Diese
  Maßnahmen setzen den Stand der Technik um, bewerten die Pflicht aber nicht.

## Grenzen

Die Aufnahmen zeigen die Demo-WEG „Musterstraße 12“ mit erfundenen, aber
plausiblen Zahlen. Sobald sich das Design der App ändert, wird **neu
ausgeführt**, nicht nachgeschnitten — sonst zeigt die Startseite eine Software,
die es so nicht mehr gibt.
