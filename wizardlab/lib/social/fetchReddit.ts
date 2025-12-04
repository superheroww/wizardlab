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
    public isAuthError = false
  ) {
    super(message);
  }
}

class DecodoProxyError extends Error {
  constructor(message: string, public status?: number, public bodySnippet?: string) {
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

function normalizePost(raw: Record<string, unknown>, fallbackUrl: string): RedditPostNormalized {
  return {
    title: ensureString(raw.title).trim(),
    subreddit: ensureString(raw.subreddit).trim(),
    author: ensureString(raw.author).trim(),
    post_url: ensureString(raw.post_url || raw.url).trim() || fallbackUrl,
    content_html: normalizeHtml(raw.content_html ?? raw.body ?? raw.selftext_html),
    karma: ensureNumber(raw.karma ?? raw.score ?? raw.upvotes),
    comments: normalizeComments(raw.comments),
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
    const message = error instanceof Error ? error.message : String(error);
    throw new DecodoScraperError(`Decodo scraper path network failure: ${message}`);
  }

  const text = await response.text();
  const payload = parseBody(text);

  if (!response.ok) {
    const status = response.status;
    const snippet = redactedSnippet(text);
    throw new DecodoScraperError(
      `Decodo scraper API request failed`,
      status,
      snippet,
      status === 401 || status === 403
    );
  }

  const postCandidate = extractPostCandidate(payload);
  if (!postCandidate) {
    throw new DecodoScraperError("Decodo scraper path: no reddit_post data returned.");
  }

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
    const message = error instanceof Error ? error.message : String(error);
    throw new DecodoProxyError(`Decodo proxy path network failure: ${message}`);
  }

  if (!response.ok) {
    const status = response.status;
    const snippet = redactedSnippet(await response.text());
    throw new DecodoProxyError(`Decodo proxy path: Reddit returned ${status}`, status, snippet);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DecodoProxyError(`Decodo proxy path: invalid JSON response: ${message}`);
  }

  if (!Array.isArray(payload) || payload.length < 2) {
    throw new DecodoProxyError("Unexpected Reddit JSON via proxy path.");
  }

  const postListing = payload[0] as RedditListing | undefined;
  const postData = postListing?.data?.children?.[0]?.data;
  if (!postData) {
    throw new DecodoProxyError("Decodo proxy path: missing Reddit post data.");
  }

  const commentsListing = (payload[1] as RedditListing | undefined)?.data?.children ?? [];

  return normalizePost(
    {
      title: postData.title,
      subreddit: postData.subreddit,
      author: postData.author,
      post_url: resolveRedditCanonical(postData, postUrl),
      content_html: postData.selftext_html ?? postData.selftext ?? null,
      karma: postData.score ?? postData.ups,
      comments: commentsListing.map((child) => child.data ?? {}),
    },
    postUrl
  );
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
    throw new Error(
      "Missing Decodo credentials. Set DECODO_SCRAPER_USERNAME/PASSWORD or DECODO_PROXY_HOST/PORT/USERNAME/PASSWORD."
    );
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
          console.warn(
            `Decodo scraper path failure (status: ${error.status}). Falling back to proxy path.`
          );
          return await fetchViaProxy(postUrl, proxyCreds);
        }
      }

      if (!proxyCreds) {
        throw error;
      }

      console.warn("Decodo scraper path failed. Falling back to proxy path.");
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
