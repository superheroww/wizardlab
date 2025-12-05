"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Feedback = {
  type: "success" | "error";
  message: string;
};

const API_ENDPOINT = "/api/social/ingest";
const CRON_ENDPOINT = "/api/social/cron";

export default function ManualIngestCard() {
  const router = useRouter();
  const [redditUrl, setRedditUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);
  const [cronFeedback, setCronFeedback] = useState<Feedback | null>(null);

  const trimmedUrl = redditUrl.trim();
  const canSubmit = !!trimmedUrl && !isLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedUrl) {
      setFeedback({
        type: "error",
        message: "Please paste a Reddit post URL.",
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "reddit",
          url: trimmedUrl,
          source: "manual",
        }),
      });

      if (!response.ok) {
        setFeedback({
          type: "error",
          message: "Failed to ingest this URL. Please try again.",
        });
        return;
      }

      setRedditUrl("");
      setFeedback({ type: "success", message: "Ingested successfully." });
      router.refresh();
    } catch (error) {
      console.error("Manual social ingest failed:", error);
      setFeedback({
        type: "error",
        message: "Failed to ingest this URL. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerCron = async () => {
    setIsTriggeringCron(true);
    setCronFeedback(null);

    try {
      const response = await fetch(CRON_ENDPOINT, {
        method: "POST",
      });

      if (!response.ok) {
        setCronFeedback({
          type: "error",
          message: "Cron trigger failed. Please try again.",
        });
        return;
      }

      setCronFeedback({
        type: "success",
        message: "Phase 2 pipeline triggered.",
      });
      router.refresh();
    } catch (error) {
      console.error("Phase 2 cron trigger failed:", error);
      setCronFeedback({
        type: "error",
        message: "Cron trigger failed. Please try again.",
      });
    } finally {
      setIsTriggeringCron(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-neutral-900">Manual Ingest</h3>
        <p className="text-sm text-neutral-500">
          Paste a Reddit post URL to ingest it into Social Metrics.
        </p>
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="manual-reddit-url"
            className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Reddit post URL
          </label>
          <input
            id="manual-reddit-url"
            name="redditUrl"
            type="url"
            required
            value={redditUrl}
            onChange={(event) => {
              setRedditUrl(event.target.value);
              if (feedback) {
                setFeedback(null);
              }
            }}
            placeholder="https://www.reddit.com/..."
            className="mt-1 block w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-none focus:ring-0"
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex w-full items-center justify-center rounded-xl border border-neutral-900 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
            canSubmit ? "hover:bg-neutral-800" : "cursor-not-allowed bg-neutral-800/60"
          }`}
        >
          {isLoading ? "Ingesting…" : "Ingest"}
        </button>

        {feedback ? (
          <p
            role="status"
            aria-live="polite"
            className={`text-sm ${
              feedback.type === "error" ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </form>

      <div className="mt-6 space-y-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Phase 2 pipeline</p>
          <p className="text-xs text-neutral-500">
            Manually trigger the social cron job (runs phase 2 processing).
          </p>
        </div>
        <button
          type="button"
          onClick={handleTriggerCron}
          disabled={isTriggeringCron}
          className={`w-full rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isTriggeringCron
              ? "cursor-not-allowed border-neutral-200 bg-white text-neutral-400"
              : "border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-100"
          }`}
        >
          {isTriggeringCron ? "Triggering…" : "Run AI"}
        </button>
        {cronFeedback ? (
          <p
            role="status"
            aria-live="polite"
            className={`text-sm ${
              cronFeedback.type === "error" ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {cronFeedback.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
