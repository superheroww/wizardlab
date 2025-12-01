import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveRedditPost } from "@/tools/reddit/ingest/resolveRedditPost";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

type IngestRequest = {
  platform: string;
  source: string;
  url: string;
};

const truncateTitle = (value: string, limit = 120) =>
  value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

const validateString = (value: unknown) => typeof value === "string" && value.trim().length > 0;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("social_ingest: missing WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const token = req.headers.get("x-wizardlab-token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestBody: IngestRequest;
  try {
    requestBody = await req.json();
  } catch (error) {
    console.error("social_ingest: invalid payload", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { platform, source, url } = requestBody ?? {};
  if (!validateString(platform) || !validateString(source) || !validateString(url)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (platform !== "reddit") {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 501 });
  }

  let resolvedPost;
  try {
    resolvedPost = await resolveRedditPost(url);
  } catch (error) {
    console.error("social_ingest: failed to resolve Reddit post", {
      error: error instanceof Error ? error.message : error,
      url,
    });
    return NextResponse.json({ error: "Failed to resolve Reddit post" }, { status: 502 });
  }

  console.info("reddit ingest: resolved", {
    platform,
    external_post_id: resolvedPost.externalPostId,
    subreddit: resolvedPost.subreddit,
    title: truncateTitle(resolvedPost.title),
  });

  const additionalMeta = {
    external_created_at: resolvedPost.externalCreatedAt,
    raw_reddit_source: source,
    raw_reddit_url: url,
    raw_reddit_subreddit: resolvedPost.subreddit,
  } as Record<string, string>;

  const selectResponse = await supabaseAdmin
    .from("social_engage")
    .select("id, extra")
    .eq("platform", platform)
    .eq("external_post_id", resolvedPost.externalPostId)
    .maybeSingle();

  if (selectResponse.error) {
    console.error("social_engage: select failed", selectResponse.error);
    return NextResponse.json({ error: "Failed to write social_engage" }, { status: 500 });
  }

  const existingRow = selectResponse.data;

  if (existingRow?.id) {
    const previousExtra = (existingRow.extra ?? {}) as Record<string, unknown>;
    const mergedExtra = { ...previousExtra, ...additionalMeta };

    const updateResponse = await supabaseAdmin
      .from("social_engage")
      .update({
        permalink: resolvedPost.canonicalUrl,
        author_handle: resolvedPost.author,
        channel: resolvedPost.subreddit,
        title: resolvedPost.title,
        body: resolvedPost.body,
        source,
        extra: mergedExtra,
      })
      .eq("id", existingRow.id);

    if (updateResponse.error) {
      console.error("social_engage: update failed", updateResponse.error);
      return NextResponse.json({ error: "Failed to write social_engage" }, { status: 500 });
    }

    console.info("social_engage: updated", {
      platform,
      external_post_id: resolvedPost.externalPostId,
    });
  } else {
    const insertResponse = await supabaseAdmin.from("social_engage").insert({
      platform,
      external_post_id: resolvedPost.externalPostId,
      external_comment_id: null,
      permalink: resolvedPost.canonicalUrl,
      author_handle: resolvedPost.author,
      channel: resolvedPost.subreddit,
      title: resolvedPost.title,
      body: resolvedPost.body,
      source,
      extra: additionalMeta,
    });

    if (insertResponse.error) {
      console.error("social_engage: insert failed", insertResponse.error);
      return NextResponse.json({ error: "Failed to write social_engage" }, { status: 500 });
    }

    console.info("social_engage: inserted", {
      platform,
      external_post_id: resolvedPost.externalPostId,
    });
  }

  return NextResponse.json({
    ok: true,
    platform,
    external_post_id: resolvedPost.externalPostId,
    permalink: resolvedPost.canonicalUrl,
    source,
  });
}
