import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractImageTextForPost } from "@/lib/social/imageOcr";
import type { RedditPostNormalized } from "@/lib/social/fetchReddit";
import { logIngestError, logIngestInfo } from "@/lib/log/socialLog";
import { NormalizedSocialIngestPayload } from "@/lib/social/normalizeIncoming";
import { resolveRedditPostFromUrl } from "@/tools/reddit/resolveRedditPostFromUrl";
import { analyzeForReply, AiReplyDecision } from "@/tools/reddit/reply/analyzeForReply";
import {
  computeEmbedding,
  findSemanticDuplicate,
} from "@/lib/socialIngest/semanticDedupe";

const BATCH_SIZE = Number(process.env.SOCIAL_INGEST_BATCH_SIZE ?? "5");
const STATUS_PENDING = "pending";
const STATUS_READY = "ready";
const STATUS_IGNORED = "ignored";
const STATUS_ERROR = "error";
const STATUS_DUPLICATE_SEMANTIC = "duplicate_semantic";

type ExtraPayload = Record<string, unknown> | null;

interface SocialEngageRow {
  id: string;
  platform: string | null;
  permalink: string | null;
  raw_source_url: string | null;
  title: string | null;
  body: string | null;
  ai_input?: string | null;
  status: string | null;
  source: string | null;
  extra: ExtraPayload;
  ai_parse_ok?: boolean | null;
  external_post_id?: string | null;
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
    .select(
      "id, platform, permalink, raw_source_url, external_post_id, title, body, status, source, extra, ai_input"
    )
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

  const payload: NormalizedSocialIngestPayload = {
    platform: row.platform ?? "reddit",
    raw_source_url: row.raw_source_url ?? permalink,
    permalink,
    source: row.source,
    external_id: row.external_post_id ?? null,
    extra: ensureExtraObject(row.extra),
  };

  let resolvedPost;
  try {
    resolvedPost = await resolveRedditPostFromUrl(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logIngestError("enrich_pipeline", {
      message: "Failed to resolve Reddit metadata",
      url: permalink,
      platform: payload.platform,
      attempt: "enrich",
      reason: "decodo",
      extra: {
        error: message,
      },
    });
    await markRowError(row, message);
    return;
  }

  logIngestInfo("enrich_pipeline", {
    message: "Resolved Reddit metadata",
    url: resolvedPost.canonical_url ?? permalink,
    platform: resolvedPost.platform,
    attempt: "enrich",
    extra: {
      external_post_id: resolvedPost.external_id,
      images: resolvedPost.images,
    },
  });

  const updatedExtra = ensureExtraObject(row.extra);
  updatedExtra.reddit_post = {
    content_html: resolvedPost.hydrated_html ?? resolvedPost.body ?? "",
    images: resolvedPost.images ?? [],
  };

  if (resolvedPost.hydrated_body || resolvedPost.hydrated_html) {
    updatedExtra.hydrated = {
      ...(resolvedPost.hydrated_body ? { full_body: resolvedPost.hydrated_body } : {}),
      ...(resolvedPost.hydrated_html ? { html: resolvedPost.hydrated_html } : {}),
    };
  }

  const redditMetadata: Record<string, unknown> = {};
  if (resolvedPost.subreddit) {
    redditMetadata.subreddit = resolvedPost.subreddit;
  }
  if (resolvedPost.author) {
    redditMetadata.author = resolvedPost.author;
  }
  if (resolvedPost.karma !== null && resolvedPost.karma !== undefined) {
    redditMetadata.karma = resolvedPost.karma;
  }
  if (Object.keys(redditMetadata).length > 0) {
    updatedExtra.reddit_metadata = redditMetadata;
  }

  const { error: metadataUpdateError } = await supabaseAdmin
    .from("social_engage")
    .update({
      title: resolvedPost.title,
      body: resolvedPost.body,
      source: resolvedPost.source,
      external_post_id: resolvedPost.external_id,
      extra: updatedExtra,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (metadataUpdateError) {
    console.error("social_ingest: failed to persist reddit metadata", {
      id: row.id,
      error: metadataUpdateError.message,
    });
    await markRowError(row, metadataUpdateError.message);
    return;
  }

  const hydratedBody = (updatedExtra.hydrated as { full_body?: string } | null)?.full_body;
  const fallback = (hydratedBody?.trim() ||
    (resolvedPost.body ?? resolvedPost.title ?? "").trim());

  const enrichedRow: SocialEngageRow = {
    ...row,
    title: resolvedPost.title ?? row.title,
    body: resolvedPost.body ?? row.body,
    source: resolvedPost.source,
    external_post_id: resolvedPost.external_id,
    extra: updatedExtra,
  };

  const normalizedPost = buildNormalizedRedditPost(enrichedRow);
  const { enrichedInput, ocrFragments } = await extractImageTextForPost(normalizedPost);
  const finalInput = enrichedInput.trim() || fallback;

  if (!finalInput) {
    console.error("social_ingest: no text available for AI analysis", { id: row.id });
    await markRowError(row, "Missing post text for AI analysis");
    return;
  }

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

  const author =
    (updatedExtra.reddit_metadata as { author?: string } | undefined)?.author ?? null;

  let embedding: number[] | null = null;
  try {
    embedding = await computeEmbedding(finalInput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logIngestError("semantic_dedupe", {
      message: "Failed to compute semantic embedding",
      platform: payload.platform,
      url: permalink,
      attempt: "enrich",
      reason: "embedding",
      extra: { error: message },
    });
  }

  if (embedding) {
    const { error: embeddingUpdateError } = await supabaseAdmin
      .from("social_engage")
      .update({
        semantic_embedding: embedding,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (embeddingUpdateError) {
      console.error("social_ingest: failed to persist semantic embedding", {
        id: row.id,
        error: embeddingUpdateError.message,
      });
    }

    let duplicate: { id: string; similarity: number } | null = null;
    try {
      duplicate = await findSemanticDuplicate({
        platform: payload.platform,
        author,
        embedding,
        excludeId: row.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logIngestError("semantic_dedupe", {
        message: "Failed to lookup semantic duplicates",
        platform: payload.platform,
        url: permalink,
        attempt: "enrich",
        reason: "rpc",
        extra: { error: message },
      });
    }

    if (duplicate) {
      const existingExtra = ensureExtraObject(updatedExtra);
      const metadata = {
        last_run_at: new Date().toISOString(),
        status: STATUS_DUPLICATE_SEMANTIC,
        duplicate_of: duplicate.id,
        similarity: duplicate.similarity,
      };

      const duplicatePayload = {
        duplicate_semantic: true,
        matched_id: duplicate.id,
        similarity: duplicate.similarity,
        reason: "Detected semantic duplicate for same author",
      };

      const { error: duplicateUpdateError } = await supabaseAdmin
        .from("social_engage")
        .update({
          status: STATUS_DUPLICATE_SEMANTIC,
          ai_should_reply: false,
          ai_reply_draft: null,
          ai_category: "duplicate",
          ai_priority: "low",
          ai_reason: "duplicate_semantic",
          ai_parse_ok: true,
          ai_result: duplicatePayload,
          extra: { ...existingExtra, ai_metadata: metadata },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (duplicateUpdateError) {
        console.error("social_ingest: failed to persist semantic duplicate", {
          id: row.id,
          error: duplicateUpdateError.message,
        });
      } else {
        logIngestInfo("semantic_dedupe", {
          message: "Marked semantic duplicate",
          platform: payload.platform,
          url: permalink,
          attempt: "enrich",
          extra: {
            matched_id: duplicate.id,
            similarity: duplicate.similarity,
          },
        });
      }

      return;
    }
  }

  try {
    const aiDecision = await analyzeRowForReply(enrichedRow, finalInput);
    await updateRowWithAiDecision(enrichedRow, aiDecision, ocrFragments);
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
  const snippet = null;
  const subject = null;

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

async function updateRowWithAiDecision(
  row: SocialEngageRow,
  decision: AiDecision,
  ocrFragments: string[]
) {
  const status = decision.should_reply ? STATUS_READY : STATUS_IGNORED;
  const existingExtra = ensureExtraObject(row.extra);
  const metadata = {
    last_run_at: new Date().toISOString(),
    status,
    reason: decision.reason,
    priority: decision.priority,
    category: decision.category,
  };

  const decisionPayload = {
    ...decision,
    image_ocr: ocrFragments,
  };

  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      status,
      ai_result: decisionPayload,
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

function ensureExtraObject(value: ExtraPayload): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function buildNormalizedRedditPost(row: SocialEngageRow): RedditPostNormalized {
  const extra = ensureExtraObject(row.extra);
  const redditPayload = extra.reddit_post as
    | { content_html?: unknown; images?: unknown[] }
    | undefined;
  const hydratedHtml = (extra.hydrated as { html?: unknown } | null)?.html;
  const contentSource =
    (redditPayload?.content_html as string | undefined) ??
    (typeof hydratedHtml === "string" ? hydratedHtml : undefined) ??
    row.body ??
    row.title ??
    "";

  const metadata = extra.reddit_metadata as
    | { subreddit?: string; author?: string; karma?: number }
    | undefined;

  const images =
    Array.isArray(redditPayload?.images) && redditPayload?.images.length
      ? (redditPayload.images as unknown[])
          .filter((value) => typeof value === "string")
          .map((value) => (value as string).trim())
          .filter(Boolean)
      : [];

  return {
    title: row.title ?? "",
    subreddit: metadata?.subreddit ?? "",
    author: metadata?.author ?? "",
    post_url: row.permalink ?? "",
    content_html: contentSource || null,
    karma:
      typeof metadata?.karma === "number" && Number.isFinite(metadata.karma)
        ? metadata.karma
        : null,
    comments: [],
    images,
  };
}
