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
