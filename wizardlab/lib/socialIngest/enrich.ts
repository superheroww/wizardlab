import { supabaseAdmin } from "@/lib/supabase/admin";
import { analyzeForReply, AiReplyDecision } from "@/tools/reddit/reply/analyzeForReply";

const BATCH_SIZE = Number(process.env.SOCIAL_INGEST_BATCH_SIZE ?? "5");
const STATUS_PENDING = "pending";
const STATUS_READY = "ready";
const STATUS_IGNORED = "ignored";
const STATUS_ERROR = "error";

type ExtraPayload = Record<string, unknown> | null;

interface SocialEngageRow {
  id: string;
  platform: string | null;
  permalink: string | null;
  title: string | null;
  body: string | null;
  ai_input?: string | null;
  status: string | null;
  source: string | null;
  extra: ExtraPayload;
  ai_parse_ok?: boolean | null;
}

type AiDecision = AiReplyDecision;

const SYSTEM_MESSAGE = `
You are an assistant helping a small fintech product (WizardFolio) decide whether to reply to Reddit content and how to reply when it makes sense.

- The product: WizardFolio = a free ETF look-through and portfolio visualization tool.
- Audience: retail investors (beginners or intermediates) asking about portfolios, ETFs, asset allocation, and underlying exposure.

Your job:
1. Understand what the Reddit author is asking or talking about.
2. Decide if WizardFolio should reply.
3. If yes, draft a SHORT (2–4 sentence), friendly, non-pushy reply that mentions WizardFolio as a resource when natural.

Important rules:
- Do NOT give personalized financial advice (“you should buy/sell”, specific allocations, etc.).
- Avoid politics, off-topic chatter, insults, or spammy language.
- Tone: kind, concise, and helpful with no emojis.
- Respect subreddit norms and reply only when WizardFolio is a natural fit.
- If the post is not about portfolios, ETFs, or an underlying holdings question, do NOT reply.

Respond ONLY with valid JSON matching the requested schema.
`.trim();

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
    .select("id, platform, permalink, title, body, status, source, extra, ai_input")
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
    await markRowError(row, "Missing permalink");
    return;
  }

  const hasSnippet = Boolean(readExtraString(row.extra, "f5bot_snippet"));
  const hasTitle = Boolean(row.title?.trim());
  const hasBody = Boolean(row.body?.trim());
  if (!hasSnippet && !hasTitle && !hasBody) {
    console.error("social_ingest: no text available for AI analysis", { id: row.id });
    await markRowError(row, "Missing post text for AI analysis");
    return;
  }

  const hydratedBody = (
    (row.extra as { hydrated?: { full_body?: string } } | null)?.hydrated
  )?.full_body;
  const fallback = (row.body || row.title || "").trim();
  const finalInput = (hydratedBody?.trim() || fallback);

  const { error: inputError } = await supabaseAdmin
    .from("social_engage")
    .update({
      ai_input: finalInput,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (inputError) {
    console.error("social_ingest: failed to persist ai_input", {
      id: row.id,
      error: inputError.message,
    });
  }

  try {
    const aiDecision = await analyzeRowForReply(row, finalInput);
    await updateRowWithAiDecision(row, aiDecision);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`social_ingest: AI error for row ${row.id}: ${message}`);
    await markRowError(row, message);
  }
}

async function analyzeRowForReply(
  row: SocialEngageRow,
  finalInput: string
): Promise<AiDecision> {
  const snippet = trimSnippet(
    readExtraString(row.extra, "f5bot_snippet"),
    1024
  );
  const subject = readExtraString(row.extra, "f5bot_subject");

  try {
    const aiDecision = await analyzeForReply({
      postTitle: row.title,
      postBody: finalInput,
      url: row.permalink ?? "",
      subject,
      snippet,
    });
    return aiDecision;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to analyze row with AI: ${message}`);
  }
}

async function updateRowWithAiDecision(row: SocialEngageRow, decision: AiDecision) {
  const status = decision.should_reply ? STATUS_READY : STATUS_IGNORED;
  const existingExtra = ensureExtraObject(row.extra);
  const metadata = {
    last_run_at: new Date().toISOString(),
    status,
    reason: decision.reason,
    priority: decision.priority,
    category: decision.category,
  };

  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      status,
      ai_result: decision,
      ai_should_reply: decision.should_reply,
      ai_reply_draft: decision.reply_draft,
      ai_category: decision.category,
      ai_priority: decision.priority,
      ai_reason: decision.reason,
      ai_parse_ok: true,
      extra: { ...existingExtra, ai_metadata: metadata },
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) {
    console.error("social_ingest: failed to persist AI decision", {
      id: row.id,
      error: error.message,
    });
  } else {
    console.info(`social_ingest: ai decision row ${row.id} status=${status}`);
  }
}

async function markRowError(row: SocialEngageRow, note: string) {
  const existingExtra = ensureExtraObject(row.extra);
  const metadata = {
    last_run_at: new Date().toISOString(),
    status: STATUS_ERROR,
    note,
  };

  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      status: STATUS_ERROR,
      ai_result: { error: "invalid JSON", raw: note },
      ai_parse_ok: false,
      extra: { ...existingExtra, ai_metadata: metadata },
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) {
    console.error("social_ingest: failed to mark reddit row error", {
      id: row.id,
      error: error.message,
    });
  }
}

function trimSnippet(value: string | null, maxLength: number): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength).trim()}...`;
}

function readExtraString(extra: ExtraPayload, key: string): string | null {
  if (!extra || typeof extra !== "object") {
    return null;
  }
  const value = extra[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function ensureExtraObject(value: ExtraPayload): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}
