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

The user has authorized Supabase cloud sync. On 2026-10-13 the frontend was configured for user-owned project `mtszdktdpjipjvbspetr` with its public publishable key. The user has deployed the initial Qwen function; read-only checks confirm it responds and rejects unauthenticated calls. The progress table exists and denies anonymous reads. Actual authenticated cross-device sync and real-key model calls remain unverified. Preserve `dist/cloud-config.json` / `kotoba/cloud-config.json`, the Supabase migration history, per-item merge records, unique practice event IDs, account allowlist, RLS and server-side authorization. Never write private credentials into the public repository. Cloud events are not automatically accessible to background ChatGPT tasks: no private database access has been provisioned for unattended personal analysis. Do not invent user performance, assume a lesson was studied, or infer progress from deployment. Charts calculate actual local/merged events. Follow SUPABASE-SETUP.md for connection details; the default network-search path uses the ordinary Responses API. On 2026-10-13 the user explicitly requested a technical test with the existing Token Plan key. The backend now removes subscription-prefix/domain rejection and automatically uses Anthropic Messages for `/apps/anthropic` endpoints. That path currently supports plain Q&A only, requires search to be unchecked, and preserves login/member/quota/endpoint checks. Do not undo this user-requested compatibility path during scheduled maintenance. Do not claim real-key success until observed, spoof a provider client identity, or automatically retry a provider permission rejection. Do not invoke paid models during scheduled course maintenance.

The daily reminder is separately scheduled for 12:40 Asia/Shanghai. Do not create duplicate reminders. Weekly maintenance summaries should report exactly which lessons were added, quality gaps, tests, and verified publication status; not fictional personal learning reports.

Cloud changes require `node test_cloud.mjs` and `node test_endpoint.mjs` in addition to core and DOM tests. Database changes require the embedded PostgreSQL/RLS tests or a real isolated database test; never test destructive operations on the user’s live project. Frontend/vendor files must be mirrored, and `supabase/` plus setup/test source files live under `kotoba-source/`.
