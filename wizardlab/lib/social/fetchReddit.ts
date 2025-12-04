import { ProxyAgent, fetch as undiciFetch } from "undici";

const DECODO_ENDPOINT = "https://scraper-api.decodo.com/v2/scrape";
const REDDIT_BASE = "https://www.reddit.com";
const USER_AGENT = "Mozilla/5.0 (compatible; WizardLabBot/0.1; +https://wizardfolio.com)";

export type DecodoRedditPost = {
  title: string;
  subreddit: string;
  author: string;
  post_url: string;
  content_html: string;
  karma: number;
  comments: unknown[];
};

type DecodoResponse =
  | {
      success?: boolean;
      data?: unknown;
      result?: unknown;
      post?: unknown;
      error?: unknown;
      message?: string;
    }
  | null
  | undefined;

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

function ensureString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function ensureNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function ensureArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function extractPostCandidate(payload: DecodoResponse): Record<string, unknown> | null {
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

function parseBody(text: string): DecodoResponse {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function normalizePost(raw: Record<string, unknown>, fallbackUrl: string): DecodoRedditPost {
  return {
    title: ensureString(raw.title).trim(),
    subreddit: ensureString(raw.subreddit).trim(),
    author: ensureString(raw.author).trim(),
    post_url: ensureString(raw.post_url || raw.url).trim() || fallbackUrl,
    content_html: ensureString(raw.content_html ?? raw.body ?? raw.selftext_html),
    karma: ensureNumber(raw.karma ?? raw.score ?? raw.upvotes),
    comments: ensureArray(raw.comments),
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

async function fetchViaScraper(postUrl: string, creds: ScraperCredentials): Promise<DecodoRedditPost> {
  let response: Response;
  try {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
    response = await fetch(DECODO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        target: "reddit_post",
        url: postUrl,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to reach Decodo scraper API: ${message}`);
  }

  const text = await response.text();
  const payload = parseBody(text);

  if (!response.ok) {
    throw new Error(
      `Decodo scraper API request failed (${response.status}): ${
        text || response.statusText || "Unknown error"
      }`
    );
  }

  const post = extractPostCandidate(payload);
  if (!post) {
    throw new Error("Decodo scraper response did not include reddit_post data.");
  }

  return normalizePost(post, postUrl);
}

async function fetchViaProxy(postUrl: string, creds: ProxyCredentials): Promise<DecodoRedditPost> {
  const proxyUrl = `http://${encodeURIComponent(creds.username)}:${encodeURIComponent(
    creds.password
  )}@${creds.host}:${creds.port}`;

  let dispatcher: ProxyAgent;
  try {
    dispatcher = new ProxyAgent(proxyUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to configure Decodo proxy agent: ${message}`);
  }

  const redditJsonUrl = buildRedditJsonUrl(postUrl);

  let response: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    response = await undiciFetch(redditJsonUrl, {
      dispatcher,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Decodo proxy fetch failed: ${message}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Decodo proxy request failed (${response.status}) when fetching Reddit JSON: ${
        text || response.statusText || "Unknown error"
      }`
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse Reddit JSON via proxy: ${message}`);
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Unexpected Reddit JSON structure received via proxy.");
  }

  const postListing = payload[0] as RedditListing | undefined;
  const postData = postListing?.data?.children?.[0]?.data;
  if (!postData) {
    throw new Error("Unable to extract Reddit post data via proxy.");
  }

  const commentsListing = (payload[1] as RedditListing | undefined)?.data?.children ?? [];

  return normalizePost(
    {
      title: postData.title,
      subreddit: postData.subreddit,
      author: postData.author,
      post_url: resolveRedditCanonical(postData, postUrl),
      content_html: postData.selftext_html ?? postData.selftext ?? "",
      karma: postData.score ?? postData.ups,
      comments: commentsListing,
    },
    postUrl
  );
}

export async function fetchRedditPostViaDecodo(postUrl: string): Promise<DecodoRedditPost> {
  if (!postUrl || typeof postUrl !== "string") {
    throw new Error("fetchRedditPostViaDecodo requires a reddit post URL.");
  }

  const scraperCreds = readScraperCredentials();
  const proxyCreds = readProxyCredentials();

  if (!scraperCreds && !proxyCreds) {
    throw new Error("Missing Decodo credentials (scraper or proxy env vars must be set).");
  }

  if (scraperCreds) {
    try {
      return await fetchViaScraper(postUrl, scraperCreds);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Decodo scraper credentials failed: ${error.message}`
          : `Decodo scraper credentials failed: ${String(error)}`
      );
    }
  }

  try {
    return await fetchViaProxy(postUrl, proxyCreds as ProxyCredentials);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Decodo proxy credentials failed: ${error.message}`
        : `Decodo proxy credentials failed: ${String(error)}`
    );
  }
}
