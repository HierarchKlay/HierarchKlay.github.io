# Rebuild synthesized audio

The published MP3 sprites and attribution are in `dist/audio/`. Rebuilding needs Python, numpy, pyopenjtalk 0.4.1, and ffmpeg. It does not use a paid API.

Place the official Open JTalk UTF-8 dictionary 1.11 in `vendor/open_jtalk_dic_utf_8-1.11/` and NIT ATR503 M001 voice 1.05 in `vendor/hts_voice_nitech_jp_atr503_m001-1.05/`, relative to this directory. Use the download/attribution links in `dist/audio/ATTRIBUTION.txt` and preserve all original COPYING texts. The voice is CC BY 3.0. pyopenjtalk can be installed in the current environment or this directory's `python/`.

`KOTOBA_LESSON` may override the lesson path; by default it reads `../dist/lesson.json`. Run `generate_audio.py`, then `build_sprites.py`. Inspect generated input-reading audits, all non-silence checks and hashes before copying outputs. This proves files decode, not that their accents match a dictionary or that a native speaker has audited them.

For additional weekly blocks, supply a lesson JSON containing only the new days and new words to prevent replacing existing sprites. Preserve day numbers so new sprites receive new names. Merge the new clips/files into the existing audio manifest only after checks pass. Update overrides when adding ambiguous readings. Never invent missing accent evidence from these sounds.

Week 2 rebuild: run `python build_course.py` first. Set `KOTOBA_LESSON` to the absolute path of `source-data/week02-audio-input.json` when invoking both audio scripts. `generate_audio.py` checks both word and sentence frontend readings, using authored kana only when written text is ambiguous. Then run `python audio-tools/install_weekly_audio.py`, followed by `python build_course.py` to embed the merged manifest. Installation rejects changed offsets or different files with already-installed names. Changing an installed batch requires a new sprite name/version and an explicit migration, not an overwrite.

If the Python build defaults to a missing clang, compile with `CC=gcc CXX=g++`; extract downloaded archives with `tar --no-same-owner`. Keep python/vendor/mp3/sprites build intermediates ignored. Only the seven added sprites, combined manifest, provenance audit and existing license files are published.
