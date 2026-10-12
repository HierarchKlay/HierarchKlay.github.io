# 日々ことば

Study at https://hierarchklay.github.io/kotoba/ . This directory contains source material and build scripts for the public static app in `../kotoba/`.

## Local checks

Use Node.js 24+ (for the TypeScript endpoint test) and Python 3.11+. From `kotoba-source/`, copy the deployed frontend into a disposable build directory first:

```sh
cp -R ../kotoba ./dist
node test_core.mjs
node test_app.mjs
python3 build_course.py
```

Serve `dist/` over HTTP to preview. Opening `index.html` directly as a file cannot load the JSON/modules in many browsers. Browser progress uses localStorage. Import/export is available; never commit exported progress.

`build_course.py` builds the initial seven-day block. For future blocks, extend this builder before rebuilding so existing IDs, days, and new additions are retained. `MAINTENANCE.md` describes authorized automatic updates. `test_app.mjs` is a DOM stub and is not visual/browser verification.

PDF rebuilding also requires reportlab and fontTools; `build_v3_pdf.py --out dist/kotoba-sample.pdf` uses the supplied subset fonts. Regenerate subsets with `build_fonts.py` when adding glyphs. Supply full Japanese and Simplified Chinese Noto Sans CJK fonts using its `--full-font-dir` option. The downloadable PDF is the fixed Day 1 lesson; the website can print the current lesson including replacements.

## Data and pronunciation

- 315 vocabulary entries: 245 core and 70 reserve; 7 independent kanji lessons of 5 characters each.
- Accent evidence is attached to each verified record. Missing accent evidence stays explicitly unavailable.
- Audio sprites are synthesized with Open JTalk, not recorded by a human teacher, and do not validate dictionary accents. Preserve `audio/ATTRIBUTION.txt` and its license notice.
- Lessons contain original study examples and translations, not a transcript or an exact frequency ranking from the referenced video.
- Course content is public. Personal learning history remains local until optional Supabase sync is configured; it is never committed to GitHub.

## Publication

The existing repository publishes its main branch root with GitHub Pages. Copy reviewed frontend outputs from `dist/` to `../kotoba/`, then commit with source changes. Do not modify the personal homepage outside `kotoba/` and `kotoba-source/`.

The companion private ChatGPT Site is updated through the Sites workflow. Public and private hosts have different browser storage origins; configure the same Supabase project for both hosts or use export/import to move progress.

## Optional cloud sync and Japanese tutor

See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for project setup, private study accounts, progress merging and the Qwen Responses API proxy and Anthropic web-search compatibility test, Japanese tutor presets and safe Markdown rendering. Until `cloud-config.json` is filled, progress remains local and the new controls show their pending status. Do not commit real model/admin credentials.
