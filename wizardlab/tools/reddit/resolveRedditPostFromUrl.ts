const BASE_REDDIT_URL = "https://www.reddit.com";
const USER_AGENT = "Mozilla/5.0 (compatible; WizardLabBot/0.1; +https://wizardfolio.com)";

export type ResolvedRedditPost = {
  externalPostId: string;
  permalink: string;
  title: string | null;
  body: string | null;
  author: string | null;
  subreddit: string | null;
  extra?: Record<string, unknown>;
};

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isAllowedHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower.endsWith(".reddit.com") || lower === "reddit.com") {
    return true;
  }

  return lower === "redd.it" || lower === "www.redd.it";
}

function extractPostInfo(hostname: string, segments: string[]) {
  if (segments.length === 0) {
    return { postId: null, subreddit: null };
  }

  const normalizedSegments = segments.map((segment) => segment.toLowerCase());
  const firstSegment = normalizedSegments[0];

  if (hostname === "redd.it" || hostname === "www.redd.it") {
    return { postId: segments[0] ?? null, subreddit: null };
  }

  if (
    firstSegment === "r" &&
    normalizedSegments[2] === "comments" &&
    segments[3]
  ) {
    return { postId: segments[3], subreddit: segments[1] ?? null };
  }

  if (firstSegment === "comments" && segments[1]) {
    return { postId: segments[1], subreddit: null };
  }

  return { postId: null, subreddit: null };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const decoded = decodeHtmlEntities(value);
  const withoutScripts = decoded.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  const collapsed = withoutTags.replace(/\s+/g, " ").trim();
  return collapsed || null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function extractMetaContent(
  html: string,
  attribute: "property" | "name",
  attributeValue: string
) {
  const regex = new RegExp(
    `<meta[^>]*${attribute}=(?:\"|')${escapeRegExp(attributeValue)}(?:\"|')[^>]*>`,
    "i"
  );
  const match = regex.exec(html);
  if (!match) {
    return null;
  }

  const contentMatch = /content=(?:\"|')([^\"'>]+)/i.exec(match[0]);
  return contentMatch ? contentMatch[1] : null;
}

function extractTextBlock(html: string) {
  const match = /<div[^>]+data-click-id=(?:\"|')text(?:\"|')[^>]*>([\s\S]*?)<\/div>/i.exec(
    html
  );
  return match ? match[1] : null;
}

function extractTitleFromHtml(html: string) {
  return firstNonEmpty(
    extractMetaContent(html, "property", "og:title"),
    extractMetaContent(html, "name", "twitter:title"),
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? null
  );
}

function extractBodyFromHtml(html: string) {
  return firstNonEmpty(
    extractMetaContent(html, "property", "og:description"),
    extractMetaContent(html, "name", "description"),
    extractTextBlock(html)
  );
}

export async function resolveRedditPostFromUrl(
  canonicalUrl: string
): Promise<ResolvedRedditPost | null> {
  const trimmed = canonicalUrl?.trim();
  if (!trimmed) {
    return null;
  }

  const withoutQuery = trimmed.split(/[?#]/)[0];
  if (!withoutQuery) {
    return null;
  }

  const commentIndex = withoutQuery.indexOf("/c/");
  const truncated =
    commentIndex >= 0 ? withoutQuery.slice(0, commentIndex) : withoutQuery;
  const withoutTrailingSlash = truncated.replace(/\/+$/, "");
  if (!withoutTrailingSlash) {
    return null;
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(withoutTrailingSlash);
  } catch (error) {
    return null;
  }

  if (!isAllowedHostname(normalizedUrl.hostname)) {
    console.error("social_ingest: unsupported Reddit URL", { canonicalUrl });
    return null;
  }

  const segments = normalizedUrl.pathname.split("/").filter(Boolean);
  const { postId, subreddit } = extractPostInfo(
    normalizedUrl.hostname.toLowerCase(),
    segments
  );

  if (!postId) {
    console.error("social_ingest: unsupported Reddit URL", { canonicalUrl });
    return null;
  }

  const fetchUrl = normalizedUrl.href;
  const response = await fetch(fetchUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      console.error("social_ingest: reddit post not accessible", {
        status: response.status,
        canonicalUrl,
        fetchUrl,
      });
      return null;
    }

    throw new Error(`Failed to fetch reddit HTML (${response.status}): ${fetchUrl}`);
  }

  const html = await response.text();
  const title = extractTitleFromHtml(html);
  const body = extractBodyFromHtml(html);

  if (!title) {
    console.error("social_ingest: could not extract Reddit title from HTML", {
      canonicalUrl,
      fetchUrl,
    });
    return null;
  }

  const permalinkValue = segments.length
    ? normalizedUrl.pathname
    : undefined;
  const fallbackPermalink = normalizedUrl.pathname
    ? `${BASE_REDDIT_URL}${ensureTrailingSlash(normalizedUrl.pathname)}`
    : BASE_REDDIT_URL;
  const formattedPermalink = permalinkValue
    ? `${BASE_REDDIT_URL}${ensureTrailingSlash(normalizedUrl.pathname)}`
    : fallbackPermalink;

  return {
    externalPostId: postId,
    permalink: formattedPermalink,
    title,
    body,
    author: null,
    subreddit: subreddit ?? null,
    extra: {
      normalized_url: withoutTrailingSlash,
      raw_canonical_url: canonicalUrl,
      subreddit_from_url: subreddit,
      post_id_from_url: postId,
    },
  };
}
