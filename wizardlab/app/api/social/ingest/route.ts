import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logIngestError, logIngestInfo } from "@/lib/log/socialLog";
import { normalizeSocialIngestPayload } from "@/lib/social/normalizeIncoming";
import { extractRedditPostId } from "@/tools/reddit/utils/extractRedditPostId";

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
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Invalid JSON payload: ${detail}`;
    const errorId = logIngestError("ingest_pipeline", {
      message,
      attempt: "ingest",
      reason: "json",
    });
    return NextResponse.json({ error: message, error_id: errorId }, { status: 400 });
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeSocialIngestPayload(rawPayload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Invalid payload: ${detail}`;
    const errorId = logIngestError("ingest_pipeline", {
      message,
      url: typeof rawPayload.url === "string" ? rawPayload.url : undefined,
      platform: typeof rawPayload.platform === "string" ? rawPayload.platform : undefined,
      attempt: "ingest",
      reason: "validation",
    });
    return NextResponse.json({ error: message, error_id: errorId }, { status: 400 });
  }

  if (normalizedPayload.platform !== "reddit") {
    return NextResponse.json(
      { error: `Unsupported platform: ${normalizedPayload.platform}` },
      { status: 400 }
    );
  }

  const canonicalUrl = canonicalizeRedditPermalink(normalizedPayload.permalink);
  const extra: Record<string, unknown> = normalizedPayload.extra;

  const { data: existingRows, error: duplicateCheckError } = await supabaseAdmin
    .from("social_engage")
    .select("id, status")
    .eq("platform", normalizedPayload.platform)
    .eq("permalink", canonicalUrl)
    .limit(1);

  if (duplicateCheckError) {
    const errorId = logIngestError("ingest_pipeline", {
      message: `Failed duplicate permalink check: ${duplicateCheckError.message}`,
      url: canonicalUrl,
      platform: normalizedPayload.platform,
      attempt: "ingest",
      reason: "db",
    });
    return NextResponse.json(
      { error: "Failed to check duplicates", error_id: errorId },
      { status: 500 }
    );
  }

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    logIngestInfo("ingest_pipeline", {
      message: "Rejecting ingest: exact duplicate permalink",
      platform: normalizedPayload.platform,
      url: canonicalUrl,
      attempt: "ingest",
      extra: {
        existing_id: existing.id,
        status: existing.status,
      },
    });

    return NextResponse.json(
      {
        status: "duplicate_exact",
        existing_id: existing.id,
      },
      { status: 200 }
    );
  }

  logIngestInfo("ingest_pipeline", {
    message: "Queued reddit post for enrichment",
    url: canonicalUrl,
    platform: normalizedPayload.platform,
    attempt: "ingest",
    extra: {
      external_id: normalizedPayload.external_id,
      source: normalizedPayload.source,
    },
  });

  const insertResponse = await supabaseAdmin.from("social_engage").insert({
    platform: normalizedPayload.platform,
    external_post_id: normalizedPayload.external_id,
    permalink: canonicalUrl,
    raw_source_url: normalizedPayload.raw_source_url,
    title: null,
    body: null,
    status: "pending",
    source: normalizedPayload.source,
    extra,
  });

  if (insertResponse.error) {
    const errorDetail =
      insertResponse.error.message || JSON.stringify(insertResponse.error);
    const errorId = logIngestError("ingest_pipeline", {
      message: `Failed to insert into social_engage: ${errorDetail}`,
      url: normalizedPayload.raw_source_url,
      platform: normalizedPayload.platform,
      attempt: "ingest",
      reason: "db",
    });
    return NextResponse.json(
      { error: "Failed to write social_engage", error_id: errorId },
      { status: 500 }
    );
  }

  logIngestInfo("ingest_pipeline", {
    message: "Inserted pending Reddit ingest row",
    url: canonicalUrl,
    platform: normalizedPayload.platform,
    attempt: "ingest",
    extra: {
      external_post_id: normalizedPayload.external_id,
      source: normalizedPayload.source,
    },
  });

  return NextResponse.json(
    {
      status: "queued",
      platform: normalizedPayload.platform,
      external_post_id: normalizedPayload.external_id,
    },
    { status: 200 }
  );
}

function canonicalizeRedditPermalink(url: string): string {
  const trimmed = (url ?? "").toString().trim();
  if (!trimmed) {
    return url;
  }

  const postId = extractRedditPostId(trimmed);
  if (postId) {
    return `https://www.reddit.com/comments/${postId}/`;
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}
