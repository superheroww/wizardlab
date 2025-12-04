const DECODO_ENDPOINT = "https://scraper-api.decodo.com/v2/scrape";

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

  // Sometimes APIs wrap the real data under a nested "data" field as well.
  if ("data" in candidate && typeof (candidate as { data?: unknown }).data === "object") {
    return (candidate as { data?: Record<string, unknown> }).data ?? null;
  }

  return candidate as Record<string, unknown>;
}

function extractErrorMessage(payload: DecodoResponse, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const errorValue =
    (payload as { error?: unknown }).error ??
    (payload as { message?: unknown }).message ??
    (payload as { data?: { error?: unknown; message?: unknown } }).data?.error ??
    (payload as { data?: { error?: unknown; message?: unknown } }).data?.message;

  if (typeof errorValue === "string" && errorValue.trim()) {
    return errorValue.trim();
  }

  if (errorValue && typeof errorValue === "object") {
    const message = (errorValue as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
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

export async function fetchRedditPostViaDecodo(postUrl: string): Promise<DecodoRedditPost> {
  if (!postUrl || typeof postUrl !== "string") {
    throw new Error("fetchRedditPostViaDecodo requires a reddit post URL.");
  }

  const apiKey = process.env.DECODO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DECODO_API_KEY is not configured. Unable to call Decodo Scraper API.");
  }

  let response: Response;
  try {
    response = await fetch(DECODO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        target: "reddit_post",
        url: postUrl,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to reach Decodo Scraper API: ${message}`);
  }

  const text = await response.text();
  const payload = parseBody(text);

  if (!response.ok) {
    const reason = extractErrorMessage(payload, response.statusText || "Unknown error");
    throw new Error(`Decodo request failed (${response.status}): ${reason}`);
  }

  const post = extractPostCandidate(payload);
  if (!post) {
    throw new Error("Decodo response did not include reddit_post data.");
  }

  return normalizePost(post, postUrl);
}
