"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import type { SocialEngageRow } from "./types";

type SortKey = "created_at" | "status" | "should_reply" | "relevance_score" | "title" | "reply_text";
type SortDirection = "asc" | "desc";

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "created_at", label: "Created" },
  { key: "status", label: "Status" },
  { key: "should_reply", label: "Should reply?" },
  { key: "relevance_score", label: "Confidence" },
  { key: "title", label: "Title" },
  { key: "reply_text", label: "Reply preview" },
];

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

const previewSnippet = (text: string | null) => {
  if (!text) return "—";
  return text.length > 20 ? `${text.slice(0, 20)}…` : text;
};

const getSortValue = (row: SocialEngageRow, key: SortKey) => {
  switch (key) {
    case "created_at":
      return row.created_at ? new Date(row.created_at).getTime() : -Infinity;
    case "status":
      return row.status ?? "";
    case "should_reply":
      return row.should_reply === true ? 1 : row.should_reply === false ? 0 : -1;
    case "relevance_score":
      return row.relevance_score ?? -Infinity;
    case "title":
      return row.title ?? "";
    case "reply_text":
      return row.reply_text ?? "";
  }
};

const compareValues = (a: SocialEngageRow, b: SocialEngageRow, key: SortKey) => {
  const left = getSortValue(a, key);
  const right = getSortValue(b, key);
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }
  return 0;
};

const filterOptions: Array<{ label: string; value: "all" | "yes" | "no" }> = [
  { label: "All", value: "all" },
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

interface SocialEngageTableProps {
  rows: SocialEngageRow[];
}

export default function SocialEngageTable({ rows }: SocialEngageTableProps) {
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setCopyMessage(null);
  }, [modalContent]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "yes") return row.should_reply === true;
      if (filter === "no") return row.should_reply === false;
      return true;
    });
  }, [rows, filter]);

  const sortedRows = useMemo(() => {
    const cloned = [...filteredRows];
    cloned.sort((a, b) => {
      const result = compareValues(a, b, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
    return cloned;
  }, [filter, filteredRows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 text-sm text-zinc-600 dark:text-white/70">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-white">Should reply filter:</span>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter === option.value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 dark:text-white/70">
          Showing {filteredRows.length} of {rows.length} rows · sort by clicking column headers
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white/60 shadow-lg shadow-zinc-200/40 dark:border-zinc-700 dark:bg-zinc-950/50">
        <table className="w-full min-w-[780px] divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-sm">
          <thead className="bg-zinc-100/90 text-[0.7rem] uppercase tracking-wide text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300">
            <tr>
              {SORTABLE_COLUMNS.map((column, index) => {
                const isActive = sortKey === column.key;
                const directionIndicator = isActive ? (sortDirection === "asc" ? "▲" : "▼") : "↕";
                const headerClass =
                  "px-4 py-3 text-left font-semibold tracking-wider text-zinc-700 dark:text-zinc-300 whitespace-nowrap";
                return (
                  <Fragment key={`header-${column.key}`}>
                    <th
                      scope="col"
                      className={`${headerClass} cursor-pointer`}
                      onClick={() => toggleSort(column.key)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{column.label}</span>
                        <span className={`text-[0.65rem] ${isActive ? "text-zinc-900 dark:text-white" : "text-zinc-400"}`}>
                          {directionIndicator}
                        </span>
                      </div>
                    </th>
                    {index === 3 && (
                      <th className="px-4 py-3 text-left font-semibold tracking-wider text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                        Permalink
                      </th>
                    )}
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-700 dark:divide-zinc-800 dark:text-zinc-200">
            {sortedRows.map((row) => (
              <tr
                key={row.id}
                className="odd:bg-white even:bg-zinc-50 dark:odd:bg-zinc-900 dark:even:bg-zinc-950 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 max-w-[140px] text-left text-xs font-normal uppercase tracking-tight text-zinc-500">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate">{row.status ?? "—"}</td>
                <td className="px-4 py-3 max-w-[140px] truncate">{formatBoolean(row.should_reply)}</td>
                <td className="px-4 py-3 max-w-[120px] truncate">{formatConfidence(row.relevance_score)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.permalink ? (
                    <a
                      href={row.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline transition-colors hover:text-blue-800 dark:text-sky-300"
                    >
                      Link
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 max-w-[320px] truncate">{row.title || "—"}</td>
                <td className="px-4 py-3 max-w-[420px]">
                  {row.reply_text ? (
                    <button
                      type="button"
                      onClick={() => setModalContent(row.reply_text ?? "")}
                      className="w-full text-left text-sm text-zinc-600 transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      <span className="block text-zinc-600 dark:text-zinc-300">{previewSnippet(row.reply_text)}</span>
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalContent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-8">
          <button
            type="button"
            aria-label="Close reply preview"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModalContent(null)}
          />
        <div className="relative z-10 w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Reply preview</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-400 dark:hover:text-white"
                onClick={async () => {
                  if (!modalContent) return;
                  try {
                    await navigator.clipboard.writeText(modalContent);
                    setCopyMessage("Copied reply text");
                  } catch (err) {
                    setCopyMessage("Copy failed");
                  }
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
                onClick={() => setModalContent(null)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100">
            <p className="whitespace-pre-wrap break-words">{modalContent}</p>
          </div>
          {copyMessage && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{copyMessage}</p>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
