#!/usr/bin/env python3
"""Baut das Erklaervideo aus Portal-Screenshots + Sprecher-Blöcken."""
import json, os, subprocess, sys

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "shots")
VO = os.path.join(BASE, "vo")
CLIPS = os.path.join(BASE, "clips")
FONT = os.path.join(BASE, "..", "..", "portal", "public", "fonts", "SourceSans3-Semibold.ttf")
W, H, FPS = 1920, 1080, 30
XF = 0.5          # Kreuzblende zwischen Clips
LEAD, GAP, TAIL = 0.8, 0.9, 1.2

os.makedirs(CLIPS, exist_ok=True)


def dur(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


# Block = (Sprecher-Datei, Bauchbinde, [(Screenshot, Ken-Burns-Modus), ...])
BLOCKS = [
    ("01.wav", "Ihr Kundenportal", [("login.png", "in"), ("eig-verbrauch.png", "in")]),
    ("02.wav", "Alles auf einen Blick", [("eig-dashboard.png", "in")]),
    ("03.wav", "Vorgänge live verfolgen", [("eig-vorgaenge.png", "down"), ("vw-verwaltung.png", "in")]),
    ("04.wav", "WEG-Finanzen nachvollziehbar", [("vw-weg-wirtschaftsplan.png", "in"), ("vw-weg-detail.png", "in")]),
    ("05.wav", "Digital abstimmen, alles dokumentiert", [("eig-beschluesse.png", "in"), ("eig-dokumente.png", "down")]),
    ("06.wav", None, [("endcard.png", "still")]),
]


def kenburns(mode, frames):
    """Liefert den zoompan-Filter für den gewünschten Kamerablick."""
    if mode == "still":
        z = "1.0"
        x, y = "iw/2-(iw/zoom/2)", "0"
    elif mode == "in":
        z = f"min(1.0+0.00035*on,1.045)"
        x, y = "iw/2-(iw/zoom/2)", "0"
    else:  # down: langsamer Schwenk nach unten mit leichtem Zoom
        z = f"min(1.0+0.00022*on,1.03)"
        x, y = "iw/2-(iw/zoom/2)", f"(ih-ih/zoom)*on/{max(frames-1,1)}"
    return (f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS}")


def caption_filter(text, clip_len):
    if not text:
        return None
    safe = text.replace("\\", "").replace(":", "\\:").replace("'", "")
    fade_in = 0.45
    alpha = (f"if(lt(t,{fade_in}),t/{fade_in},"
             f"if(gt(t,{clip_len - 0.5}),max(0,({clip_len}-t)/0.5),1))")
    # Achtung: in drawbox meint h die Boxhöhe – die Bildhöhe ist ih.
    bar = (f"drawbox=x=96:y=ih-182:w=8:h=64:color=0xf69018:t=fill:"
           f"enable='between(t,0.45,{clip_len})'")
    txt = (f"drawtext=fontfile={FONT}:text='{safe}':fontcolor=white:fontsize=46:"
           f"x=128:y=h-176:box=1:boxcolor=0x1a1512@0.72:boxborderw=22:"
           f"alpha='{alpha}'")
    # Textkasten zuerst, Akzentbalken darüber – sonst verdeckt die Box den Balken.
    return txt + "," + bar


def main():
    # 1) Laufzeiten je Block aus dem Sprecher ableiten
    plan = []
    for i, (wav, cap, shots) in enumerate(BLOCKS):
        a = dur(os.path.join(VO, wav))
        lead = LEAD if i == 0 else 0.0
        tail = TAIL if i == len(BLOCKS) - 1 else GAP
        block_len = lead + a + tail
        per = block_len / len(shots)
        for j, (shot, mode) in enumerate(shots):
            plan.append({"shot": shot, "mode": mode, "len": per,
                         "cap": cap if j == 0 else None,
                         "cap_len": block_len if j == 0 else 0})
    total = sum(p["len"] for p in plan)
    print(f"Clips: {len(plan)}  Gesamtlaufzeit: {total:.2f}s")

    # 2) Einzelclips rendern (alle bis auf den letzten mit Blenden-Überhang)
    for idx, p in enumerate(plan):
        out = os.path.join(CLIPS, f"c{idx:02d}.mp4")
        clip_len = p["len"] + (XF if idx < len(plan) - 1 else 0)
        frames = max(int(round(clip_len * FPS)), 1)
        vf = [
            f"scale={int(W*1.35)}:-1:flags=lanczos",
            f"crop={int(W*1.35)}:{int(H*1.35)}:0:0",
            kenburns(p["mode"], frames),
        ]
        cap = caption_filter(p["cap"], p["cap_len"]) if p["cap"] else None
        if cap:
            vf.append(cap)
        vf.append("format=yuv420p")
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-loop", "1",
               "-framerate", str(FPS), "-i", os.path.join(SHOTS, p["shot"]),
               "-t", f"{clip_len:.3f}", "-vf", ",".join(vf),
               "-c:v", "libx264", "-preset", "medium", "-crf", "18",
               "-pix_fmt", "yuv420p", "-r", str(FPS), out]
        subprocess.run(cmd, check=True)
        print(f"  {p['shot']:34s} {clip_len:5.2f}s  {p['mode']}")

    # 3) Clips mit Kreuzblenden verketten
    inputs, filt, prev, offset = [], [], "[0:v]", 0.0
    for idx in range(len(plan)):
        inputs += ["-i", os.path.join(CLIPS, f"c{idx:02d}.mp4")]
    for idx in range(1, len(plan)):
        offset += plan[idx - 1]["len"]
        lbl = f"[x{idx}]"
        filt.append(f"{prev}[{idx}:v]xfade=transition=fade:duration={XF}:"
                    f"offset={offset - XF:.3f}{lbl}")
        prev = lbl
    vchain = ",".join([]) if not filt else ";".join(filt)
    fade_out_start = max(total - 0.8, 0)
    final = f"{prev}fade=t=in:st=0:d=0.6,fade=t=out:st={fade_out_start:.2f}:d=0.8[v]"
    filter_complex = (vchain + ";" + final) if filt else final

    # 4) Tonspur: Pausen zwischen den Blöcken einfügen, normalisieren
    a_parts, a_filt, cursor = [], [], LEAD
    for i, (wav, _, _) in enumerate(BLOCKS):
        a_parts += ["-i", os.path.join(VO, wav)]
        a_filt.append(f"[{len(plan)+i}:a]aresample=48000,"
                      f"adelay={int(cursor*1000)}|{int(cursor*1000)}[a{i}]")
        cursor += dur(os.path.join(VO, wav)) + GAP
    mix = "".join(f"[a{i}]" for i in range(len(BLOCKS)))
    a_filt.append(f"{mix}amix=inputs={len(BLOCKS)}:normalize=0,"
                  f"loudnorm=I=-16:TP=-1.5:LRA=11,"
                  f"afade=t=out:st={fade_out_start:.2f}:d=0.8[a]")

    out_path = os.path.join(BASE, "kundenportal-erklaervideo.mp4")
    cmd = (["ffmpeg", "-y", "-loglevel", "error"] + inputs + a_parts +
           ["-filter_complex", filter_complex + ";" + ";".join(a_filt),
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "slow", "-crf", "19",
            "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
            "-t", f"{total:.3f}", out_path])
    subprocess.run(cmd, check=True)
    print("fertig:", out_path, f"{dur(out_path):.2f}s")


if __name__ == "__main__":
    main()
