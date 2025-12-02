import { openai, MODELS } from "@/tools/utils/openai";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BATCH_SIZE = Number(process.env.SOCIAL_INGEST_BATCH_SIZE ?? "5");
const STATUS_PENDING = "pending";
const STATUS_READY = "ready";
const STATUS_UNRESOLVABLE = "unresolvable";
type ExtraPayload = Record<string, unknown> | null;

interface SocialEngageRow {
  id: string;
  platform: string | null;
  permalink: string | null;
  title: string | null;
  body: string | null;
  status: string | null;
  source: string | null;
  extra: ExtraPayload;
}

type AiRedditPost = {
  title: string;
  post_text: string;
  url: string;
  subreddit?: string | null;
  author?: string | null;
  created_at?: string | null;
  note?: string | null;
};

export async function enrichPendingSocialIngest(): Promise<number> {
  const rows = await fetchPendingRedditRows();
  if (rows.length === 0) {
    return 0;
  }

  for (const row of rows) {
    await processRow(row);
  }

  return rows.length;
}

async function fetchPendingRedditRows(): Promise<SocialEngageRow[]> {
  const { data, error } = await supabaseAdmin
    .from("social_engage")
    .select("id, platform, permalink, title, body, status, source, extra")
    .eq("platform", "reddit")
    .eq("status", STATUS_PENDING)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    throw new Error(`Failed to fetch pending reddit rows: ${error.message}`);
  }

  return (data ?? []) as SocialEngageRow[];
}

async function processRow(row: SocialEngageRow) {
  const permalink = row.permalink;
  if (!permalink) {
    console.error("social_ingest: missing permalink for reddit row", { id: row.id });
    await markUnresolvable(row, "Missing permalink");
    return;
  }

  try {
    const resolved = await resolveRedditPostWithAI(row, permalink);
    if (!resolved.post_text.trim() && !resolved.title.trim()) {
      await markUnresolvable(row, resolved.note ?? "OpenAI returned no title or post_text");
      return;
    }

    await updateRowWithAiPayload(row, resolved, STATUS_READY);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("social_ingest: failed to enrich Reddit post", {
      id: row.id,
      error: message,
    });
    await addErrorNote(row, message);
  }
}

function buildContext(row: SocialEngageRow) {
  const extra = row.extra ?? {};
  const contextParts: string[] = [];
  if (typeof extra["f5bot_subject"] === "string" && extra["f5bot_subject"].trim()) {
    contextParts.push(`F5Bot subject: ${extra["f5bot_subject"].trim()}`);
  }
  if (typeof extra["f5bot_snippet"] === "string" && extra["f5bot_snippet"].trim()) {
    contextParts.push(`F5Bot snippet: ${extra["f5bot_snippet"].trim()}`);
  }
  return contextParts.length ? contextParts.join("\n") : "No additional context available.";
}

async function resolveRedditPostWithAI(row: SocialEngageRow, permalink: string): Promise<AiRedditPost> {
  const context = buildContext(row);
  const systemMessage =
    "You are an assistant with browser access. Your job is to open the provided Reddit post URL, read the original post, " +
    "and return the post metadata as JSON. Do not include comments or replies.";
  const userMessage = `You are reading a Reddit post.
URL: ${permalink}
${context}
Return a JSON object with the keys:
- title: the human-readable post title.
- post_text: the body text of the original post, no comments.
- url: the canonical URL that you visited.
- subreddit: the subreddit name if available.
- author: the author handle if available.
- created_at: ISO timestamp when the post was created, or an empty string if unknown.
- note: include a short explanation if the post cannot be reached or parsed.
If you cannot access the post, return title and post_text as empty strings and explain why in the note field.`;

  const completion = await openai.chat.completions.create({
    model: MODELS.ingest,
    temperature: 0,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices?.[0]?.message?.content?.toString().trim();
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = parseJsonSafely<AiRedditPost>(raw);
  if (!parsed) {
    throw new Error("Failed to parse JSON from OpenAI response.");
  }

  return {
    title: parsed.title ?? "",
    post_text: parsed.post_text ?? "",
    url: parsed.url ?? permalink,
    subreddit: parsed.subreddit ?? null,
    author: parsed.author ?? null,
    created_at: parsed.created_at ?? null,
    note: parsed.note ?? null,
  };
}

function parseJsonSafely<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function updateRowWithAiPayload(row: SocialEngageRow, payload: AiRedditPost, status: string) {
  const existingExtra = ensureExtraObject(row.extra);
  const aiMetadata = {
    last_run_at: new Date().toISOString(),
    status,
    payload,
  };
  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      title: payload.title || row.title,
      body: payload.post_text || row.body,
      status,
      extra: { ...existingExtra, ai_metadata: aiMetadata },
    })
    .eq("id", row.id);

  if (error) {
    console.error("social_ingest: failed to update enriched Reddit row", {
      id: row.id,
      error: error.message,
    });
  } else {
    console.info("social_ingest: enriched reddit row", {
      id: row.id,
      url: payload.url,
      title: payload.title,
    });
  }
}

async function markUnresolvable(row: SocialEngageRow, reason: string) {
  const existingExtra = ensureExtraObject(row.extra);
  const aiMetadata = {
    last_run_at: new Date().toISOString(),
    status: STATUS_UNRESOLVABLE,
    note: reason,
  };

  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      status: STATUS_UNRESOLVABLE,
      extra: { ...existingExtra, ai_metadata: aiMetadata },
    })
    .eq("id", row.id);

  if (error) {
    console.error("social_ingest: failed to mark reddit row unresolvable", {
      id: row.id,
      error: error.message,
    });
  } else {
    console.info("social_ingest: marked reddit row unresolvable", {
      id: row.id,
      reason,
    });
  }
}

async function addErrorNote(row: SocialEngageRow, note: string) {
  const existingExtra = ensureExtraObject(row.extra);
  const aiMetadata = {
    last_run_at: new Date().toISOString(),
    status: "error",
    note,
  };

  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      extra: { ...existingExtra, ai_metadata: aiMetadata },
    })
    .eq("id", row.id);

  if (error) {
    console.error("social_ingest: failed to record error metadata", {
      id: row.id,
      error: error.message,
    });
  }
}

function ensureExtraObject(value: ExtraPayload): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}
