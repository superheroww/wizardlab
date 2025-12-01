-- wizardLab Supabase schema snapshot
-- Run `npm run db:schema:pull` to refresh this file with the latest public schema.
-- Once the CLI can access Supabase, replace the contents below with the actual dump.

-- schema pending Supabase access

create index if not exists social_engage_platform_permalink_idx
  on public.social_engage (platform, permalink);
