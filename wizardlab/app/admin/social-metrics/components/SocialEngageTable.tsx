"use client";

import { useMemo, useState } from "react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import type { SocialEngageRow } from "../types";

type Props = {
  rows: SocialEngageRow[];
  filterMode?: "status" | "none";
};

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

type SortKey = "created_at" | "title" | "relevance_score" | "status";
type StatusFilter = "all" | "ready" | "others";
const sortableKeys: SortKey[] = [
  "created_at",
  "title",
  "relevance_score",
  "status",
];

const columns: ColumnDef[] = [
  { key: "created_at", label: "Created" },
  { key: "title", label: "Title / Body" },
  { key: "relevance_score", label: "Score", isNumeric: true },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

export default function SocialEngageTable({
  rows,
  filterMode = "none",
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc",
  });
  const [modalRow, setModalRow] = useState<SocialEngageRow | null>(null);

  const filteredRows = useMemo(() => {
    if (filterMode !== "status") return rows;
    if (statusFilter === "ready") {
      return rows.filter((row) => row.status?.toLowerCase() === "ready");
    }
    if (statusFilter === "others") {
      return rows.filter((row) => row.status?.toLowerCase() !== "ready");
    }
    return rows;
  }, [filterMode, rows, statusFilter]);

  const sortedRows = useMemo(() => {
    const { key, direction } = sortConfig;
    const dirFactor = direction === "asc" ? 1 : -1;

    return [...filteredRows].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];

      if (key === "created_at") {
        const aDate = aValue ? new Date(aValue).getTime() : 0;
        const bDate = bValue ? new Date(bValue).getTime() : 0;
        return (aDate - bDate) * dirFactor;
      }

      if (typeof aValue === "number" || typeof bValue === "number") {
        const aNum = Number(aValue ?? 0);
        const bNum = Number(bValue ?? 0);
        return (aNum - bNum) * dirFactor;
      }

      const aStr = String(aValue ?? "");
      const bStr = String(bValue ?? "");
      return aStr.localeCompare(bStr) * dirFactor;
    });
  }, [filteredRows, sortConfig]);

  const handleSortChange = (key: string) => {
    if (!isSortKey(key)) return;
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  async function handlePost(row: SocialEngageRow) {
    const text = row.ai_reply_draft || row.reply_text || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy reply text", err);
    }

    setModalRow(null);

    if (row.permalink) {
      window.open(row.permalink, "_blank", "noopener,noreferrer");
    }

    try {
      await fetch("/api/social/mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
    } catch (err) {
      console.error("Failed to mark row as posted", err);
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

  const tableRows = sortedRows.map((row) => {
    const canReply = !!(row.ai_reply_draft || row.reply_text);
    const isReady = row.status?.toLowerCase() === "ready";

    return {
      created_at: (
        <span className="whitespace-nowrap text-neutral-700">
          {shortDateTime(row.created_at)}
        </span>
      ),
      title: (
        <div className="min-w-[18rem] space-y-1">
          <div className="line-clamp-1 text-sm font-medium text-neutral-900">
            {row.title || "(no title)"}
          </div>
          <div className="line-clamp-2 text-[0.8rem] text-neutral-500">
            {truncate(row.body, 140)}
          </div>
        </div>
      ),
      relevance_score:
        row.relevance_score != null
          ? row.relevance_score.toFixed(2)
          : "—",
      status: <StatusBadge value={row.status} />,
      actions: (
        <div className="flex flex-wrap justify-end gap-2">
          <ActionButton
            label="Open"
            onClick={() => {
              if (row.permalink) {
                window.open(row.permalink, "_blank", "noopener,noreferrer");
              }
            }}
            variant="ghost"
          />
          <ActionButton
            label="AI reply"
            onClick={() => canReply && setModalRow(row)}
            disabled={!canReply}
          />
          {isReady && canReply ? (
            <ActionButton label="Post" onClick={() => handlePost(row)} />
          ) : null}
        </div>
      ),
    };
  });

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      {filterMode === "status" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs sm:text-sm">
          <div className="font-medium text-neutral-800">Status filter</div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white p-1">
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

      <DataTable
        columns={columns}
        rows={tableRows}
        sortKey={sortConfig.key}
        sortDirection={sortConfig.direction}
        onSortChange={handleSortChange}
        emptyMessage={
          hasRows ? "No rows match this filter." : "No engagement rows yet."
        }
      />

      {modalRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-neutral-900">
                  AI reply draft
                </h2>
                <p className="text-[0.75rem] text-neutral-500">
                  {shortDateTime(modalRow.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalRow(null)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto px-4 py-3 text-sm text-neutral-800">
              <pre className="whitespace-pre-wrap text-[0.9rem] leading-relaxed">
                {modalRow.ai_reply_draft ||
                  modalRow.reply_text ||
                  "(No reply text found)"}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-[0.85rem]">
              <div className="truncate text-neutral-500">
                {modalRow.permalink || "No permalink"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalRow(null)}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePost(modalRow)}
                  className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
      className={`rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-transparent text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  const label = value ?? "Unknown";
  const normalized = label.toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium capitalize ";
  let variant = "bg-neutral-100 text-neutral-700";
  if (normalized === "ready") variant = "bg-emerald-100 text-emerald-700";
  else if (normalized === "pending") variant = "bg-amber-100 text-amber-700";
  else if (normalized === "posted") variant = "bg-blue-100 text-blue-700";

  return <span className={base + variant}>{label}</span>;
}

function ActionButton({
  label,
  onClick,
  disabled,
  variant = "solid",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  const styles =
    variant === "ghost"
      ? "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
      : "bg-neutral-900 text-white hover:bg-neutral-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-[0.75rem] font-medium transition ${
        disabled ? "cursor-not-allowed bg-neutral-100 text-neutral-400" : styles
      }`}
    >
      {label}
    </button>
  );
}

function isSortKey(key: string): key is SortKey {
  return sortableKeys.includes(key as SortKey);
}
