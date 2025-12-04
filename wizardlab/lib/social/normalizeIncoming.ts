/**
 * Social ingestion payload normalization lives server-side only.
 * Ingested payloads must be shape `{ platform, url, ... }`.
 * Anything else stays in `extra` so downstream code is platform-agnostic.
 */
export type RawSocialIngestPayload = Record<string, unknown>;

export type NormalizedSocialIngestPayload = {
  platform: string;
  raw_source_url: string;
  permalink: string;
  source: string | null;
  external_id: string | null;
  extra: Record<string, unknown>;
};

function ensureString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid ${field}.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Missing or invalid ${field}.`);
  }
  return trimmed;
}

function ensureUrl(value: string, field: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`Malformed ${field}.`);
  }
}

export function normalizeSocialIngestPayload(
  payload: RawSocialIngestPayload
): NormalizedSocialIngestPayload {
  const {
    platform: platformRaw,
    url: urlRaw,
    external_id: externalIdRaw,
    source: sourceRaw,
    ...extra
  } = payload;

  const platform = ensureString(platformRaw, "platform");
  const rawUrl = ensureUrl(ensureString(urlRaw, "url"), "url");

  const source =
    typeof sourceRaw === "string" ? sourceRaw.trim() || null : null;
  const externalId =
    typeof externalIdRaw === "string" ? externalIdRaw.trim() || null : null;

  return {
    platform,
    raw_source_url: rawUrl,
    permalink: rawUrl,
    source,
    external_id: externalId,
    extra,
  };
}
