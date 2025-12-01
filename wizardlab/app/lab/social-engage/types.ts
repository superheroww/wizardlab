export interface SocialEngageRow {
  id: string;
  created_at: string | null;
  platform: string | null;
  permalink: string | null;
  title: string | null;
  body: string | null;
  source: string | null;
  should_reply: boolean | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  reply_text: string | null;
  status: string | null;
  posted_at: string | null;
}

export const SELECT_FIELDS = [
  "id",
  "created_at",
  "platform",
  "permalink",
  "title",
  "body",
  "source",
  "should_reply",
  "relevance_score",
  "relevance_reason",
  "reply_text",
  "status",
  "posted_at",
].join(",");
