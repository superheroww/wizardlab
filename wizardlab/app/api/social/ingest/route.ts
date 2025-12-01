import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveRedditPost } from "@/tools/reddit/ingest/resolveRedditPost";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

type SocialIngestPayload = {
  platform?: unknown;
  source?: unknown;
  url?: unknown;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const truncateTitle = (value: string, limit = 120) =>
  value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("social_ingest: missing WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const token = req.headers.get("x-wizardlab-token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SocialIngestPayload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("social_ingest: invalid payload", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const platform = isNonEmptyString(payload?.platform) ? payload.platform.trim() : "";
  const url = isNonEmptyString(payload?.url) ? payload.url.trim() : "";
  const source = isNonEmptyString(payload?.source) ? payload.source.trim() : undefined;

  if (!platform || !url) {
    return NextResponse.json({ error: "platform and url are required" }, { status: 400 });
  }

  if (platform !== "reddit") {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 501 });
  }

  let resolvedPost;
  try {
    resolvedPost = await resolveRedditPost(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("social_ingest: failed to resolve Reddit post", { error: message, url });

    if (message.startsWith("Unsupported Reddit URL:")) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "unsupported_or_reply_url" },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: "failed to resolve reddit post" }, { status: 502 });
  }

  const sourceValue = source ?? "gmail-f5bot";
  const channel = resolvedPost.extra.subreddit ?? null;

  console.info("reddit ingest: resolved", {
    platform,
    external_post_id: resolvedPost.external_post_id,
    subreddit: channel,
    title: truncateTitle(resolvedPost.title),
  });

  const additionalMeta: Record<string, unknown> = {
    ...resolvedPost.extra,
    raw_reddit_url: url,
    raw_reddit_source: source ?? null,
    raw_reddit_subreddit: channel,
  };

  const selectResponse = await supabaseAdmin
    .from("social_engage")
    .select("id, extra")
    .eq("platform", platform)
    .eq("external_post_id", resolvedPost.external_post_id)
    .maybeSingle();

  if (selectResponse.error) {
    console.error("social_engage: select failed", selectResponse.error);
    return NextResponse.json({ error: "Failed to write social_engage" }, { status: 500 });
  }

  const existingRow = selectResponse.data;
  let recordId: string | null = null;

  if (existingRow?.id) {
    recordId = existingRow.id;
    const previousExtra = (existingRow.extra ?? {}) as Record<string, unknown>;
    const mergedExtra = { ...previousExtra, ...additionalMeta };

    const updateResponse = await supabaseAdmin
      .from("social_engage")
      .update({
        permalink: resolvedPost.permalink,
        author_handle: resolvedPost.author_handle,
        channel,
        title: resolvedPost.title,
        body: resolvedPost.body,
        source: sourceValue,
        extra: mergedExtra,
      })
      .eq("id", existingRow.id);

    if (updateResponse.error) {
      console.error("social_engage: update failed", updateResponse.error);
      return NextResponse.json({ error: "Failed to write social_engage" }, { status: 500 });
    }

    console.info("social_engage: updated", {
      platform,
      external_post_id: resolvedPost.external_post_id,
    });
  } else {
    const insertResponse = await supabaseAdmin
      .from("social_engage")
      .insert({
        platform,
        external_post_id: resolvedPost.external_post_id,
        external_comment_id: null,
        permalink: resolvedPost.permalink,
        author_handle: resolvedPost.author_handle,
        channel,
        title: resolvedPost.title,
        body: resolvedPost.body,
        source: sourceValue,
        extra: additionalMeta,
      })
      .select("id")
      .single();

    if (insertResponse.error || !insertResponse.data?.id) {
      console.error("social_engage: insert failed", insertResponse.error);
      return NextResponse.json({ error: "Failed to write social_engage" }, { status: 500 });
    }

    recordId = insertResponse.data.id;

    console.info("social_engage: inserted", {
      platform,
      external_post_id: resolvedPost.external_post_id,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      id: recordId,
      platform,
      external_post_id: resolvedPost.external_post_id,
      permalink: resolvedPost.permalink,
      source: sourceValue,
    },
    { status: 200 }
  );
}
