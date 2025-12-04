import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  resolveRedditPostFromUrl,
  SocialIngestPayload,
} from "@/tools/reddit/resolveRedditPostFromUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export async function POST(req: NextRequest) {
  let payload: SocialIngestPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("social_ingest: invalid payload", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const platform = isNonEmptyString(payload?.platform)
    ? payload.platform.trim()
    : "reddit";
  const url = isNonEmptyString(payload?.url) ? payload.url.trim() : "";
  const externalId = isNonEmptyString(payload?.external_id)
    ? payload.external_id.trim()
    : null;
  const hasSnippet = isNonEmptyString(payload?.f5bot_snippet);

  if (!platform || !url) {
    return NextResponse.json(
      { error: "Missing platform or url" },
      { status: 400 }
    );
  }

  if (platform !== "reddit") {
    return NextResponse.json(
      { error: `Unsupported platform: ${platform}` },
      { status: 400 }
    );
  }

  console.log("social_ingest: ingesting reddit from gmail-f5bot", {
    url,
    external_id: externalId,
    hasSnippet,
  });

  let resolvedPost;
  try {
    resolvedPost = await resolveRedditPostFromUrl(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("social_ingest: failed to resolve Reddit post", {
      error: message,
      url,
    });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }

  const canonicalUrl = resolvedPost.canonical_url ?? url;

  console.info("social_ingest: resolved reddit metadata", {
    canonicalUrl,
    title: resolvedPost.title,
    bodyPreview: resolvedPost.body ? resolvedPost.body.slice(0, 120) : null,
  });

  const payloadSubject =
    typeof payload.f5bot_subject === "string" ? payload.f5bot_subject.trim() : "";
  const payloadSnippet =
    typeof payload.f5bot_snippet === "string" ? payload.f5bot_snippet.trim() : "";

  const extra: Record<string, unknown> = {
    raw_reddit_url: canonicalUrl,
    raw_reddit_source: resolvedPost.source,
    f5bot_subject: payloadSubject || resolvedPost.title,
    f5bot_snippet: payloadSnippet || resolvedPost.body,
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
      url,
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
      platform,
      external_post_id: resolvedPost.external_id,
    },
    { status: 200 }
  );
}
