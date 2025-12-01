const BASE_REDDIT_URL = "https://www.reddit.com";
const USER_AGENT = "wizardlab-bot/0.1 (contact: https://wizardfolio.com)";

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

function buildJsonUrl(baseUrl: string) {
  const withoutJson = baseUrl.replace(/\.json$/i, "");
  return `${withoutJson}.json?raw_json=1`;
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

  const jsonUrl = buildJsonUrl(withoutTrailingSlash);

  const response = await fetch(jsonUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      console.error("social_ingest: reddit post not accessible", {
        status: response.status,
        canonicalUrl,
        jsonUrl,
      });
      return null;
    }
    throw new Error(`Failed to fetch Reddit JSON (${response.status}): ${jsonUrl}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    console.error("social_ingest: unexpected Reddit JSON structure", {
      canonicalUrl,
      jsonUrl,
    });
    return null;
  }

  const postListing = payload[0]?.data?.children?.find(
    (child: any) => child?.kind === "t3"
  );
  const postData = postListing?.data;
  if (!postData) {
    console.error("social_ingest: unexpected Reddit JSON structure", {
      canonicalUrl,
      jsonUrl,
    });
    return null;
  }

  const permalinkValue =
    typeof postData.permalink === "string" ? postData.permalink : null;
  const fallbackPermalink = normalizedUrl.pathname
    ? `${BASE_REDDIT_URL}${ensureTrailingSlash(normalizedUrl.pathname)}`
    : BASE_REDDIT_URL;
  const formattedPermalink =
    permalinkValue && permalinkValue.length
      ? permalinkValue.startsWith("http")
        ? ensureTrailingSlash(permalinkValue)
        : ensureTrailingSlash(`${BASE_REDDIT_URL}${permalinkValue}`)
      : fallbackPermalink;

  return {
    externalPostId: String(postData.id),
    permalink: formattedPermalink,
    title:
      typeof postData.title === "string" ? postData.title.trim() || null : null,
    body:
      typeof postData.selftext === "string"
        ? postData.selftext.trim() || null
        : null,
    author: typeof postData.author === "string" ? postData.author : null,
    subreddit:
      typeof postData.subreddit === "string"
        ? postData.subreddit
        : subreddit ?? null,
    extra: {
      normalized_url: withoutTrailingSlash,
      raw_canonical_url: canonicalUrl,
      subreddit_from_url: subreddit,
      post_id_from_url: postId,
      ups: typeof postData.ups === "number" ? postData.ups : null,
      num_comments:
        typeof postData.num_comments === "number"
          ? postData.num_comments
          : null,
      created_utc:
        typeof postData.created_utc === "number" ? postData.created_utc : null,
    },
  };
}
