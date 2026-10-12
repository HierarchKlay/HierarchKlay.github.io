#!/usr/bin/env python3
"""Pre-render the current lesson with a licensed, local Open JTalk voice.

No online TTS service, browser voice, or copied dictionary audio is used.
The audio is a synthetic reading aid, not independent pitch-accent evidence.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "python"))
os.environ["OPEN_JTALK_DICT_DIR"] = str(ROOT / "vendor/open_jtalk_dic_utf_8-1.11")
import numpy as np
import pyopenjtalk

LESSON = Path(os.environ.get("KOTOBA_LESSON", str(ROOT.parent / "dist/lesson.json")))
VOICE = ROOT / "vendor/hts_voice_nitech_jp_atr503_m001-1.05/nitech_jp_atr503_m001.htsvoice"
DEST = ROOT / "mp3"
WORD_OVERRIDES = {"shizuka": "しずか", "joubu": "じょうぶ"}
EXAMPLE_OVERRIDES = {
    "n054": ("開きます", "あきます"),
    "n059": ("十分", "じゅっぷん"),
    "iu": ("何", "なん"),
    "v065": ("十分", "じゅっぷん"),
    "kirai": ("辛い", "からい"),
}
ENGINE = None


def init_worker():
    global ENGINE
    ENGINE = pyopenjtalk.HTSEngine(str(VOICE).encode())


def katakana(text):
    return "".join(chr(ord(c) + 96) if "ぁ" <= c <= "ゖ" else c for c in text)


def clean_read(text):
    return re.sub("[^ァ-ヶー]", "", katakana(text))


def render(task):
    filename, source_text, synthesis_text, expected_reading, kind = task
    if ENGINE is None:
        init_worker()
    frontend = pyopenjtalk.run_frontend(synthesis_text)
    lexical_read = "".join(node["read"] for node in frontend)
    pronunciation = pyopenjtalk.g2p(synthesis_text, kana=True)
    ENGINE.set_speed(0.88 if kind == "word" else 0.95)
    rate = ENGINE.get_sampling_frequency()
    pcm = ENGINE.synthesize(pyopenjtalk.make_label(frontend))
    if not np.isfinite(pcm).all() or len(pcm) < rate * 0.15:
        raise ValueError(f"Invalid speech waveform: {filename}")
    peak = float(np.max(np.abs(pcm)))
    if peak < 20:
        raise ValueError(f"Silent speech waveform: {filename}")
    # Preserve a short margin around the voiced/unvoiced utterance.
    active = np.flatnonzero(np.abs(pcm) >= peak * 0.004)
    lo = max(0, int(active[0]) - int(rate * 0.12))
    hi = min(len(pcm), int(active[-1]) + int(rate * 0.16))
    pcm = pcm[lo:hi]
    pcm = np.rint(pcm * min(6.0, 24000.0 / peak)).astype("<i2")
    out = DEST / filename
    proc = subprocess.run([
        "ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "s16le",
        "-ar", str(rate), "-ac", "1", "-i", "pipe:0", "-threads", "1",
        "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k",
        "-metadata", f"title={source_text}", "-metadata",
        "comment=Synthetic Japanese reading aid; NIT ATR503 M001 1.05 (CC BY 3.0)",
        str(out),
    ], input=pcm.tobytes(), capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode(errors="replace"))
    # Decode the final artifact, not only the pre-encoding waveform.
    decoded = subprocess.run([
        "ffmpeg", "-v", "error", "-nostdin", "-i", str(out), "-threads", "1",
        "-f", "f32le", "-acodec", "pcm_f32le", "-ar", "24000", "-ac", "1", "pipe:1",
    ], capture_output=True, check=True)
    samples = np.frombuffer(decoded.stdout, dtype="<f4")
    duration = len(samples) / 24000
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
    out_peak = float(np.max(np.abs(samples)))
    if not np.isfinite(samples).all() or duration < 0.15 or rms < 0.002 or out_peak >= 1.0:
        raise ValueError(f"Decoded artifact failed audio checks: {filename}: {duration} / {rms} / {out_peak}")
    data = out.read_bytes()
    return {
        "filename": filename, "kind": kind, "sourceText": source_text,
        "synthesisInput": synthesis_text, "expectedReading": expected_reading,
        "frontendReading": lexical_read, "frontendPronunciation": pronunciation,
        "readingOverride": source_text != synthesis_text,
        "durationSeconds": round(duration, 4), "sampleRate": 24000,
        "channels": 1, "bitRate": 64000, "decodedPeak": round(out_peak, 6),
        "decodedRMS": round(rms, 6), "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def main():
    source_bytes = LESSON.read_bytes()
    lesson = json.loads(source_bytes)
    tasks = []
    read_audit = []
    for word in lesson["words"]:
        ident = word["id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", ident):
            raise ValueError(f"Unsafe filename ID: {ident}")
        sentence = "".join(p[0] for p in word["example"])
        sentence_reading = "".join(p[1] if len(p) > 1 and p[1] else p[0] for p in word["example"])
        word_input = WORD_OVERRIDES.get(ident, word["word"])
        sentence_input = sentence
        if ident in EXAMPLE_OVERRIDES:
            before, after = EXAMPLE_OVERRIDES[ident]
            if before not in sentence:
                raise ValueError(f"Outdated speech override: {ident}")
            sentence_input = sentence.replace(before, after)
        # All 315 standalone words are checked against the authored kana.
        observed = "".join(n["read"] for n in pyopenjtalk.run_frontend(word_input))
        if clean_read(observed) != clean_read(word["reading"]):
            raise ValueError(f"Unexpected word pronunciation: {ident}: {observed}")
        read_audit.append({"id": ident, "word": word["word"], "expected": word["reading"], "frontend": observed})
        tasks += [
            (f"{ident}.mp3", word["word"], word_input, word["reading"], "word"),
            (f"{ident}-example.mp3", sentence, sentence_input, sentence_reading, "example"),
        ]
    DEST.mkdir(exist_ok=True)
    results = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=4, initializer=init_worker) as pool:
        for result in pool.map(render, tasks):
            results.append(result)
            if len(results) % 50 == 0:
                print(f"Generated and decoded {len(results)}/{len(tasks)}", flush=True)
    results.sort(key=lambda x: x["filename"])
    manifest = {
        "version": 1, "engine": "pyopenjtalk 0.4.1 / Open JTalk",
        "voice": "NIT ATR503 M001 1.05", "voiceLicense": "CC BY 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
        "voiceSource": "https://sourceforge.net/projects/open-jtalk/files/HTS%20voice/hts_voice_nitech_jp_atr503_m001-1.05/",
        "voiceSha256": hashlib.sha256(VOICE.read_bytes()).hexdigest(),
        "lessonSha256": hashlib.sha256(source_bytes).hexdigest(),
        "notice": "Synthetic speech, not a native-speaker recording or pitch-accent reference. Text readings checked; generated prosody not independently audited.",
        "wordCount": len(lesson["words"]), "fileCount": len(results),
        "totalBytes": sum(r["bytes"] for r in results),
        "wordReadingsChecked": read_audit, "files": results,
    }
    (ROOT / "audio-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"files": len(results), "bytes": manifest["totalBytes"], "seconds": round(sum(r["durationSeconds"] for r in results),2)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
