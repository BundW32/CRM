#!/usr/bin/env python3
"""Baut das Erklaervideo aus Firmen-Intro, Portal-Screenshots und Abspann.

Bild- und Tonspur richten sich nach den Sprecheraufnahmen in vo/: die Laenge
eines Blocks ergibt sich aus seiner Aufnahme, die Screens teilen sich diese Zeit
nach Gewicht. Intro und Abspann sind echte CSS-Animationen, die vorher mit
capture.mjs als Einzelbilder aufgenommen wurden.
"""
import os, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "shots")
FRAMES = os.path.join(BASE, "frames")
VOICE = os.environ.get("VOICE", "vo")   # Ordner mit den Sprecheraufnahmen
VO = os.path.join(BASE, VOICE)
CLIPS = os.path.join(BASE, "clips")
FONT = os.path.join(BASE, "..", "..", "portal", "public", "fonts", "SourceSans3-Semibold.ttf")
MUSIC = os.path.join(BASE, "music.mp3")   # optional, siehe README
W, H, FPS = 1920, 1080, 30
LEAD, GAP, TAIL = 0.6, 0.75, 1.4

os.makedirs(CLIPS, exist_ok=True)


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


# Ein Screen: (Datei, Kamerafahrt, Gewicht, Fokuspunkt, Übergang zum nächsten)
# Kamerafahrten: in/out = langsam heran oder heraus, down = Schwenk nach unten,
# push/pull = kräftig auf den Fokus zu bzw. von ihm weg, still = ruhig stehen.
# Der Fokuspunkt ist ein Anteil von Breite und Höhe (0.5/0.5 wäre die Mitte).
# Namen mit @ sind aufgenommene Animationen aus frames/.
BLOCKS = [
    ("00.wav", None, [
        ("@intro", "still", 1.0, None, "smoothleft"),
    ]),
    ("01.wav", "Ihr Kundenportal", [
        ("login.png", "pull", 1.0, (0.5, 0.42), "slideleft"),
        ("eig-verbrauch.png", "in", 1.0, None, "fade"),
    ]),
    ("02.wav", "Alles auf einen Blick", [
        ("eig-dashboard.png", "push", 1.35, (0.72, 0.34), "slideleft"),
        ("vw-weg-detail.png", "in", 1.0, None, "fade"),
    ]),
    ("03.wav", "Vorgänge live verfolgen", [
        ("eig-vorgaenge.png", "down", 1.3, None, "slideleft"),
        ("vw-verwaltung.png", "in", 1.0, None, "fade"),
    ]),
    ("04.wav", "WEG-Finanzen nachvollziehbar", [
        ("vw-weg-wirtschaftsplan.png", "in", 1.15, None, "slideleft"),
        ("vw-plan-detail.png", "down", 1.0, None, "slideleft"),
        ("vw-weg-erhaltungsplanung.png", "push", 1.0, (0.5, 0.26), "fade"),
    ]),
    ("05.wav", "Digital abstimmen, alles dokumentiert", [
        ("eig-beschluesse.png", "push", 1.0, (0.5, 0.3), "slideleft"),
        ("eig-dokumente.png", "down", 1.0, None, "fadeblack"),
    ]),
    ("06.wav", None, [
        ("@endcard", "still", 1.0, None, None),
    ]),
]

XF = {"fade": 0.5, "fadeblack": 0.6, "slideleft": 0.45, "smoothleft": 0.5}

# Aufbereitung der Sprecherspur: Rumpeln weg, etwas weniger Kastenklang,
# mehr Präsenz für die Verständlichkeit, Zischlaute gebändigt und ein sanfter
# Kompressor, damit die Lautstärke über alle Sätze gleich bleibt.
VOICE_FX = ",".join([
    "aresample=48000:resampler=soxr",
    "highpass=f=85",
    "equalizer=f=260:t=q:w=1.1:g=-2",
    "equalizer=f=3200:t=q:w=1.6:g=2.5",
    "deesser=i=0.35",
    "acompressor=threshold=-18dB:ratio=3:attack=8:release=180:makeup=1.6",
])


def kenburns(mode, frames, focus):
    """zoompan-Ausdruck für die gewünschte Kamerafahrt."""
    fx, fy = focus if focus else (0.5, 0.35)
    last = max(frames - 1, 1)
    cx = "iw/2-(iw/zoom/2)"
    if mode == "still":
        return f"zoompan=z=1:x=0:y=0:d={frames}:s={W}x{H}:fps={FPS}"
    if mode == "in":
        return (f"zoompan=z='min(1+0.00035*on,1.045)':x='{cx}':y='0':"
                f"d={frames}:s={W}x{H}:fps={FPS}")
    if mode == "out":
        return (f"zoompan=z='max(1.05-0.00035*on,1.0)':x='{cx}':y='0':"
                f"d={frames}:s={W}x{H}:fps={FPS}")
    if mode == "down":
        return (f"zoompan=z='min(1+0.00022*on,1.03)':x='{cx}':"
                f"y='(ih-ih/zoom)*on/{last}':d={frames}:s={W}x{H}:fps={FPS}")
    # push/pull fahren zwischen Totale und Fokus; der Ausschnitt wandert mit,
    # damit der interessante Teil in der Bildmitte landet.
    z = f"1+0.28*on/{last}" if mode == "push" else f"1.28-0.28*on/{last}"
    x = f"max(0,min(iw-iw/zoom,(iw*{fx}-(iw/zoom/2))))"
    y = f"max(0,min(ih-ih/zoom,(ih*{fy}-(ih/zoom/2))))"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={W}x{H}:fps={FPS}"


def caption_filter(text, hold):
    safe = text.replace("\\", "").replace(":", "\\:").replace("'", "")
    fin = 0.5
    alpha = f"if(lt(t,{fin}),t/{fin},if(gt(t,{hold-0.45}),max(0,({hold}-t)/0.45),1))"
    txt = (f"drawtext=fontfile={FONT}:text='{safe}':fontcolor=white:fontsize=46:"
           f"x=128:y=h-176:box=1:boxcolor=0x1a1512@0.72:boxborderw=22:alpha='{alpha}'")
    # Achtung: in drawbox meint h die Boxhöhe – die Bildhöhe ist ih.
    bar = (f"drawbox=x=96:y=ih-182:w=8:h=64:color=0xf69018:t=fill:"
           f"enable='between(t,{fin},{hold})'")
    return txt + "," + bar


def render_clip(idx, spec, length, caption, cap_hold):
    name, mode, _, focus, _ = spec
    out = os.path.join(CLIPS, f"c{idx:02d}.mp4")
    frames = max(int(round(length * FPS)), 1)
    vf = []
    if name.startswith("@"):
        folder = os.path.join(FRAMES, name[1:])
        src = ["-framerate", str(FPS), "-i", os.path.join(folder, "f%04d.png")]
        have = len(os.listdir(folder))
        if have < frames:   # fehlende Zeit am Ende mit dem letzten Bild füllen
            vf.append(f"tpad=stop_mode=clone:stop_duration={(frames-have)/FPS:.3f}")
    else:
        src = ["-loop", "1", "-framerate", str(FPS), "-i", os.path.join(SHOTS, name)]
        vf += [f"scale={int(W*1.5)}:-1:flags=lanczos",
               f"crop={int(W*1.5)}:{int(H*1.5)}:0:0",
               kenburns(mode, frames, focus)]
    if caption:
        vf.append(caption_filter(caption, cap_hold))
    vf.append("format=yuv420p")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + src +
                   ["-t", f"{length:.3f}", "-vf", ",".join(vf),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-r", str(FPS), out], check=True)


def main():
    # 1) Zeitplan: Blocklänge aus der Aufnahme, Aufteilung nach Gewicht
    plan, audio = [], []
    cursor = LEAD
    for i, (wav, cap, shots) in enumerate(BLOCKS):
        a = dur(os.path.join(VO, wav))
        audio.append((wav, cursor))
        tail = TAIL if i == len(BLOCKS) - 1 else GAP
        block = (LEAD if i == 0 else 0.0) + a + tail
        cursor += a + GAP
        total_w = sum(s[2] for s in shots)
        for j, s in enumerate(shots):
            plan.append({"spec": s, "len": block * s[2] / total_w,
                         "cap": cap if j == 0 else None, "cap_hold": block})
    total = sum(p["len"] for p in plan)
    print(f"{len(plan)} Clips, Gesamtlaufzeit {total:.2f}s")

    # 2) Clips rendern – mit Überhang für die Blende zum nächsten Clip
    for idx, p in enumerate(plan):
        trans = p["spec"][4]
        over = XF.get(trans, 0.0) if idx < len(plan) - 1 else 0.0
        render_clip(idx, p["spec"], p["len"] + over, p["cap"], p["cap_hold"])
        print(f"  {p['spec'][0]:28s} {p['len']:5.2f}s  {p['spec'][1]:<5} {trans or ''}")

    # 3) Clips mit wechselnden Übergängen verketten
    inputs, filt, prev, offset = [], [], "[0:v]", 0.0
    for idx in range(len(plan)):
        inputs += ["-i", os.path.join(CLIPS, f"c{idx:02d}.mp4")]
    for idx in range(1, len(plan)):
        trans = plan[idx - 1]["spec"][4]
        d = XF.get(trans, 0.5)
        offset += plan[idx - 1]["len"]
        lbl = f"[x{idx}]"
        filt.append(f"{prev}[{idx}:v]xfade=transition={trans}:duration={d}:"
                    f"offset={offset-d:.3f}{lbl}")
        prev = lbl
    fade_out = max(total - 1.0, 0)
    filt.append(f"{prev}fade=t=in:st=0:d=0.7,fade=t=out:st={fade_out:.2f}:d=1.0[v]")

    # 4) Ton: Sprecher an die geplanten Zeiten, optional Musikbett darunter
    a_inputs, a_filt = [], []
    n = len(plan)
    for i, (wav, at) in enumerate(audio):
        a_inputs += ["-i", os.path.join(VO, wav)]
        a_filt.append(f"[{n+i}:a]{VOICE_FX},adelay={int(at*1000)}|{int(at*1000)}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(audio)))
    a_filt.append(f"{mix}amix=inputs={len(audio)}:normalize=0[speech]")
    bus = "[speech]"
    if os.path.exists(MUSIC):
        a_inputs += ["-stream_loop", "-1", "-i", MUSIC]
        a_filt.append(f"[{n+len(audio)}:a]aresample=48000,volume=-20dB,"
                      f"afade=t=in:st=0:d=1.5,afade=t=out:st={fade_out:.2f}:d=1.0[bed]")
        a_filt.append("[speech]asplit=2[sp1][sp2]")
        # Musik unter der Stimme automatisch absenken
        a_filt.append("[bed][sp1]sidechaincompress=threshold=0.03:ratio=6:"
                      "attack=20:release=400[duck]")
        a_filt.append("[duck][sp2]amix=inputs=2:normalize=0[premix]")
        bus = "[premix]"
    a_filt.append(f"{bus}loudnorm=I=-16:TP=-1.5:LRA=11,"
                  f"afade=t=out:st={fade_out:.2f}:d=1.0[a]")

    suffix = "" if VOICE == "vo" else "-" + VOICE.replace("vo-", "")
    out_path = os.path.join(BASE, f"kundenportal-erklaervideo{suffix}.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + inputs + a_inputs +
                   ["-filter_complex", ";".join(filt + a_filt),
                    "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "19",
                    "-pix_fmt", "yuv420p", "-r", str(FPS),
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                    "-t", f"{total:.3f}", out_path], check=True)
    print("fertig:", out_path, f"{dur(out_path):.2f}s")


if __name__ == "__main__":
    main()
