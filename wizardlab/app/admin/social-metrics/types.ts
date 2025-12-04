export interface SocialEngageRow {
  id: string;
  created_at: string | null;
  platform: string | null;
  permalink: string | null;
  title: string | null;
  body: string | null;
  source: string | null;
  status: string | null;
  ai_parse_ok: boolean | null;
  ai_reply_draft: string | null;
  ai_priority: string | null;
  ai_reason: string | null;
  ai_category: string | null;
}

export const SELECT_FIELDS = [
  "id",
  "created_at",
  "platform",
  "permalink",
  "title",
  "body",
  "source",
  "status",
  "ai_parse_ok",
  "ai_reply_draft",
  "ai_priority",
  "ai_reason",
  "ai_category",
].join(",");
