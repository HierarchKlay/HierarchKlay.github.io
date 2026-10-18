# 日々ことば maintenance contract

User-authorized scope: maintain this Japanese study app and its course content automatically. Daily study is 35 new vocabulary items plus 5 independent kanji; vocabulary-card kanji notes stay on those cards. Preserve ratings, stable IDs, and all existing lessons. Use common modern orthography, not rare kanji as large headwords. High-frequency/practical selection may include stable randomization; never describe the course as the exact BCCWJ top-N list.

## Canonical repositories and publishing

- The public mirror is `HierarchKlay/HierarchKlay.github.io`, branch `main`.
- App files live only under `kotoba/`. Existing homepage files must not be edited.
- Build/source files live under `kotoba-source/`. Frontend files under `kotoba/` are buildless HTML, CSS and ES modules.
- Public address: `https://hierarchklay.github.io/kotoba/`.
- The companion owner-private Site is `appgprj_6acca0b4acfc819187b83130b4bda603`. Use the Sites skill and source helper for changes. Do not make it public or commit credentials/access tokens.
- Preserve each host's static-relative URLs and audio metadata. GitHub Pages publishing follows pushes to its configured `main` root source.
- Before writing, fetch the current branch head and relevant files. Commit on that head and update using an expected-head guard. Never force-push. Read back the resulting commit and check Pages build status. If an integration blocks a write, report the exact blocker; do not claim the site was updated.

## Weekly content maintenance

At the scheduled run, prepare the next 7 lessons only after the existing material is checked. Initial block is 7 lessons. Each weekly batch adds 245 core words, 70 unique reserve words, and 35 independent kanji. Avoid duplicate words/readings across all prior batches. Use stable IDs unrelated to display positions. Keep course.id stable (`week01-v1`) so old exported progress remains importable; allow course.days to grow.

Add complete entries with everyday spelling, kana reading, Chinese meaning, natural original example with ruby, translation, brief usage note, short kanji note, and an unambiguous target-word cloze. Verify pronunciation and meanings against primary sources. Accent numbers require a traceable dictionary/textbook source and a matching spelling, reading and sense; retain alternatives and evidence. If verification fails, mark accent as unavailable rather than fabricate it. Synthesis cannot verify a pitch accent. Include only source-verified kanji readings and useful compounds. Do not copy a whole copyrighted dictionary.

Audio uses Open JTalk with NIT ATR503 M001 1.05 and attribution in `kotoba/audio/ATTRIBUTION.txt`. The model is CC BY 3.0; use the exact license statement, not the older model's BSD license. Generate audio with reading checks; pack new clips in additional sprite files and never change offsets in existing files. No API keys or paid TTS purchases are authorized by this maintenance instruction. If generation is unavailable, retain existing audio and label missing clips accurately; device voice may be a fallback.

Run the core tests and DOM integration checks before publication. Validate 35+10 vocabulary entries and 5 kanji for each new day, globally unique IDs, exact example/cloze reconstruction, valid source URLs and accent ranges, all media paths, and progress migration. Update a dated changelog and the lesson index. Preserve previous content when checks fail. PDF generation is optional for weekly runs; do not let an unverified PDF block valid web updates. If updating the Day 1 PDF, use the existing Library identity rather than creating a duplicate.

## Learning statistics and limits

The user has authorized Supabase cloud sync. On 2026-10-13 the frontend was configured for user-owned project `mtszdktdpjipjvbspetr` with its public publishable key. The user has deployed the initial Qwen function; read-only checks confirm it responds and rejects unauthenticated calls. The progress table exists and denies anonymous reads. Actual authenticated cross-device sync remains unverified. The user confirmed real-key plain Q&A works on 2026-10-13; real web search is still pending user verification. Preserve `dist/cloud-config.json` / `kotoba/cloud-config.json`, the Supabase migration history, per-item merge records, unique practice event IDs, account allowlist, RLS and server-side authorization. Never write private credentials into the public repository. Cloud events are not automatically accessible to background ChatGPT tasks: no private database access has been provisioned for unattended personal analysis. Do not invent user performance, assume a lesson was studied, or infer progress from deployment. Charts calculate actual local/merged events. Follow SUPABASE-SETUP.md for connection details; the default network-search path uses the ordinary Responses API. On 2026-10-13 the user explicitly requested a technical test with the existing Token Plan key. The backend now removes subscription-prefix/domain rejection and automatically uses Anthropic Messages for `/apps/anthropic` endpoints. The path now supports requested native web search using the provider-documented HTTP tool configuration and compatibility marker, with at most 3 searches per request, and preserves login/member/quota/endpoint checks. Derive search status from structured evidence and never treat a failed tool call or model-written URL as a successful search. Preserve the Japanese tutor presets in prompts.mjs and the vendored sanitized Markdown renderer; tests require jsdom only outside the browser. Do not undo this user-requested compatibility path during scheduled maintenance. Do not claim real search success until observed, fabricate client headers to bypass provider restrictions, or automatically retry a provider permission rejection. Do not invoke paid models during scheduled course maintenance.

The daily reminder is separately scheduled for 12:40 Asia/Shanghai. Do not create duplicate reminders. Weekly maintenance summaries should report exactly which lessons were added, quality gaps, tests, and verified publication status; not fictional personal learning reports.

Cloud changes require `node test_cloud.mjs` and `node test_endpoint.mjs` in addition to core and DOM tests. Tutor/Markdown changes also require `node test_tutor.mjs` with jsdom@30.1.2 available (or JSDOM_MODULE pointing to its installed api.js). Database changes require the embedded PostgreSQL/RLS tests or a real isolated database test; never test destructive operations on the user’s live project. Frontend/vendor files must be mirrored, and `supabase/` plus setup/test source files live under `kotoba-source/`.

## Sync failure diagnosis (2026-10-13)

A user-reported RPC sync failure remains awaiting authenticated error details. Preserve `sync-errors.mjs` and the expandable diagnostics UI. Never interpret deliberate anonymous denial as evidence that the user's authenticated role should be opened to anon. No production database mutation has been made for this investigation. Real-course PostgreSQL fixtures and the mocked signed-in sync UI pass without touching user data. After cloud UI changes run `node test_sync_errors.mjs` and `node test_sync_ui.mjs` (jsdom available through JSDOM_MODULE). Keep raw Postgres row details and auth secrets out of diagnostic reports.

On 2026-10-13 the user also reported mobile sign-in failing while desktop is signed in. The old UI conflated all returned Auth errors with invalid passwords. `auth-errors.mjs` and the login details panel now distinguish credentials, connectivity, verification, throttling and service errors without exposing raw auth payloads. Preserve exact password input and the visibility control; do not trim/normalize passwords or treat a cached desktop session as proof of current credentials. Actual mobile Auth error and authenticated RPC error are still pending user feedback. `test_auth.mjs` exercises the mocked login flow.

## Offline dictionary (2026-10-13, trilingual upgrade)

The user authorized Wiktionary + Tomoshi + JMdict as the offline dictionary. `dist/dictionary/` / `kotoba/dictionary/` contains three separate definition packs under CC BY-SA 4.0: official JMdict Japanese/English, Tomoshi AI-assisted Chinese, and Chinese Wiktionary Japanese entries extracted by Kaikki/Wiktextract. Preserve attribution, licence links, source dates/hashes and every source label. Tomoshi is explicitly approved imported AI-assisted data, not publisher-reviewed Chinese; label it accordingly. Do not generate new query-time definitions/accents or scrape commercial dictionaries. The optional commercial Monokakido link is separate.

Tomoshi glosses must match JMdict ID, overlapping writing and reading, and a unique exact ordered English gloss list on both sides. Retain current JMdict sense/reading restrictions; do not guess unmatched associations or import app-only examples. Wiktionary keeps separate sense numbering and original simplified/traditional text. Link only unambiguous spelling plus all known readings, observing JMdict reading restrictions; otherwise show an independent entry and mark missing sources. Preserve archaic/obsolete/rare and other usage tags. Chinese/English search is definition reverse lookup, not a separately edited Chinese–Japanese dictionary.

The user also authorized Kanjium + Wiktionary pitch accents and JMdict/Tatoeba
examples on 2026-10-13. Keep these as separate `pitch` and `examples` supplements
so existing three-pack installations download only the additions. Accent data is
CC BY-SA 4.0; Kanjium credits Uros O. Retain variants and POS conditions, require
unique spelling/reading matches and preserve uncertain Wiktionary notation rather
than invent a numeric position. Draw mora-based pitch diagrams including a clearly
labelled following-particle guide. Examples use official JMdict sense associations
(CC BY-SA 4.0) and unchanged Tatoeba text (CC BY 2.0 FR). Preserve sentence IDs,
authors and source/license links for Japanese, English and Chinese individually.
Only attach direct Japanese–Mandarin translations; label missing Chinese. Show the
first two per-sense examples and existing Wiktionary examples without expansion.
Do not conflate sentence text licences with dictionary data or import audio.

The worker verifies all compressed pack SHA-256 hashes, lengths, dates and entry counts before reporting complete offline readiness. Explicit user download is required; partial packs survive interruption, and the old English pack is reused. Keep data cache `kotoba-dictionary-data-v1` for migration. Dictionary-only service-worker scope must not intercept auth, study records or Qwen. Remove only dictionary caches; keep an independent offline dictionary URL. Each browser downloads separately and may evict storage. Keep source text escaped in rendering. Do not claim whole-app offline access.

During the existing weekly maintenance, refresh if JMdict is 28 days old or older (EDRDG requests at least monthly). Obtain all replacement sources first; retain the complete working five-pack snapshot if any source is unavailable. Download official `JMdict_e.gz`, Tomoshi's latest open DB zstd release, and Kaikki Chinese raw JSONL gzip into scratch. Inspect upstream licence changes and dump dates. Decompress multi-frame zstd with `ZstdDecompressor().stream_reader(..., read_across_frames=True)` and require SQLite `PRAGMA quick_check` to return `ok`. Run `python3 build_dictionary.py <JMdict_e.gz>`, then `python3 build_multilingual_dictionary.py --tomoshi <open.db> --wiktionary <raw.jsonl.gz> --wiki-date <dump-date>`. Then obtain Kanjium `data/source_files/raw/accents.txt`, official
`JMdict_e_examp.gz`, and Tatoeba `jpn_sentences_detailed.tsv.bz2`,
`eng_sentences_detailed.tsv.bz2`, `cmn_sentences_detailed.tsv.bz2`,
`jpn-eng_links.tsv.bz2` and `jpn-cmn_links.tsv.bz2` from
`https://downloads.tatoeba.org/exports/per_language/` (under jpn/eng/cmn).
Run `python3 build_dictionary_enrichment.py --kanjium <accents.txt> --wiktionary <same-raw.jsonl.gz> --jmdict-examples <JMdict_e_examp.gz> --tatoeba <export-folder> --date <retrieval-date> --tatoeba-date <export-date>`.
Use the identical Wiktionary snapshot used for the definition import. These three
scripts are an atomic workflow: never publish an intermediate manifest with
missing supplements. Keep the working commit available if an input/build fails. Update snapshot-specific licence notices. Refresh the shell cache identifier when data or dictionary code changes, retaining old data until new packs verify.

Run `node test_dictionary.mjs`, `node test_dictionary_ui.mjs` (jsdom via `JSDOM_MODULE`), `python3 test_dictionary_enrichment.py`, and the core/DOM tests before the normal Sites + GitHub publication. Tests cover corpus associations, heteronyms, source labels, Chinese/English reverse lookup, escaped rendering, old-pack reuse, partial/corrupt downloads, offline reopening, accent/example source alignment, pitch graphs, direct Chinese translations, per-sentence attribution and scoped cache deletion. Delete obsolete tracked dictionary packs only after a successful rebuild. No new automation is required. If a source cannot be obtained, keep the last working data and report its date.

## Course state after 2026-10-18 maintenance

The course now has 14 lessons (630 words / 70 independent kanji). The next batch begins at lesson 15 and joyo-071. `build_course.py` retains the original builder and calls `extend_course.py` for the second block; extend this append layer for future batches rather than resetting to seven lessons. Preserve all existing source records, not only IDs. `LESSONS.md` is the current index. Run core/app tests plus `test_weekly.mjs` and `test_weekly_dom.mjs` (jsdom) after additions; extend the weekly test's expected totals for the next batch, preserving historical compatibility assertions. `KOTOBA_PREVIOUS_COURSE` may point to a clean pre-update lesson file for deep equality and realistic synthetic progress migration checks. This file is public course content, never a user's exported progress.

Audio for days 8–14 was added without replacing days 1–7. `audio-tools/install_weekly_audio.py` is intentionally specific to this batch and rejects replacing installed sprite metadata. Use new names for future batches. Full input hashes in provenance refer to the generation-time input, not the audio-embedded final course JSON. `source-data/week02-audio-audit.json` retains every clip's exact displayed text, actual synthesis input and waveform checks. Voice speed/metadata changes must not silently overwrite an installed sprite. No real authenticated progress or paid model was accessed.
