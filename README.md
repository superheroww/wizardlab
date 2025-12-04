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

## Business logic

1. **Ingestion → `social_engage` (status = `pending`):**
   - `POST /api/social/ingest` accepts `{ platform, permalink/url, source, extra }`.
   - `normalizeSocialIngestPayload` validates input and pushes any unknown fields into the `extra` JSON column.
   - Reddit permalinks are canonicalized (trailing slash, stripped query/hash) and hard-filtered for duplicates so we only track one row per post at a time.
   - Successful inserts write into Supabase `social_engage` with `status = "pending"` and capture the provided metadata for later audits.

2. **Enrichment & dedupe (cron) → `status = ready | ignored | duplicate_semantic | error`:**
   - `enrichPendingSocialIngest` (called via `/api/social/cron`) fetches pending Reddit rows in FIFO batches.
   - Each row is hydrated via `resolveRedditPostFromUrl`, including HTML, author, subreddit, karma, and image URLs; all metadata is appended back into `extra`.
   - `extractImageTextForPost` runs OCR on discovered screenshots, merges that text with the hydrated body/title, and stores the exact final string in `ai_input`.
   - The same merged text is sent to OpenAI through `analyzeForReply`, which uses `wizardlab/prompts/aiReplyDecision.ts` to produce JSON fields (`should_reply`, `reply_draft`, `risk_flags`, etc.).
   - Before AI runs, the pipeline computes an embedding (`computeEmbedding`) and looks for semantic duplicates for the same author; confirmed matches are marked `duplicate_semantic` with metadata that points to the existing row.
   - After AI returns, the row is updated to `ready` when `should_reply=true`, or `ignored` otherwise; the structured AI payload is persisted (`ai_result`, `ai_reply_draft`, `ai_reason`, `ai_category`, `ai_priority`, `ai_metadata`) so the dashboard can show the whole reasoning trail. Failures capture the error text and flip the row to `error`.

3. **Manual review & posting:**
   - The Social Engage dashboard surfaces `ready` rows, shows the AI reasoning/draft, and exposes the “Post” CTA that copies the draft and opens the permalink.
   - Operators can also regenerate a fresh reply locally by calling `generateRedditReply` (`wizardlab/tools/reddit/reply/generateReply.ts`), which sends the same WizardLab system identity plus the Reddit post data to OpenAI.

4. **Posting + auditing:**
   - After a human pastes the reply into Reddit, the UI fires `POST /api/social/mark-posted` so Supabase records `status = "posted"`, `posted_at`, and `posted_by`.
   - Every step (ingest, enrich, OCR, AI, dedupe, post) logs via `logIngestInfo`/`logIngestError` so we can reconstruct failures in Supabase or server logs.

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

## API endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/social/ingest` | Entry point for external scrapers/webhooks. Validates and canonicalizes Reddit submissions, rejects duplicates, and inserts `social_engage` rows with `status="pending"`. Returns `{ status: "queued" }` or `{ status: "duplicate_exact" }`. |
| `GET`/`POST` | `/api/social/cron` | Lightweight trigger the scheduler/cron (e.g., Vercel cron job). Runs `enrichPendingSocialIngest()` once and responds with `{ processed: <count> }`. |
| `POST` | `/api/social/mark-posted` | Called only from the dashboard once a human pasted the reply to Reddit. Body: `{ id: <social_engage id> }`. Marks the row as posted and records metadata. |
| `GET` | `/api/debug/db` | Auth-less Supabase smoke test that fetches up to 20 rows from `positions`. Useful during bring-up to ensure server-side Supabase credentials are wired. |

All routes are App Router handlers, default to `dynamic = "force-dynamic"`, and rely on the Supabase service role unless otherwise noted.

## Testing & tooling

- `npm run lint` (ESLint).
- The `tools/reddit` helpers expose the shared OpenAI client plus classification/reply helpers (`analyzeForReply`, reply drafts, etc.).
- `scripts/` contains ad-hoc runners such as `testReply.ts` that hit the OpenAI clients locally when you need to debug prompts before enabling automation.
