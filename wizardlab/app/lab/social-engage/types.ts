export const SELECT_FIELDS = `
  id,
  created_at,
  platform,
  external_post_id,
  external_comment_id,
  permalink,
  author_handle,
  channel,
  title,
  body,
  status,
  source,
  relevance_score,
  ai_should_reply,
  ai_reply_draft,
  ai_category,
  ai_priority,
  ai_reason,
  reply_text,
  posted_at,
  posted_by
`;

export type SocialEngageRow = {
  id: string;
  created_at: string;
  platform: string;
  external_post_id: string | null;
  external_comment_id: string | null;
  permalink: string;
  author_handle: string | null;
  channel: string | null;
  title: string | null;
  body: string | null;
  status: string;
  source: string | null;
  relevance_score: number | null;
  ai_should_reply: boolean | null;
  ai_reply_draft: string | null;
  ai_category: string | null;
  ai_priority: string | null;
  ai_reason: string | null;
  reply_text: string | null;
  posted_at: string | null;
  posted_by: string | null;
};
