import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveRedditPostFromUrl } from "@/tools/reddit/resolveRedditPostFromUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SocialIngestPayload = {
  platform?: unknown;
  source?: unknown;
  url?: unknown;
};

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
    : "";
  const url = isNonEmptyString(payload?.url) ? payload.url.trim() : "";
  const sourceValue = isNonEmptyString(payload?.source)
    ? payload.source.trim()
    : "gmail-f5bot";

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

  let resolvedPost;
  try {
    resolvedPost = await resolveRedditPostFromUrl(url);
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

  if (!resolvedPost) {
    console.error("social_ingest: could not resolve Reddit post", { url });
    return NextResponse.json(
      { status: "ignored", reason: "unresolvable_reddit_post" },
      { status: 200 }
    );
  }

  console.info("social_ingest: resolved reddit post", {
    url,
    title: resolvedPost.title,
    bodyPreview: resolvedPost.body ? resolvedPost.body.slice(0, 120) : null,
  });

  const extra = {
    ...(resolvedPost.extra ?? {}),
    raw_reddit_url: url,
    raw_reddit_source: sourceValue,
  };

  const insertResponse = await supabaseAdmin.from("social_engage").insert({
    platform: "reddit",
    external_post_id: resolvedPost.externalPostId,
    external_comment_id: null,
    permalink: resolvedPost.permalink,
    author_handle: resolvedPost.author,
    channel: resolvedPost.subreddit,
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
    source: sourceValue,
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
    platform,
    external_post_id: resolvedPost.externalPostId,
    source: sourceValue,
  });

  return NextResponse.json(
    {
      status: "ok",
      platform,
      external_post_id: resolvedPost.externalPostId,
    },
    { status: 200 }
  );
}
