# WizardLab

WizardLab is the internal Next.js (App Router) + Supabase workspace powering semi-automated AI replies to Reddit threads and other social platforms. The repo mixes UI tooling, cron jobs, and OpenAI helpers so operators can triage incoming posts, inspect AI drafts, and launch replies with a single click.

## Quick start

1. Copy `.env.local.example` to `.env.local` and populate the Supabase and OpenAI credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, etc.).
2. Install dependencies: `npm install`.
3. Run the dev server: `npm run dev`.

Project sources live under `wizardlab/app/` (UI + API routes), `wizardlab/lib/` (enrichment + helpers), and `wizardlab/tools/` (reusable OpenAI tooling for Reddit and friends).

## Key environment variables

- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: needed for both web UI and enrichment cron jobs.
- `OPENAI_API_KEY`, `OPENAI_MODEL_CLASSIFIER`, `OPENAI_MODEL_REPLY`: drive the classifier + reply prompts.
- `SOCIAL_INGEST_BATCH_SIZE` (optional): controls how many pending rows the enrichment cron process each run.

## Core flows

### Social Engage dashboard (`wizardlab/app/admin/social-metrics/components/SocialEngageTable.tsx`)

- Displays rows fetched via `SELECT_FIELDS` from `wizardlab/app/admin/social-metrics/types.ts`.
- Shows AI replies inside a modal, with filters, sorting, and status badges.
- New **Post** action for rows marked `ready` that: (1) copies the AI reply, (2) opens the Reddit permalink, and (3) hits `POST /api/social/mark-posted` so the row switches to `posted` and records `posted_at` + `posted_by`.
- The same handler is wired to desktop/mobile UIs and the modal footer so operators always get clipboard + permalink prep before the human paste/send step.

### Mark-posted API (`wizardlab/app/api/social/mark-posted/route.ts`)

- Accepts `{ id }` via `POST` and updates the matching `social_engage` row:
  - `status = "posted"`
  - `posted_at` & `updated_at` = `now()`
  - `posted_by = "lab-dashboard"`
- Returns `{ success: true }` on success, otherwise `{ error }`.
- Internal use only; no auth is enforced yet.

### Enrichment pipeline (`wizardlab/lib/socialIngest/enrich.ts`)

- Pulls pending Reddit rows and hydrates bodies via `row.extra.hydrated.full_body` when available.
- Builds `finalInput` as that hydrated body (or the trimmed title/body fallback), writes it to `ai_input`, and reuses the same string in the OpenAI prompt so audits can see the exact text the classifier read.
- Persists the classifier decision (`ai_reply_draft`, `ai_should_reply`, `ai_parse_ok`, etc.) without changing cron cadence or schema fields.

## Testing & tooling

- `npm run lint` (ESLint).
- The `tools/reddit` helpers expose the shared OpenAI client plus classification/reply helpers (`analyzeForReply`, reply drafts, etc.).
- `scripts/` contains ad-hoc runners such as `testClassifier.ts` and `testReply.ts` that hit the OpenAI clients locally when you need to debug prompts before enabling automation.
