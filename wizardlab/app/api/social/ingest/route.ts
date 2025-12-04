import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeSocialIngestPayload } from "@/lib/social/normalizeIncoming";
import { resolveRedditPostFromUrl } from "@/tools/reddit/resolveRedditPostFromUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Ingestion now expects payloads of the shape `{ platform, url, ...extra }`
 * and routes all remaining metadata through the `extra` JSON column.
 */
export async function POST(req: NextRequest) {
  let rawPayload: Record<string, unknown>;
  try {
    rawPayload = await req.json();
  } catch (error) {
    console.error("social_ingest: invalid payload", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeSocialIngestPayload(rawPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("social_ingest: invalid payload", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (normalizedPayload.platform !== "reddit") {
    return NextResponse.json(
      { error: `Unsupported platform: ${normalizedPayload.platform}` },
      { status: 400 }
    );
  }

  console.log("social_ingest: ingesting reddit post", {
    platform: normalizedPayload.platform,
    raw_source_url: normalizedPayload.raw_source_url,
    external_id: normalizedPayload.external_id,
  });

  let resolvedPost;
  try {
    resolvedPost = await resolveRedditPostFromUrl(normalizedPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("social_ingest: failed to resolve Reddit post", {
      error: message,
      url: normalizedPayload.raw_source_url,
    });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }

  const canonicalUrl = resolvedPost.canonical_url ?? normalizedPayload.permalink;

  console.info("social_ingest: resolved reddit metadata", {
    canonicalUrl,
    title: resolvedPost.title,
    bodyPreview: resolvedPost.body ? resolvedPost.body.slice(0, 120) : null,
  });

  const extra: Record<string, unknown> = {
    ...normalizedPayload.extra,
  };

  if (resolvedPost.hydrated_body || resolvedPost.hydrated_html) {
    extra.hydrated = {
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
    extra.reddit_metadata = redditMetadata;
  }

  const insertResponse = await supabaseAdmin.from("social_engage").insert({
    platform: resolvedPost.platform,
    external_post_id: resolvedPost.external_id,
    external_comment_id: null,
    permalink: canonicalUrl,
    raw_source_url: normalizedPayload.raw_source_url,
    author_handle: null,
    channel: null,
    title: resolvedPost.title,
    body: resolvedPost.body,
    classifier_model: null,
    should_reply: null,
    relevance_score: null,
    relevance_reason: null,
    reply_model: null,
    reply_text: null,
    status: "pending",
    posted_at: null,
    posted_by: null,
    source: resolvedPost.source,
    extra,
  });

  if (insertResponse.error) {
    console.error("social_ingest: failed to insert into social_engage", {
      url: normalizedPayload.raw_source_url,
      insertError: insertResponse.error,
    });
    return NextResponse.json(
      { error: "Failed to write social_engage" },
      { status: 500 }
    );
  }

  console.info("social_ingest: inserted Reddit post", {
    platform: resolvedPost.platform,
    external_post_id: resolvedPost.external_id,
    source: resolvedPost.source,
  });

  return NextResponse.json(
    {
      status: "ok",
      platform: normalizedPayload.platform,
      external_post_id: resolvedPost.external_id,
    },
    { status: 200 }
  );
}
