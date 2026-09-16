#!/usr/bin/env python3
"""Stellt die sprechende Person aus einem Videoabschnitt frei.

    python3 werkzeuge/freistellen.py <segment.mp4> <ziel.webm> [--modell u2net_human_seg]

Damit liegt der große Kinetic-Text zwischen Hintergrund und Person: Der Kopf
verdeckt Teile der Buchstaben, und der Text wirkt im Raum statt aufgeklebt.
Die Ebenen in Remotion, von unten nach oben: Originalvideo, Text, Freistellung.

Nur die Abschnitte freistellen, in denen wirklich ein Kinetic-Text steht
(meist 1-4 s) — und zwar aus derselben normalisierten Datei, die auch im
Schnitt läuft. Sonst sitzen Original und Freistellung nicht framegenau
übereinander und der Wechsel ist sichtbar.

Drei Nachbearbeitungen, ohne die es nicht gut aussieht:
  * zeitliches Mitteln über drei Frames — rembg entscheidet je Frame neu und
    flackert sonst an Haaren und Schultern
  * 1 px Erodieren — nimmt den Hintergrundsaum, der sonst um die Person bleibt
  * 1-2 px Weichzeichnen der Kante — ohne das wirkt die Person ausgeschnitten
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent


def ffmpeg_pfad() -> str:
    """Der ffmpeg aus node_modules — der volle Build, nicht der Minimalbau."""
    roh = subprocess.run(
        ["node", "-p", "require('ffmpeg-static')"],
        cwd=WURZEL,
        capture_output=True,
        text=True,
        check=True,
    )
    return roh.stdout.strip()


def frames_ziehen(ffmpeg: str, video: Path, ordner: Path) -> list[Path]:
    ordner.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [ffmpeg, "-y", "-i", str(video), "-vsync", "0", str(ordner / "%05d.png")],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return sorted(ordner.glob("*.png"))


def masken_berechnen(frames: list[Path], modell: str) -> list[np.ndarray]:
    from rembg import new_session, remove

    sitzung = new_session(modell)
    masken: list[np.ndarray] = []
    for nr, pfad in enumerate(frames, start=1):
        bild = Image.open(pfad).convert("RGB")
        freigestellt = remove(bild, session=sitzung)
        masken.append(np.asarray(freigestellt.getchannel("A"), dtype=np.float32))
        if nr % 10 == 0 or nr == len(frames):
            print(f"  Maske {nr}/{len(frames)}", flush=True)
    return masken


def maske_glaetten(masken: list[np.ndarray], index: int) -> Image.Image:
    """Mittelt über drei Frames, erodiert 1 px und weicht die Kante auf."""
    fenster = masken[max(0, index - 1) : index + 2]
    gemittelt = np.mean(fenster, axis=0).clip(0, 255).astype(np.uint8)
    maske = Image.fromarray(gemittelt, mode="L")
    maske = maske.filter(ImageFilter.MinFilter(3))  # erodieren
    return maske.filter(ImageFilter.GaussianBlur(radius=1.2))  # Kante federn


def schreiben(frames: list[Path], masken: list[np.ndarray], ordner: Path) -> None:
    ordner.mkdir(parents=True, exist_ok=True)
    for index, pfad in enumerate(frames):
        bild = Image.open(pfad).convert("RGB")
        bild.putalpha(maske_glaetten(masken, index))
        bild.save(ordner / pfad.name)


def zusammensetzen(ffmpeg: str, ordner: Path, ziel: Path, fps: int) -> None:
    """VP9 mit Alpha — das Format, das <OffthreadVideo transparent /> erwartet."""
    ziel.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg, "-y",
            "-framerate", str(fps),
            "-i", str(ordner / "%05d.png"),
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-b:v", "6M",
            "-auto-alt-ref", "0",
            str(ziel),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> int:
    p = argparse.ArgumentParser(description="Person aus einem Videoabschnitt freistellen")
    p.add_argument("video", type=Path)
    p.add_argument("ziel", type=Path)
    p.add_argument("--modell", default="u2net_human_seg", help="rembg-Modell (u2net_human_seg, birefnet-portrait, isnet-general-use)")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--behalte-frames", action="store_true", help="PNG-Sequenz nicht löschen")
    args = p.parse_args()

    ffmpeg = ffmpeg_pfad()
    arbeit = args.ziel.parent / f".{args.ziel.stem}-arbeit"
    roh, fertig = arbeit / "roh", arbeit / "alpha"

    frames = frames_ziehen(ffmpeg, args.video, roh)
    if not frames:
        print("Keine Frames gefunden — stimmt der Pfad?", file=sys.stderr)
        return 1
    print(f"{len(frames)} Frames, Modell {args.modell}")

    masken = masken_berechnen(frames, args.modell)
    schreiben(frames, masken, fertig)
    zusammensetzen(ffmpeg, fertig, args.ziel, args.fps)

    deckung = float(np.mean([m.mean() for m in masken]) / 255)
    print(f"fertig: {args.ziel}  (mittlere Deckung {deckung:.1%})")
    if deckung < 0.05:
        print("Warnung: fast nichts freigestellt — Modell oder Material prüfen", file=sys.stderr)

    if not args.behalte_frames:
        shutil.rmtree(arbeit, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
