## 2026-10-23 · Early October 25 edition, lessons 15–21

- Added 245 core words + 70 unique reserve words, 315 original ruby examples/translations, and 35 independent kanji (映–王). Totals: 21 lessons, 945 vocabulary entries and 105 kanji; course ID stays `week01-v1`.
- Checked new spellings, readings and selected senses against the retained official JMdict snapshot; checked both normalized headwords and dictionary-entry/reading identities against the previous 630 words. All 70 new kanji example pairs have JMdict evidence and official-table reading records.
- 284/315 new words have exact unconditional Kanjium numeric pitch records with variants retained; 31 remain unavailable. Extended the adjacent kanji-example pitch bundle to 242 unique pairs (235 with numeric records).
- Added day-15 through day-21 audio sprites: 630 clips with NIT ATR503 M001 1.05 / Open JTalk, CC BY 3.0. One word and four sentences use checked kana inputs for ambiguous text. Corrected the authored reading of 何か in the 楽器 example to なにか before final synthesis. Kept all earlier sprite bytes and offsets.
- Added an input-hash guard to the batch installer, retained every clip's reading/waveform audit, and rebuilt font subsets. Extended course/media/DOM tests through lesson 21 and preserved historical deep-equality/progress-migration checks.
- Recorded the fulfilled 2026-10-25 edition in `source-data/course-releases.json`; the scheduled October 25 run must not append again. Next regular edition is November 1, beginning at lesson 22 / joyo-106.
- Verification includes source, data, logic, DOM, media and desktop-browser course/kanji checks. Examples have not been reviewed by a native-speaker teacher, synthesized clips have not been individually listened to, and mobile hardware was not tested. Dictionary snapshot, personal homepage, cloud configuration, Site audience and private learning records are preserved.

## 2026-10-19 · Pitch accents beside kanji example readings

- Show whole-word pitch numbers beside the kana of kanji-notebook examples, preserving alternative patterns and marking missing records. 165 of the current 172 distinct example pairs have numeric records.
- Bundle a small exact-match subset of the existing Kanjium/Wiktionary pitch snapshot with the study page; no dictionary download is needed to see the numbers. Clicking a number opens the dictionary for that word.
- Include the same labels in revealed kanji exercise answers and lesson printing. Adjust narrow-card rows to keep kana and pitch together with the meaning below.
- Preserve the course JSON, IDs, audio and progress. Regenerate the subset during course builds and after dictionary pitch refreshes.

## 2026-10-18 · Lessons 8–14

- Added 245 core words + 70 unique reserve words, 315 original ruby examples/translations and 35 independent kanji (慰–英). Totals: 14 lessons, 630 vocabulary entries and 70 kanji. IDs and original first-seven lessons unchanged; course ID remains `week01-v1`.
- Existing 315 headword/readings match the retained official JMdict snapshot. New 315 records include exact entry IDs, selected sense indices and gloss evidence; all 35 kanji follow the official table's readings and order. Homophones such as 花/鼻 are distinct lexemes, not duplicate entries.
- 289/315 new words have exact unconditional Kanjium pitch matches with variants retained. 26 remain unavailable. Chinese meanings, examples and translations have not received independent native-speaker review; auxiliary pitch data is not a commercial dictionary or a synthesis-derived claim.
- Added seven licensed NIT ATR503 M001 1.05 / Open JTalk sprites: 630 new clips, 9,140,573 bytes. All generated words/sentences pass frontend reading checks and decoded non-silence checks; two word and nine sentence inputs use kana to resolve ambiguous readings. All old files and offsets are unchanged. No human listening audit claimed.
- Added append-only source integration, generation audit, lesson index, corpus/media/progress migration checks and new-lesson DOM checks. Generalized core tests to multiple weekly batches. Rebuilt Japanese/Chinese font subsets. Day 1 PDF is unchanged.
- Existing five-pack dictionary snapshot retained (JMdict/pitch/examples 2026-10-13; Wiktionary 2026-10-01); monthly refresh not yet due. Preserved cloud configuration, auth, tutor, offline cache scope and Site audience; no private progress was read.
- Verification scope: automated data, logic, DOM and media checks. Browser visual/mobile and real-device audio playback are not verified in this environment.

## 2026-10-13 · Dictionary pitch accents and examples

- Added separate offline supplements: 102,317 entries with source-labelled pitch data and 31,900 sense-linked example groups across 28,574 entries; 1,253 groups include directly linked Chinese translations.
- Kanjium and Wiktionary accents retain alternatives/conditions and use mora-based high/low diagrams. Uncertain numeric conversions retain the original source notation.
- Official JMdict example associations are matched to current senses; current Tatoeba text, authors, sentence IDs and direct translations are preserved. First two examples per sense and existing Wiktionary examples are visible without expansion.
- Three existing gloss packs remain byte-identical. Existing installations download only the two additions (4.5 MB), with verified hashes and resumable partial downloads.
- Added distinct CC BY 2.0 FR sentence attribution alongside CC BY-SA 4.0 dictionary/association attribution. No generated pronunciations/translations, recordings or commercial app data added.

## 2026-10-13 · Offline Japanese / Chinese / English dictionary

- Added licensed Tomoshi Chinese glosses and Chinese Wiktionary Japanese entries alongside the unchanged official JMdict English pack (about 20.2 MB total).
- Added explicit Japanese / Chinese-definition / English-definition search, responsive bilingual sense comparison, independent Wiktionary senses and per-result provenance. Tomoshi is always labelled AI-assisted.
- Verified entry/sense associations; uncertain matches stay separate or show missing content. Original usage labels, restrictions and simplified/traditional wording remain visible.
- Three individually verified downloadable packs reuse an existing English installation and resume interrupted downloads. Updated dictionary-only offline shell and embedded upgrade handling.
- Added full-corpus association/search tests, corruption/resume/offline tests and trilingual UI tests. Source scripts, licences and maintenance instructions included.

## 2026-10-13 · Offline JMdict lookup

- Embedded dictionary dialog and word-card lookup link, with an independent offline URL.
- Official JMdict English snapshot, complete download, hash validation, device-local search in a worker, kana normalization and ranked exact/prefix/contains results.
- Dictionary-only service-worker scope and explicit offline/cache status; no changes to study progress or cloud authorization.
- Clear language/source/licence labels and optional external Monokakido Japanese–Chinese app link.

## 2026-10-13 · Mobile login diagnostics

- Replaced the blanket incorrect-email/password error with distinct network, credential, confirmation, rate-limit, storage and server explanations plus safe structured diagnostics.
- Added a password visibility control, mobile keyboard hints and readable input sizing. Preserve the exact password (including spaces) on failed attempts; clear it on successful login or account change. Prevent duplicate form requests.
- The mobile failure is not yet reproduced with the user’s session. Existing desktop sessions do not prove a newly entered password works. Auth UI tests use a mock client; no live account/password was accessed or changed.

## 2026-10-13 · Sync diagnostics

- Investigated the user's generic sync-failed message. Live unauthenticated probes confirm the progress table and merge RPC exist and reject anonymous access; the authenticated failure is not yet observed.
- Preserve HTTP status and database error codes, map common failures to actionable messages, and add expandable redacted diagnostics. Keep raw row details, permission hints and credentials out of the UI.
- Reject malformed cloud replies before applying them, clear diagnostics after a successful retry, and ignore errors from a signed-out session.
- Added real-course PostgreSQL roundtrip and signed-in DOM checks for failed-sync retention, retry and malformed responses. No production database/permission changes or Edge Function redeployment are needed for this frontend update.

## 2026-10-13 · Tutor search, Markdown and presets

- User confirmed real Token Plan plain Q&A works. Actual native web search remains pending user-side verification after redeploy.
- Added provider-documented Anthropic search tool configuration (up to 3 uses), structured sources and distinct success / partial / failed / unconfirmed / not-triggered states.
- Added locally hosted Marked 18.1.1 and DOMPurify 3.4.17 with licenses; answers render headings, lists and responsive tables while blocking scripts, remote images and unsafe links.
- Expanded the server-side Japanese tutor prompt with Chinese explanations, common orthography, example readings/translations and evidence requirements; added comparison, grammar and correction modes.
- Core, app, cloud, mocked endpoint and DOM-based Markdown/search-evidence checks pass. Browser layout and real search credentials are not available in this environment.

## 2026-10-13 · Anthropic compatibility test

- At the user's explicit request, removed application-level subscription key/domain rejection.
- Automatically route `/apps/anthropic` to Messages and preserve the existing Responses/search path for OpenAI-compatible URLs.
- First Anthropic test supports plain text Q&A and conversation/card context; requires web search to be unchecked. No client impersonation or permission-rejection retries.
- Retained user authentication, member allowlist, daily quotas, and secret isolation; reject credential-bearing URLs and redirects. Provider errors expose HTTP status without raw diagnostic bodies.
- Mock endpoint tests pass for both protocols, search labeling, error handling, and auth/quota enforcement. No real model key was received or invoked. Supabase must be redeployed by its owner.

## 2026-10-13 · User Supabase project configuration

- Configured the public project URL and publishable key supplied by the user.
- Verified Auth settings respond successfully. The progress table and Qwen function were not yet present; live sync and model calls remain pending user-side initialization.
- Updated the setup guide with this project's deployment command. No administrative/model secrets were received or committed.

## 2026-10-13 · v0.5 cloud integration preparation

- Added Supabase email/password sign-in and per-item offline progress merging; practice event IDs deduplicate copied backups and retries.
- Added a footer Japanese tutor with optional card context, web search, source links and follow-up questions.
- Added RLS/member allowlist, atomic merge RPC, server-only Qwen proxy and daily request cap. Model is qwen3.8-max via ordinary Responses API; Coding Plan credentials are rejected.
- Configuration remains blank pending the user’s Supabase project and ordinary model API credentials. No real cloud/account/provider call has been verified.
- Added setup guide and merge, PostgreSQL/RLS and mocked endpoint tests.

# Changes

## 2026-10-13 · 0.4

- Independent 5-kanji daily curriculum with compound-reading and character-recall practice.
- Due vocabulary tests combine previous lessons with current learning, plus dedicated overdue queues.
- Separate vocabulary/kanji scheduling at 1, 3, 7, 14, 30, 60 days; early practice does not promote spacing.
- Local learning history, 7-day activity and objective accuracy, review forecast, import/export migration.
- Prerecorded synthesized vocabulary/example audio and clearer missing-accent labels.
- GitHub Pages mirror under the existing personal homepage's `/kotoba/` path.

No historical study dates are fabricated during progress migration.
