import { randomUUID } from "crypto";

type AttemptType = "scraper" | "proxy" | "fallback" | "ingest" | "enrich";

type BaseLog = {
  tag: "social_ingest";
  context: string;
  message: string;
  url?: string;
  platform?: string;
  status_code?: number;
  reason?: string;
  attempt?: AttemptType;
  redacted?: boolean;
  error_id?: string;
  ts: string;
};

type LogParams = {
  message: string;
  url?: string;
  platform?: string;
  status_code?: number;
  reason?: string;
  attempt?: AttemptType;
  extra?: Record<string, unknown>;
};

const sensitivePatterns = [
  /authorization:\s*basic\s+[^\s,]+/gi,
  /https?:\/\/[^@\s]+@/gi,
];

function sanitizeMessage(raw: string): { sanitized: string; redacted: boolean } {
  let sanitized = raw;
  let redacted = false;
  for (const pattern of sensitivePatterns) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, "**redacted**");
      redacted = true;
    }
    pattern.lastIndex = 0;
  }
  if (sanitized.length > 400) {
    sanitized = `${sanitized.slice(0, 400)}...`;
  }
  return { sanitized, redacted };
}

export function logIngestInfo(context: string, params: LogParams) {
  const timestamp = new Date().toISOString();
  const { sanitized } = sanitizeMessage(params.message);
  const payload: BaseLog = {
    tag: "social_ingest",
    context,
    message: sanitized,
    url: params.url,
    platform: params.platform,
    status_code: params.status_code,
    reason: params.reason,
    attempt: params.attempt,
    redacted: false,
    ts: timestamp,
  };

  const merged = params.extra
    ? { ...payload, ...params.extra }
    : payload;

  console.log(JSON.stringify(merged));
}

export function logIngestError(context: string, params: LogParams): string {
  const timestamp = new Date().toISOString();
  const { sanitized, redacted } = sanitizeMessage(params.message);
  const error_id = randomUUID();
  const payload: BaseLog = {
    tag: "social_ingest",
    context,
    message: sanitized,
    url: params.url,
    platform: params.platform,
    status_code: params.status_code,
    reason: params.reason,
    attempt: params.attempt,
    redacted,
    error_id,
    ts: timestamp,
  };
  const merged = params.extra ? { ...payload, ...params.extra } : payload;
  console.error(JSON.stringify(merged));
  return error_id;
}
