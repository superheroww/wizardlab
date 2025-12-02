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

/**
 * Previously this helper normalized the incoming Reddit URL (e.g. https://www.reddit.com/comments/${id})
 * and performed a GET against that canonical URL with an Accept header covering HTML/XHTML/XML and a wildcard star-slash-star mime type,
 * plus User-Agent: "Mozilla/5.0 (compatible; WizardLabBot/0.1; +https://wizardfolio.com)".
 * The current implementation just maps the payload fields without issuing any network requests.
 */
export function resolveRedditPostFromUrl(
  payload: SocialIngestPayload
): ResolvedRedditPost {
  return {
    platform: normalizeString(payload.platform) ?? DEFAULT_PLATFORM,
    source: normalizeString(payload.source) ?? DEFAULT_SOURCE,
    canonical_url: normalizeString(payload.url),
    external_id: normalizeString(payload.external_id),
    title: normalizeString(payload.f5bot_subject),
    body: normalizeString(payload.f5bot_snippet),
  };
}
