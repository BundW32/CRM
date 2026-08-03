# Vorschau der Startseite

`build.mjs` baut aus der laufenden App **eine einzige HTML-Datei**: Startseite
und alle fünf Unterseiten, Schriften, Logo und Fotos als Data-URIs eingebettet,
dazu ein kleiner Treiber für das scrollgesteuerte Comic-Haus und die Navigation.
Die Datei braucht keinen Server — sie lässt sich per E-Mail verschicken, im
Browser öffnen oder als Artefakt im Chat anzeigen.

```bash
cd portal && npx next build && npx next start -p 3200
node vorschau/build.mjs        # → vorschau/out/startseite-vorschau.html (~9,5 MB)
```

## Wo bearbeitet wird

Die HTML-Datei ist eine **Ausgabe, keine Quelle.** Sie besteht zum größten Teil
aus eingebetteten Bildern und minimiertem CSS; darin von Hand zu ändern, wäre
verlorene Arbeit — beim nächsten Bauen ist es weg. Bearbeitet wird die Seite
selbst:

| Was | Datei |
|---|---|
| Startseite (Aufbau, Reihenfolge der Abschnitte) | `portal/src/app/page.tsx` |
| Scroll-Szene mit dem Comic-Haus | `portal/src/components/marketing/scrolly-build.tsx` |
| Kopfzeile, Fußzeile, Foto-Heros, Zahlenleiste | `portal/src/components/marketing/site.tsx` |
| Unterseiten | `portal/src/app/funktionen/*/page.tsx`, `portal/src/app/so-funktionierts/page.tsx` |
| Farben, Schriften, Animationen | `portal/src/app/globals.css` |
| Fotos | `portal/public/images/marketing/*.jpg` |

Danach `build.mjs` erneut laufen lassen — die Vorschau entsteht neu.

## Warum die fertige Datei nicht im Repository liegt

`out/` steht in der `.gitignore`. Die Datei ist rund 9,5 MB, davon fast alles
Base64-Bilder, und sie ändert sich bei jedem Bauen vollständig. Im Git würde
jede Fassung dauerhaft liegen bleiben und das Repository aufblähen, ohne dass
man in den Änderungen irgendetwas erkennen könnte. Reproduzierbar ist sie
ohnehin: ein Befehl, dieselbe Datei.

## Wie das Scrollytelling in die Vorschau kommt

Die React-Komponente trägt `data-`Attribute an allen beweglichen Teilen des
Hauses (Kran, Bauphasen, Fenster, Dachfenster, Bewohner, Fahne, Rauch). Das
servergerenderte SVG landet dadurch unverändert in der Vorschau, und der
Treiber am Ende der Datei steuert beim Scrollen **dieselben** Elemente wie die
React-Logik. Eine von Hand gepflegte Kopie der Szene gibt es nicht mehr — sie
war die Quelle dafür, dass Vorschau und Seite auseinanderliefen.
