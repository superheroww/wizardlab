-- Migration: add columns that hold structured AI analysis metadata for social_engage rows.
-- Keep these columns nullable so existing rows remain valid until the consumer backfills them.

ALTER TABLE public.social_engage
  ADD COLUMN IF NOT EXISTS ai_result jsonb;

ALTER TABLE public.social_engage
  ADD COLUMN IF NOT EXISTS ai_should_reply boolean;

ALTER TABLE public.social_engage
  ADD COLUMN IF NOT EXISTS ai_reply_draft text;

ALTER TABLE public.social_engage
  ADD COLUMN IF NOT EXISTS ai_topic text;
