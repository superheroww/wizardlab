# wizardlab

This repo is the backend and tooling home for wizardLab, a Next.js App Router + Supabase toolbox that automates engagement across platforms like Reddit, TikTok, X, and YouTube using AI-powered micro-agents.

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
- **Classifier layer** ingests incoming platform context (title, body, permalink, platform) and feeds a reusable prompt into the shared OpenAI client to decide whether to reply, capturing `{ should_reply, confidence, reason }`.
- **Reply generator layer** reuses the same client with a reply prompt plus the same context to return a short, human-sounding response that stays calm and neutral.
- **social_engage table** stores every candidate plus metadata: classifier decision, reply text/model, workflow status (`pending`, `ignored`, `approved`, `posted`), posting timestamps, source, and raw payloads for diagnostics.
- **Scripts** under `scripts/` (`testClassifier.ts`, `testReply.ts`) let you run the classifier and reply pipelines locally against the shared OpenAI client before wiring them into any automations.

## Endpoints
- `/`: The only Next.js route today renders the placeholder landing page; no additional API routes exist yet.
- Tooling currently runs via scripts and imports, not HTTP handlers. When automations call into the classifier/reply helpers, they should import `tools/reddit/classifier/classify.ts` and `tools/reddit/reply/generateReply.ts` directly.
