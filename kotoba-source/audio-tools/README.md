# Rebuild synthesized audio

The published MP3 sprites and attribution are in `dist/audio/`. Rebuilding needs Python, numpy, pyopenjtalk 0.4.1, and ffmpeg. It does not use a paid API.

Place the official Open JTalk UTF-8 dictionary 1.11 in `vendor/open_jtalk_dic_utf_8-1.11/` and NIT ATR503 M001 voice 1.05 in `vendor/hts_voice_nitech_jp_atr503_m001-1.05/`, relative to this directory. Use the download/attribution links in `dist/audio/ATTRIBUTION.txt` and preserve all original COPYING texts. The voice is CC BY 3.0. pyopenjtalk can be installed in the current environment or this directory's `python/`.

`KOTOBA_LESSON` may override the lesson path; by default it reads `../dist/lesson.json`. Run `generate_audio.py`, then `build_sprites.py`. Inspect generated input-reading audits, all non-silence checks and hashes before copying outputs. This proves files decode, not that their accents match a dictionary or that a native speaker has audited them.

For additional weekly blocks, supply a lesson JSON containing only the new days and new words to prevent replacing existing sprites. Preserve day numbers so new sprites receive new names. Merge the new clips/files into the existing audio manifest only after checks pass. Update overrides when adding ambiguous readings. Never invent missing accent evidence from these sounds.
