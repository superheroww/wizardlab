/**
 * Handles Reddit ingestion through Decodo.
 *
 * Two mutually exclusive paths are supported:
 *  1. The Decodo Scraper API (`DECODO_SCRAPER_USERNAME` / `DECODO_SCRAPER_PASSWORD`).
 *     Preferred because Decodo returns a normalized Reddit payload directly.
 *  2. The Decodo residential proxy (`DECODO_PROXY_HOST`, `DECODO_PROXY_PORT`,
 *     `DECODO_PROXY_USERNAME`, `DECODO_PROXY_PASSWORD`).
 *     Used only when scraper credentials are unavailable.
 *
 * Both paths resolve to the same `RedditPostNormalized` shape so downstream
 * code can stay unchanged. This helper lives on the server only.
 */
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { logIngestError, logIngestInfo } from "@/lib/log/socialLog";

const DECODO_ENDPOINT = "https://scraper-api.decodo.com/v2/scrape";
const REDDIT_BASE = "https://www.reddit.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type RedditCommentNormalized = {
  author: string;
  content_html: string | null;
  karma: number | null;
};

export type RedditPostNormalized = {
  title: string;
  subreddit: string;
  author: string;
  post_url: string;
  content_html: string | null;
  karma: number | null;
  comments: RedditCommentNormalized[];
  images: string[];
};

type ScraperCredentials = {
  username: string;
  password: string;
};

type ProxyCredentials = {
  host: string;
  port: string;
  username: string;
  password: string;
};

type RedditListing = {
  data?: {
    children?: Array<{
      data?: Record<string, unknown>;
    }>;
  };
};

class DecodoScraperError extends Error {
  constructor(
    message: string,
    public status?: number,
    public bodySnippet?: string,
    public isAuthError = false,
    public errorId?: string
  ) {
    super(message);
  }
}

class DecodoProxyError extends Error {
  constructor(
    message: string,
    public status?: number,
    public bodySnippet?: string,
    public errorId?: string
  ) {
    super(message);
  }
}

let cachedProxyAgent: ProxyAgent | null = null;
let cachedProxyUrl: string | null = null;

function ensureString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function ensureNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function redactedSnippet(text?: string): string {
  const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "empty body";
  }
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}...` : trimmed;
}

function normalizeHtml(value: unknown): string | null {
  const text = ensureString(value).trim();
  return text.length ? text : null;
}

function normalizeComments(raw: unknown): RedditCommentNormalized[] {
  const items = ensureArray(raw);
  return items
    .map((candidate) => (typeof candidate === "object" && candidate ? candidate : {}))
    .map((candidate) => ({
      author: ensureString((candidate as Record<string, unknown>).author).trim(),
      content_html: normalizeHtml(
        (candidate as Record<string, unknown>).content_html ??
          (candidate as Record<string, unknown>).body_html ??
          (candidate as Record<string, unknown>).selftext_html ??
          (candidate as Record<string, unknown>).selftext
      ),
      karma: ensureNumber((candidate as Record<string, unknown>).ups ?? (candidate as Record<string, unknown>).score),
    }))
    .filter((comment) => comment.author);
}

function decodeUrl(value: string): string {
  return value.replace(/&amp;/g, "&");
}

function resolveMetadataSourceUrl(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return decodeUrl(value.trim());
  }
  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>).u;
    if (typeof candidate === "string" && candidate.trim()) {
      return decodeUrl(candidate.trim());
    }
  }
  return null;
}

function resolveGalleryMediaUrl(metadata?: Record<string, unknown>): string | null {
  if (!metadata) {
    return null;
  }

  const source = metadata.s as Record<string, unknown> | undefined;
  if (source) {
    const sourceCandidates = [
      resolveMetadataSourceUrl(source.u),
      resolveMetadataSourceUrl(source.gif),
      resolveMetadataSourceUrl(source.mp4),
    ];
    for (const candidate of sourceCandidates) {
      if (candidate) {
        return candidate;
      }
    }
  }

  const previewItems = metadata.p as Array<Record<string, unknown>> | undefined;
  if (previewItems?.length) {
    for (const preview of previewItems) {
      const candidate = resolveMetadataSourceUrl(preview.u);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

export function extractImageUrls(raw: Record<string, unknown>): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const addUrl = (value?: string | null) => {
    if (!value) {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    found.push(value);
  };

  const gallery = raw.gallery_data as { items?: Array<{ media_id?: string }> } | undefined;
  const metadata = raw.media_metadata as Record<string, Record<string, unknown>> | undefined;
  if (gallery?.items?.length && metadata) {
    for (const item of gallery.items) {
      const mediaId = item?.media_id;
      const entry = mediaId ? metadata[mediaId] : undefined;
      const url = resolveGalleryMediaUrl(entry);
      addUrl(url);
    }
    if (found.length) {
      return found;
    }
  }

  const preview = (raw.preview as { images?: unknown[] } | undefined)?.images ?? [];
  if (preview.length) {
    const source = (preview[0] as Record<string, unknown>)?.source as Record<string, unknown> | undefined;
    const previewUrl = resolveMetadataSourceUrl(source?.url);
    addUrl(previewUrl);
  }

  return found;
}

function parseBody(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function extractPostCandidate(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate =
    (payload as { data?: unknown }).data ??
    (payload as { result?: unknown }).result ??
    (payload as { post?: unknown }).post ??
    payload;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  if ("data" in candidate && typeof (candidate as { data?: unknown }).data === "object") {
    return (candidate as { data?: Record<string, unknown> }).data ?? null;
  }

  return candidate as Record<string, unknown>;
}

function resolvePostUrl(raw: Record<string, unknown>, fallbackUrl: string): string {
  return ensureString(raw.post_url || raw.url).trim() || fallbackUrl;
}

function logImageMetadataParsing(raw: Record<string, unknown>, fallbackUrl: string) {
  const canonicalUrl = resolvePostUrl(raw, fallbackUrl);
  logIngestInfo("image_extract", {
    message: "Parsing media metadata",
    url: canonicalUrl,
    extra: {
      raw_json_keys: Object.keys(raw),
    },
  });
}

function normalizePost(raw: Record<string, unknown>, fallbackUrl: string): RedditPostNormalized {
  const canonicalUrl = resolvePostUrl(raw, fallbackUrl);
  const images = extractImageUrls(raw);

  if (images.length) {
    logIngestInfo("image_extract", {
      message: "Found images",
      url: canonicalUrl,
      extra: {
        images,
        count: images.length,
      },
    });
  } else {
    logIngestInfo("image_extract", {
      message: "No images found",
      url: canonicalUrl,
    });
  }

  return {
    title: ensureString(raw.title).trim(),
    subreddit: ensureString(raw.subreddit).trim(),
    author: ensureString(raw.author).trim(),
    post_url: canonicalUrl,
    content_html: normalizeHtml(raw.content_html ?? raw.body ?? raw.selftext_html),
    karma: ensureNumber(raw.karma ?? raw.score ?? raw.upvotes),
    comments: normalizeComments(raw.comments),
    images,
  };
}

function readScraperCredentials(): ScraperCredentials | null {
  const username = process.env.DECODO_SCRAPER_USERNAME?.trim();
  const password = process.env.DECODO_SCRAPER_PASSWORD?.trim();
  if (!username || !password) {
    return null;
  }
  return { username, password };
}

function readProxyCredentials(): ProxyCredentials | null {
  const host = process.env.DECODO_PROXY_HOST?.trim();
  const port = process.env.DECODO_PROXY_PORT?.trim();
  const username = process.env.DECODO_PROXY_USERNAME?.trim();
  const password = process.env.DECODO_PROXY_PASSWORD?.trim();
  if (!host || !port || !username || !password) {
    return null;
  }
  return { host, port, username, password };
}

function buildRedditJsonUrl(postUrl: string): string {
  const targetUrl = new URL(postUrl);
  if (!targetUrl.pathname.endsWith(".json")) {
    const trimmedPath = targetUrl.pathname.replace(/\/$/, "");
    targetUrl.pathname = `${trimmedPath}.json`;
  }
  targetUrl.search = "";
  targetUrl.hash = "";
  targetUrl.searchParams.set("raw_json", "1");
  return targetUrl.toString();
}

function resolveRedditCanonical(postData: Record<string, unknown>, fallback: string): string {
  const directUrl = ensureString(postData.url).trim();
  if (directUrl) {
    return directUrl;
  }

  const permalink = ensureString(postData.permalink).trim();
  if (permalink) {
    try {
      return new URL(permalink, REDDIT_BASE).toString();
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function getProxyAgent(proxyUrl: string): ProxyAgent {
  if (cachedProxyUrl === proxyUrl && cachedProxyAgent) {
    return cachedProxyAgent;
  }

  cachedProxyAgent = new ProxyAgent(proxyUrl);
  cachedProxyUrl = proxyUrl;
  return cachedProxyAgent;
}

async function fetchViaScraper(postUrl: string, creds: ScraperCredentials): Promise<RedditPostNormalized> {
  let response: Response;
  try {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
    response = await fetch(DECODO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        target: "reddit_post",
        url: postUrl,
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Decodo scraper path network failure: ${detail}`;
    const errorId = logIngestError("decodo_scraper", {
      message,
      url: postUrl,
      platform: "reddit",
      attempt: "scraper",
      reason: "network",
    });
    throw new DecodoScraperError(
      `${message} (error_id: ${errorId})`,
      undefined,
      undefined,
      false,
      errorId
    );
  }

  const text = await response.text();
  const payload = parseBody(text);

  if (!response.ok) {
    const status = response.status;
    const snippet = redactedSnippet(text);
    const message = "Decodo scraper API request failed";
    const reason = status === 401 || status === 403 ? "auth" : "scraper_response";
    const errorId = logIngestError("decodo_scraper", {
      message,
      url: postUrl,
      platform: "reddit",
      status_code: status,
      attempt: "scraper",
      reason,
    });
    throw new DecodoScraperError(
      `${message} (error_id: ${errorId})`,
      status,
      snippet,
      reason === "auth",
      errorId
    );
  }

  const postCandidate = extractPostCandidate(payload);
  if (!postCandidate) {
    const message = "Decodo scraper path: no reddit_post data returned.";
    const errorId = logIngestError("decodo_scraper", {
      message,
      url: postUrl,
      platform: "reddit",
      attempt: "scraper",
      reason: "data",
    });
    throw new DecodoScraperError(
      `${message} (error_id: ${errorId})`,
      undefined,
      undefined,
      false,
      errorId
    );
  }

  logImageMetadataParsing(postCandidate, postUrl);

  return normalizePost(postCandidate, postUrl);
}

async function fetchViaProxy(postUrl: string, creds: ProxyCredentials): Promise<RedditPostNormalized> {
  const proxyUrl = `http://${encodeURIComponent(creds.username)}:${encodeURIComponent(
    creds.password
  )}@${creds.host}:${creds.port}`;
  const agent = getProxyAgent(proxyUrl);
  const redditJsonUrl = buildRedditJsonUrl(postUrl);

  let response: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    response = await undiciFetch(redditJsonUrl, {
      dispatcher: agent,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Decodo proxy path network failure: ${detail}`;
    const errorId = logIngestError("decodo_proxy", {
      message,
      url: postUrl,
      platform: "reddit",
      attempt: "proxy",
      reason: "network",
    });
    throw new DecodoProxyError(`${message} (error_id: ${errorId})`, undefined, undefined, errorId);
  }

  if (!response.ok) {
    const status = response.status;
    const snippet = redactedSnippet(await response.text());
    const reason =
      status === 403
        ? "forbidden"
        : status === 429
        ? "rate_limit"
        : "reddit_response";
    const message = `Decodo proxy path: Reddit returned ${status}`;
    const errorId = logIngestError("decodo_proxy", {
      message,
      url: postUrl,
      platform: "reddit",
      status_code: status,
      attempt: "proxy",
      reason,
    });
    throw new DecodoProxyError(`${message} (error_id: ${errorId})`, status, snippet, errorId);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Decodo proxy path: invalid JSON response: ${detail}`;
    const errorId = logIngestError("decodo_proxy", {
      message,
      url: postUrl,
      platform: "reddit",
      attempt: "proxy",
      reason: "json",
    });
    throw new DecodoProxyError(`${message} (error_id: ${errorId})`, undefined, undefined, errorId);
  }

  if (!Array.isArray(payload) || payload.length < 2) {
    const message = "Decodo proxy path: unexpected Reddit JSON via proxy path.";
    const errorId = logIngestError("decodo_proxy", {
      message,
      url: postUrl,
      platform: "reddit",
      attempt: "proxy",
      reason: "data",
    });
    throw new DecodoProxyError(`${message} (error_id: ${errorId})`, undefined, undefined, errorId);
  }

  const postListing = payload[0] as RedditListing | undefined;
  const postData = postListing?.data?.children?.[0]?.data;
  if (!postData) {
    const message = "Decodo proxy path: missing Reddit post data.";
    const errorId = logIngestError("decodo_proxy", {
      message,
      url: postUrl,
      platform: "reddit",
      attempt: "proxy",
      reason: "data",
    });
    throw new DecodoProxyError(`${message} (error_id: ${errorId})`, undefined, undefined, errorId);
  }

  const commentsListing = (payload[1] as RedditListing | undefined)?.data?.children ?? [];

  logImageMetadataParsing(postData, postUrl);

  const canonicalUrl = resolveRedditCanonical(postData, postUrl);

  const enrichedRaw: Record<string, unknown> = {
    ...(postData as Record<string, unknown>),
    post_url: canonicalUrl,
    content_html: postData.selftext_html ?? postData.selftext ?? null,
    karma: postData.score ?? postData.ups,
    comments: commentsListing.map((child) => child.data ?? {}),
  };

  return normalizePost(enrichedRaw, postUrl);
}

/**
 * Fetches Reddit post metadata using Decodo.
 *
 * @param postUrl - Reddit post URL (any host variant). Must be server-side only.
 * @returns A normalized RedditPostNormalized shape so callers can stay stable.
 * @throws DecodoScraperError, DecodoProxyError on failures.
 */
export async function fetchRedditPostViaDecodo(postUrl: string): Promise<RedditPostNormalized> {
  if (!postUrl || typeof postUrl !== "string") {
    throw new Error("fetchRedditPostViaDecodo requires a Reddit post URL.");
  }

  const scraperCreds = readScraperCredentials();
  const proxyCreds = readProxyCredentials();

  if (!scraperCreds && !proxyCreds) {
    const message =
      "Missing Decodo credentials. Set DECODO_SCRAPER_USERNAME/PASSWORD or DECODO_PROXY_HOST/PORT/USERNAME/PASSWORD.";
    const errorId = logIngestError("decodo_config", {
      message,
      attempt: "ingest",
      reason: "config",
    });
    throw new Error(`${message} (error_id: ${errorId})`);
  }

  if (scraperCreds) {
    try {
      return await fetchViaScraper(postUrl, scraperCreds);
    } catch (error) {
      if (error instanceof DecodoScraperError) {
        if (error.isAuthError) {
          throw error;
        }
        if (proxyCreds && (!error.status || error.status >= 500)) {
          logIngestInfo("decodo_scraper", {
            message: `Decodo scraper path failure (status: ${error.status}). Falling back to proxy path.`,
            url: postUrl,
            platform: "reddit",
            attempt: "fallback",
          });
          return await fetchViaProxy(postUrl, proxyCreds);
        }
      }

      if (!proxyCreds) {
        throw error;
      }

      logIngestInfo("decodo_scraper", {
        message: "Decodo scraper path failed. Falling back to proxy path.",
        url: postUrl,
        platform: "reddit",
        attempt: "fallback",
      });
      return await fetchViaProxy(postUrl, proxyCreds);
    }
  }

  if (!proxyCreds) {
    throw new Error(
      "Decodo proxy credentials are missing; unable to fetch Reddit post via proxy."
    );
  }

  return await fetchViaProxy(postUrl, proxyCreds);
}
