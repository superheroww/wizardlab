# wizardlab

This repo is the backend and tooling home for wizardLab, a Next.js App Router + Supabase toolbox that automates engagement across platforms like Reddit, TikTok, X, and YouTube using AI-powered micro-agents. The AI system is composed of data ingestion hooks, classifier logic, and reply generation helpers that together decide which items to reply to and what to say while keeping Supabase as the durable source of truth.

## Quick start
1. Copy `.env.local.example` to `.env.local` and fill in the Supabase and OpenAI keys/models (`OPENAI_API_KEY`, `OPENAI_MODEL_CLASSIFIER`, `OPENAI_MODEL_REPLY`).
2. Run `npm install`.
3. Use `npm run test:classifier` and `npm run test:reply` to exercise the shared OpenAI client with the classifier and reply flows.

## Project structure highlights
- `app/`: Next.js entry points (UI not modified by these tasks).
- `tools/`: Modular tooling per platform (classifier + reply helpers currently under `tools/reddit`).
- `prompts/`: Reusable prompt text for the classifier and reply generator.
- `scripts/`: Local test runners (`testClassifier.ts` and `testReply.ts`) that hit the shared OpenAI client.
- `db/`: Schema references.

## Database schema references
- `db/tables_schema.sql`: Manual snapshot of critical tables like `social_engage`; update it by hand whenever those definitions change.

## Business logic overview
- **AI ingestion pipeline** accepts canonical URLs (currently from Gmail → F5Bot) and resolves the remote post metadata before persisting it so the AI can reason over the latest title/body/permalink.
- **Classifier layer** ingests that platform context (title, body, permalink, platform) along with the shared prompts and feeds the OpenAI client to decide whether to reply, capturing `{ should_reply, confidence, reason }`.
- **Reply generator layer** reuses the same client with a reply prompt plus the same context to craft a short, calm response that matches our tone guardrails.
- **social_engage table** stores each candidate plus metadata: classifier decision, reply text/model, workflow status (`pending`, `ignored`, `approved`, `posted`), posting timestamps, source, and raw payloads for diagnostics.
- **Automation scripts** under `scripts/` (`testClassifier.ts`, `testReply.ts`) let you exercise the classifier and reply pipelines locally before wiring them into automated flows.

## Endpoints
- `/`: The only Next.js route today renders the placeholder landing page; no additional API routes exist yet.
- Tooling currently runs via scripts and imports, not HTTP handlers. When automations call into the classifier/reply helpers, they should import `tools/reddit/classifier/classify.ts` and `tools/reddit/reply/generateReply.ts` directly.
