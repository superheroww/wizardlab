export interface SocialEngageRow {
  id: string;
  created_at: string | null;
  platform: string | null;
  permalink: string | null;
  author_handle: string | null;
  channel: string | null;
  title: string | null;
  body: string | null;
  source: string | null;
  should_reply: boolean | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  reply_text: string | null;
  status: string | null;
  posted_at: string | null;
  ai_parse_ok: boolean | null;
  ai_reply_draft: string | null;
}

export const SELECT_FIELDS = [
  "id",
  "created_at",
  "platform",
  "permalink",
  "author_handle",
  "channel",
  "title",
  "body",
  "source",
  "should_reply",
  "relevance_score",
  "relevance_reason",
  "reply_text",
  "status",
  "posted_at",
  "ai_parse_ok",
  "ai_reply_draft",
].join(",");
