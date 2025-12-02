// app/lab/social-engage/SocialEngageTable.tsx
"use client";

import { useMemo, useState } from "react";
import type { SocialEngageRow } from "./types";

type Props = {
  rows: SocialEngageRow[];
  // "status" enables Ready / Others toggle
  filterMode?: "status" | "none";
};

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: keyof SocialEngageRow | "created_at";
  direction: SortDirection;
};

type StatusFilter = "all" | "ready" | "others";

export default function SocialEngageTable({ rows, filterMode = "none" }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc",
  });

  const [modalRow, setModalRow] = useState<SocialEngageRow | null>(null);

  const filteredRows = useMemo(() => {
    let current = [...rows];

    if (filterMode === "status") {
      if (statusFilter === "ready") {
        current = current.filter((row) => row.status?.toLowerCase() === "ready");
      } else if (statusFilter === "others") {
        current = current.filter((row) => row.status?.toLowerCase() !== "ready");
      }
    }

    return current;
  }, [rows, filterMode, statusFilter]);

  const sortedRows = useMemo(() => {
    const { key, direction } = sortConfig;
    const dirFactor = direction === "asc" ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      const aValue = a[key as keyof SocialEngageRow];
      const bValue = b[key as keyof SocialEngageRow];

      // created_at sort
      if (key === "created_at") {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return (aDate - bDate) * dirFactor;
      }

      // numbers
      if (typeof aValue === "number" || typeof bValue === "number") {
        const aNum = Number(aValue ?? 0);
        const bNum = Number(bValue ?? 0);
        return (aNum - bNum) * dirFactor;
      }

      // strings / null
      const aStr = (aValue ?? "") as string;
      const bStr = (bValue ?? "") as string;
      return aStr.localeCompare(bStr) * dirFactor;
    });
  }, [filteredRows, sortConfig]);

  function toggleSort(key: SortConfig["key"]) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  }

  async function handleCopyAndOpen(row: SocialEngageRow) {
    const text = row.ai_reply_draft || row.reply_text || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }

    setModalRow(null);

    if (row.permalink) {
      window.open(row.permalink, "_blank", "noopener,noreferrer");
    }
  }

  function shortDateTime(value: string | null) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  }

  function truncate(text: string | null | undefined, max = 80) {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max) + "…";
  }

  const hasRows = sortedRows.length > 0;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      {filterMode === "status" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs sm:text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="font-medium text-zinc-800 dark:text-zinc-100">
            Status filter
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
            <FilterChip
              label="All"
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            <FilterChip
              label="Ready"
              active={statusFilter === "ready"}
              onClick={() => setStatusFilter("ready")}
            />
            <FilterChip
              label="Others"
              active={statusFilter === "others"}
              onClick={() => setStatusFilter("others")}
            />
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        {hasRows ? (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <SortableHeader
                  label="Created"
                  onClick={() => toggleSort("created_at")}
                  active={sortConfig.key === "created_at"}
                  direction={sortConfig.direction}
                  className="whitespace-nowrap px-4 py-2"
                />
                <SortableHeader
                  label="Title / Body"
                  onClick={() => toggleSort("title")}
                  active={sortConfig.key === "title"}
                  direction={sortConfig.direction}
                  className="px-4 py-2"
                />
                <SortableHeader
                  label="Score"
                  onClick={() => toggleSort("relevance_score")}
                  active={sortConfig.key === "relevance_score"}
                  direction={sortConfig.direction}
                  className="px-4 py-2 text-right"
                />
                <SortableHeader
                  label="Status"
                  onClick={() => toggleSort("status")}
                  active={sortConfig.key === "status"}
                  direction={sortConfig.direction}
                  className="px-4 py-2"
                />
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  AI reply
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sortedRows.map((row) => {
                const canReply = !!(row.ai_reply_draft || row.reply_text);

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {shortDateTime(row.created_at)}
                    </td>
                    <td className="max-w-md px-4 py-2 text-xs">
                      <div className="line-clamp-1 font-medium text-zinc-900 dark:text-zinc-50">
                        {row.title || "(no title)"}
                      </div>
                      <div className="line-clamp-2 text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                        {truncate(row.body, 120)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-zinc-700 dark:text-zinc-200">
                      {row.relevance_score != null
                        ? row.relevance_score.toFixed(2)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-xs">
                      <button
                        type="button"
                        onClick={() => canReply && setModalRow(row)}
                        disabled={!canReply}
                        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[0.7rem] font-medium transition ${
                          canReply
                            ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                            : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                        }`}
                      >
                        {canReply ? "View reply" : "No reply"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">
            No rows match this filter.
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {hasRows ? (
          sortedRows.map((row) => {
            const canReply = !!(row.ai_reply_draft || row.reply_text);

            return (
              <div
                key={row.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-2 flex justify-end">
                  <StatusBadge value={row.status} />
                </div>

                <div className="mb-2">
                  <div className="line-clamp-2 text-[0.8rem] font-medium text-zinc-900 dark:text-zinc-50">
                    {row.title || "(no title)"}
                  </div>
                  <div className="mt-1 line-clamp-3 text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                    {truncate(row.body, 140)}
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between text-[0.65rem] text-zinc-500 dark:text-zinc-400">
                  <span>{shortDateTime(row.created_at)}</span>
                  {row.relevance_score != null && (
                    <span>Score {row.relevance_score.toFixed(2)}</span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (row.permalink) {
                        window.open(row.permalink, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-[0.65rem] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    Open post
                  </button>
                  <button
                    type="button"
                    onClick={() => canReply && setModalRow(row)}
                    disabled={!canReply}
                    className={`rounded-full px-3 py-1 text-[0.65rem] font-medium ${
                      canReply
                        ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                    }`}
                  >
                    {canReply ? "AI reply" : "No reply"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            No rows match this filter.
          </div>
        )}
      </div>

      {/* Modal for AI reply */}
      {modalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  AI reply draft
                </h2>
                <p className="text-[0.7rem] text-zinc-500 dark:text-zinc-400">
                  {shortDateTime(modalRow.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalRow(null)}
                className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Close
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100">
              <pre className="whitespace-pre-wrap text-[0.8rem] leading-relaxed">
                {modalRow.ai_reply_draft ||
                  modalRow.reply_text ||
                  "(No reply text found)"}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 text-[0.75rem] dark:border-zinc-800">
              <div className="truncate text-zinc-500 dark:text-zinc-400">
                {modalRow.permalink || "No permalink"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalRow(null)}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyAndOpen(modalRow)}
                  className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Copy & open post
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Small reusable pieces */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[0.7rem] font-medium transition ${
        active
          ? "bg-zinc-900 text-zinc-50 shadow-sm dark:bg-zinc-50 dark:text-zinc-900"
          : "bg-transparent text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-700/70"
      }`}
    >
      {label}
    </button>
  );
}

function SortableHeader({
  label,
  onClick,
  active,
  direction,
  className,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  direction: SortDirection;
  className?: string;
}) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <span>{label}</span>
        <span className="text-[0.6rem]">
          {active ? (direction === "asc" ? "▲" : "▼") : "⋮"}
        </span>
      </button>
    </th>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  const label = value ?? "Unknown";
  const normalized = label.toLowerCase();
  let base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium capitalize ";
  let variant = "bg-zinc-100 text-zinc-700";
  if (normalized === "ready") variant = "bg-emerald-100 text-emerald-700";
  else if (normalized === "pending") variant = "bg-amber-100 text-amber-700";
  else if (normalized === "posted") variant = "bg-blue-100 text-blue-700";

  return <span className={base + variant}>{label}</span>;
}
