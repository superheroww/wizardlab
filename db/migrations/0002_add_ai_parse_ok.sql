-- Migration: track whether the AI enrichment parsed/validated the response successfully.

ALTER TABLE public.social_engage
  ADD COLUMN IF NOT EXISTS ai_parse_ok boolean;
