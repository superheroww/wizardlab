export type ResolvedRedditPost = {
  canonicalUrl: string;
  externalPostId: string;
  title: string;
  body: string;
  author: string;
  subreddit: string;
  externalCreatedAt: string;
};

const WEB_REDDIT_HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "np.reddit.com", "new.reddit.com"]);
const USER_AGENT = "wizardlab-reddit-ingest/0.1 by wizardlab";

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function buildCanonicalUrl(paths: string[]) {
  const base = "https://www.reddit.com";
  return ensureTrailingSlash(`${base}/${paths.join("/")}`);
}

export function normalizeRedditPostUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const trimmedPathname = url.pathname.replace(/\/+$/g, "");
  const segments = trimmedPathname.split("/").filter(Boolean);

  if (hostname === "redd.it") {
    const postId = segments[0];
    if (!postId) {
      return null;
    }
    return buildCanonicalUrl(["comments", postId]);
  }

  if (!WEB_REDDIT_HOSTS.has(hostname)) {
    return null;
  }

  if (segments[0] === "r" && segments[2] === "comments" && segments.length >= 4) {
    const subreddit = segments[1];
    const postId = segments[3];
    const slug = segments[4] ?? "";
    if (!subreddit || !postId) {
      return null;
    }
    const pathParts = ["r", subreddit, "comments", postId];
    if (slug) {
      pathParts.push(slug);
    }
    return buildCanonicalUrl(pathParts);
  }

  if (segments[0] === "comments" && segments.length >= 3) {
    const postId = segments[1];
    const slug = segments[2];
    if (!postId || !slug) {
      return null;
    }
    return buildCanonicalUrl(["comments", postId, slug]);
  }

  return null;
}

export async function resolveRedditPost(rawUrl: string): Promise<ResolvedRedditPost> {
  const canonicalUrl = normalizeRedditPostUrl(rawUrl);
  if (!canonicalUrl) {
    throw new Error(`Unsupported Reddit URL: ${rawUrl}`);
  }

  const jsonUrl = `${canonicalUrl}.json`;

  const response = await fetch(jsonUrl, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    console.error("reddit ingest: failed fetch", { status: response.status, url: jsonUrl });
    throw new Error(`Reddit fetch failed with status ${response.status} for ${jsonUrl}`);
  }

  const payload = await response.json();
  const postData = payload?.[0]?.data?.children?.[0]?.data;
  if (!postData) {
    throw new Error("Unexpected Reddit response structure");
  }

  if (!postData.id || !postData.permalink) {
    throw new Error("Resolved Reddit post missing required metadata");
  }

  const permalink = typeof postData.permalink === "string" ? postData.permalink : "";
  const fullPermalink = permalink.startsWith("http")
    ? permalink
    : `https://www.reddit.com${permalink}`;
  const canonicalPermalink = ensureTrailingSlash(fullPermalink);

  const createdEpoch = typeof postData.created_utc === "number" ? postData.created_utc * 1000 : 0;
  const createdAt = createdEpoch ? new Date(createdEpoch).toISOString() : new Date().toISOString();

  return {
    canonicalUrl: canonicalPermalink,
    externalPostId: postData.id,
    title: postData.title ?? "",
    body: postData.selftext ?? "",
    author: postData.author ?? "",
    subreddit: postData.subreddit ?? "",
    externalCreatedAt: createdAt,
  };
}
