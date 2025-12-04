import {
  fetchRedditPostViaDecodo,
  type DecodoRedditPost,
} from "@/lib/social/fetchReddit";

export type SocialIngestPayload = {
  platform?: unknown;
  source?: unknown;
  url?: unknown;
  external_id?: unknown;
  f5bot_subject?: unknown;
  f5bot_snippet?: unknown;
};

export type ResolvedRedditPost = {
  platform: string;
  source: string;
  canonical_url: string | null;
  external_id: string | null;
  title: string | null;
  body: string | null;
  hydrated_body: string | null;
  hydrated_html: string | null;
  subreddit: string | null;
  author: string | null;
  karma: number | null;
};

const DEFAULT_PLATFORM = "reddit";
const DEFAULT_SOURCE = "gmail-f5bot";

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function htmlToPlainText(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const replaced = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/&nbsp;/gi, " ");

  const withoutTags = replaced.replace(/<[^>]+>/g, " ");
  const normalized = withoutTags.replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

/**
 * Resolves the Reddit payload into canonical metadata by calling Decodo's scraper API.
 */
export async function resolveRedditPostFromUrl(
  payload: SocialIngestPayload
): Promise<ResolvedRedditPost> {
  const platform = normalizeString(payload.platform) ?? DEFAULT_PLATFORM;
  const source = normalizeString(payload.source) ?? DEFAULT_SOURCE;
  const url = normalizeString(payload.url);

  if (!url) {
    throw new Error("Missing Reddit URL in social ingest payload.");
  }

  const fallbackTitle = normalizeString(payload.f5bot_subject);
  const fallbackSnippet = normalizeString(payload.f5bot_snippet);
  const externalId = normalizeString(payload.external_id);

  let fetched: DecodoRedditPost;
  try {
    fetched = await fetchRedditPostViaDecodo(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch Reddit post via Decodo: ${message}`);
  }
  const canonicalUrl = normalizeString(fetched.post_url) ?? url;
  const hydratedHtml = normalizeString(fetched.content_html);
  const hydratedBody = htmlToPlainText(hydratedHtml);

  const resolvedTitle = normalizeString(fetched.title) ?? fallbackTitle;
  const resolvedBody = hydratedBody ?? fallbackSnippet ?? resolvedTitle;

  const karmaValue =
    typeof fetched.karma === "number" && Number.isFinite(fetched.karma)
      ? fetched.karma
      : null;

  return {
    platform,
    source,
    canonical_url: canonicalUrl,
    external_id: externalId,
    title: resolvedTitle,
    body: resolvedBody ?? null,
    hydrated_body: hydratedBody,
    hydrated_html: hydratedHtml,
    subreddit: normalizeString(fetched.subreddit),
    author: normalizeString(fetched.author),
    karma: karmaValue,
  };
}
