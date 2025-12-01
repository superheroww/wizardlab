"use client";

import { Fragment, useMemo, useState } from "react";

import type { SocialEngageRow } from "./types";

type SortKey = "created_at" | "platform" | "source" | "status" | "should_reply" | "relevance_score" | "title" | "reply_text";
type SortDirection = "asc" | "desc";

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "created_at", label: "Created" },
  { key: "platform", label: "Platform" },
  { key: "source", label: "Source" },
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

const getSortValue = (row: SocialEngageRow, key: SortKey) => {
  switch (key) {
    case "created_at":
      return row.created_at ? new Date(row.created_at).getTime() : -Infinity;
    case "platform":
      return row.platform ?? "";
    case "source":
      return row.source ?? "";
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 text-sm text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900">Should reply filter:</span>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filter === option.value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Showing {filteredRows.length} of {rows.length} rows · sort by clicking column headers
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 shadow-sm">
        <table className="w-full min-w-[780px] divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              {SORTABLE_COLUMNS.map((column, index) => {
                const isActive = sortKey === column.key;
                const directionIndicator = isActive ? (sortDirection === "asc" ? "▲" : "▼") : "↕";
                return (
                  <Fragment key={`header-${column.key}`}>
                    {index === 6 && (
                      <th scope="col" className="px-3 py-2 font-medium">
                        Permalink
                      </th>
                    )}
                    <th
                      scope="col"
                      className="cursor-pointer px-3 py-2 font-medium"
                      onClick={() => toggleSort(column.key)}
                    >
                      <div className="flex items-center gap-1">
                        <span>{column.label}</span>
                        <span className={`text-[0.65rem] ${isActive ? "text-zinc-900" : "text-zinc-400"}`}>
                          {directionIndicator}
                        </span>
                      </div>
                    </th>
                  </Fragment>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-zinc-700">
            {sortedRows.map((row) => (
              <tr key={row.id} className="odd:bg-white even:bg-zinc-50">
                <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2">{row.platform ?? "—"}</td>
                <td className="px-3 py-2">{row.source ?? "—"}</td>
                <td className="px-3 py-2">{row.status ?? "—"}</td>
                <td className="px-3 py-2">{formatBoolean(row.should_reply)}</td>
                <td className="px-3 py-2">{formatConfidence(row.relevance_score)}</td>
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
                <td className="px-3 py-2 whitespace-pre-wrap break-words">{row.title || "—"}</td>
                <td className="px-3 py-2 whitespace-pre-wrap break-words">{row.reply_text || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
