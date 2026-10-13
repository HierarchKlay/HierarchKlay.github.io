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
