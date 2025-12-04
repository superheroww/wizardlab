"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/social/StatusPill";
import type { SocialEngageRow } from "../types";

type SocialEngageDrawerProps = {
  open: boolean;
  onClose: () => void;
  row: SocialEngageRow | null;
};

const metadataLabelClasses =
  "text-xs font-semibold uppercase tracking-wide text-neutral-400";

export default function SocialEngageDrawer({
  open,
  onClose,
  row,
}: SocialEngageDrawerProps) {
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">(
    "idle"
  );

  const columnId = "social-engage-drawer";

  const {
    readableDate,
    subreddit,
    originalPost,
    aiReason,
    extraJson,
    aiResultText,
  } = useMemo(() => {
    if (!row) {
      return {
        readableDate: "",
        subreddit: "",
        originalPost: "",
        aiReason: "",
        extraJson: "",
        aiResultText: "",
      };
    }

    return {
      readableDate: formatDate(row.created_at),
      subreddit: inferSubreddit(row),
      originalPost: row.ai_input || "",
      aiReason: row.ai_reason || "",
      extraJson: stringifyMaybeJson(row.extra),
      aiResultText: formatAiResult(row),
    };
  }, [row]);

  if (!open || !row) {
    return null;
  }

  const permalink = row.permalink;
  const canCopy = !!aiResultText;

  async function handleCopyReply() {
    if (!aiResultText) return;
    try {
      await copyToClipboard(aiResultText);
      setCopyFeedback("copied");
      window.setTimeout(() => setCopyFeedback("idle"), 2000);
    } catch (error) {
      console.error("social_drawer: clipboard_failed", error);
      setCopyFeedback("error");
      window.setTimeout(() => setCopyFeedback("idle"), 2500);
    }
  }

  function handleOpenReddit() {
    if (!permalink) return;
    window.open(permalink, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${columnId}-title`}
        className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-white/10 bg-neutral-900 text-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p
              id={`${columnId}-title`}
              className="text-base font-semibold text-white"
            >
              Post details
            </p>
            <p className="text-xs text-neutral-400">{readableDate || "Unknown"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="space-y-2 border-b border-white/5 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {subreddit ? (
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-white/80">
                  r/{subreddit}
                </span>
              ) : null}
              {row.source ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs font-medium uppercase tracking-wide text-white/60">
                  {row.source}
                </span>
              ) : null}
              <StatusPill status={row.status} variant="compact" />
            </div>
            <dl className="grid grid-cols-1 gap-3 text-sm text-white/90 sm:grid-cols-2">
              <div>
                <dt className={metadataLabelClasses}>Status</dt>
                <dd className="mt-0.5 capitalize">{row.status || "Unknown"}</dd>
              </div>
              <div>
                <dt className={metadataLabelClasses}>Created</dt>
                <dd className="mt-0.5">{readableDate || "Unknown"}</dd>
              </div>
              {row.permalink ? (
                <div className="sm:col-span-2">
                  <dt className={metadataLabelClasses}>Permalink</dt>
                  <dd className="mt-0.5 break-all text-xs text-blue-200">
                    {row.permalink}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <Section title="Original Post (ai_input)" content={originalPost} />
          <Section title="AI Reasoning (ai_reason)" content={aiReason} />
          <Section title="Extra Metadata (extra)" content={extraJson} isCode />
          <Section
            title="AI Draft Reply (ai_result)"
            content={aiResultText || "(No AI reply available.)"}
            isCode
          />
        </div>

        <footer className="border-t border-white/10 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleCopyReply}
              disabled={!canCopy}
              className={`flex-1 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold transition ${
                canCopy
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "cursor-not-allowed bg-white/5 text-white/40"
              }`}
            >
              {copyFeedback === "copied"
                ? "Copied!"
                : copyFeedback === "error"
                ? "Copy failed"
                : "Copy reply"}
            </button>
            <button
              type="button"
              onClick={handleOpenReddit}
              disabled={!permalink}
              className={`flex-1 rounded-xl border border-transparent px-4 py-2 text-sm font-semibold transition ${
                permalink
                  ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  : "cursor-not-allowed bg-white/5 text-white/40"
              }`}
            >
              Open Reddit
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function Section({
  title,
  content,
  isCode = false,
}: {
  title: string;
  content: string;
  isCode?: boolean;
}) {
  return (
    <section className="border-b border-white/5 py-4 last:border-b-0">
      <p className={metadataLabelClasses}>{title}</p>
      <div
        className={`mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm ${
          isCode ? "font-mono text-xs leading-relaxed" : "leading-relaxed"
        }`}
      >
        <pre className="whitespace-pre-wrap break-words text-white/90">
          {content || "—"}
        </pre>
      </div>
    </section>
  );
}

async function copyToClipboard(text: string) {
  if (!text) return;
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function formatDate(value: string | Date | null) {
  if (!value) return "";
  try {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return typeof value === "string" ? value : "";
  }
}

function stringifyMaybeJson(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function inferSubreddit(row: SocialEngageRow) {
  if (row.subreddit) return row.subreddit;
  const extraObj = asRecord(row.extra);
  const metadata = asRecord(extraObj ? extraObj["reddit_metadata"] : undefined);
  const candidate = metadata ? metadata["subreddit"] : undefined;
  return typeof candidate === "string" ? candidate : "";
}

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function formatAiResult(row: SocialEngageRow) {
  if (typeof row.ai_result === "string") {
    return row.ai_result.trim();
  }
  if (row.ai_result && typeof row.ai_result === "object") {
    try {
      return JSON.stringify(row.ai_result, null, 2);
    } catch {
      return String(row.ai_result);
    }
  }
  if (row.ai_reply_draft) {
    return row.ai_reply_draft;
  }
  return "";
}
