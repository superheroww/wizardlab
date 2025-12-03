# WizardLab

WizardLab is an internal Next.js (App Router) + Supabase experiment that helps the WizardFolio team monitor Reddit conversations and semi-automate AI-generated replies. The project centers around a `social_engage` dashboard that lists posts, previews drafts, and lets operators quickly copy/post responses.

## Developmen

```bash
npm install
npm run dev
```

App router pages live under `app/`, API routes under `app/api`, and shared logic is inside `lib/` and `tools/`.

### Env requirements

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- (Optional) `SOCIAL_INGEST_BATCH_SIZE` affects the enrichment cron batching.

## Key workflows

### Social Engage dashboard

Located at `app/admin/social-metrics/components/SocialEngageTable.tsx`, this client component:

- Lists Reddit rows with filters, sorting, and statuses.
- Shows AI replies in a modal and copies text to the clipboard.
- Adds a **Post** button for rows with `status = "ready"` so operators can:
  1. Copy the AI-generated reply.
  2. Open the Reddit permalink in a new tab.
  3. Hit `POST` to persist `status = "posted"`/`posted_at` via the new `/api/social/mark-posted` route.

The modal footer and mobile cards share the same behavior to keep the UI consistent.

### API route

- `POST /api/social/mark-posted` (App Router handler)
  - Accepts `{ id }` in the JSON body.
  - Updates the corresponding `social_engage` row with `status = "posted"`, `posted_at`, `posted_by = "lab-dashboard"`, and `updated_at`.
  - Returns `{ success: true }` or `{ error }` on failure.

Use this endpoint only from the internal dashboard — no auth is enforced yet.

### Enrichment pipeline

`lib/socialIngest/enrich.ts` powers the cron that hydrates Reddit rows and routes them through OpenAI:

- Selects pending Reddit rows (`status = "pending"`) from `social_engage`.
- Hydrates the body when available (via `row.extra.hydrated.full_body`) and falls back to `body` or `title`.
- Saves the exact text fed to OpenAI into `ai_input` before constructing the prompt.
- Passes that same text into `analyzeForReply`, so stored `ai_input` mirrors what the model saw.
- Persists the resulting decision (`ai_reply_draft`, `ai_should_reply`, etc.) without touching cron logic or the schema.

This makes auditing easier because each row records the precise classifier input while keeping `ai_parse_ok` behavior untouched.

## Testing

- `npm run lint`

Automated tests are not included yet.
