import type { Metadata } from "next";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Social Engagement Stream",
  robots: {
    index: false,
    follow: false,
  },
};

interface SocialEngageRow {
  id: string;
  created_at: string | null;
  platform: string | null;
  permalink: string | null;
  title: string | null;
  body: string | null;
  source: string | null;
  classifier_should_reply: boolean | null;
  classifier_confidence: number | null;
  classifier_reason: string | null;
  reply_text: string | null;
  workflow_status: string | null;
  posted_at: string | null;
}

const SELECT_FIELDS = [
  "id",
  "created_at",
  "platform",
  "permalink",
  "title",
  "body",
  "source",
  "classifier_should_reply",
  "classifier_confidence",
  "classifier_reason",
  "reply_text",
  "workflow_status",
  "posted_at",
].join(",");

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const formatBoolean = (value: boolean | null) => (value === true ? "Yes" : value === false ? "No" : "—");

const formatConfidence = (value: number | null) =>
  value == null || Number.isNaN(value) ? "—" : value.toFixed(2);

const getReplyPreview = (text: string | null) => {
  if (!text) return "—";
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
};

export default async function Page() {
  const { data, error } = await supabaseAdmin
    .from("social_engage")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as SocialEngageRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Social Engagement Stream</h1>
        <p className="text-sm text-zinc-600">
          Debug view of the Gmail/F5Bot → wizardLab AI pipeline. No actions can be taken here.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
        <span>
          Loaded <span className="font-semibold text-zinc-900">{rows.length}</span> rows
        </span>
        <span>Showing latest 100 rows</span>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Error loading social_engage rows</p>
          <p>{error.message}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          No engagement rows found yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-200 shadow-sm">
          <table className="w-full min-w-[700px] divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Platform</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Should reply?</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 font-medium">Permalink</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Reply preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-700">
              {rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-zinc-50">
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">{row.platform ?? "—"}</td>
                  <td className="px-3 py-2">{row.source ?? "—"}</td>
                  <td className="px-3 py-2">{row.workflow_status ?? "—"}</td>
                  <td className="px-3 py-2">{formatBoolean(row.classifier_should_reply)}</td>
                  <td className="px-3 py-2">{formatConfidence(row.classifier_confidence)}</td>
                  <td className="px-3 py-2">
                    {row.permalink ? (
                      <a
                        href={row.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline transition-colors hover:text-blue-800"
                      >
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[220px] truncate">{row.title ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[320px] truncate">{getReplyPreview(row.reply_text)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
