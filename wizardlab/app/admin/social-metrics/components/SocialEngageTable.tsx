"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/social/StatusPill";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { normalizeStatus } from "@/lib/social/statusMeta";
import type { KnownStatus } from "@/lib/social/statusMeta";
import { useSocialPostHandler } from "@/hooks/useSocialPostHandler";
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

type SortKey = "created_at" | "title" | "ai_priority" | "status";
type StatusFilter = "all" | KnownStatus;

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "ignored", label: "Ignored" },
  { key: "error", label: "Error" },
  { key: "duplicate_semantic", label: "Duplicates" },
  { key: "posted", label: "Posted" },
];

const sortableKeys: SortKey[] = [
  "created_at",
  "title",
  "ai_priority",
  "status",
];

const columns: ColumnDef[] = [
  { key: "created_at", label: "Created" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
  { key: "ai_priority", label: "Priority" },
  { key: "title", label: "Title / Body" },
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
  const { handlePost } = useSocialPostHandler();

  const filteredRows = useMemo(() => {
    if (filterMode !== "status") return rows;
    if (statusFilter === "all") return rows;
    return rows.filter(
      (row) => normalizeStatus(row.status) === statusFilter
    );
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
    const canReply = !!row.ai_reply_draft;
    const isReady = row.status?.toLowerCase() === "ready";
    const priorityLabel = row.ai_priority || "—";

    return {
      created_at: (
        <span className="whitespace-nowrap text-neutral-700">
          {shortDateTime(row.created_at)}
        </span>
      ),
      status: <StatusPill status={row.status} variant="compact" />,
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
            <ActionButton
              label="Post"
              onClick={() => {
                setModalRow(null);
                void handlePost(row);
              }}
            />
          ) : null}
        </div>
      ),
      ai_priority: (
        <span className="capitalize text-sm text-neutral-700">
          {priorityLabel}
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
          {row.ai_reason ? (
            <div className="line-clamp-1 text-[0.7rem] uppercase text-neutral-400">
              {row.ai_reason}
            </div>
          ) : null}
        </div>
      ),
    };
  });

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      {filterMode === "status" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-neutral-600">
            <span>Quick filters</span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="text-xs uppercase tracking-wide text-neutral-400 hover:text-neutral-600"
            >
              Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200 bg-white/90 p-3 shadow-sm sm:gap-3">
            {STATUS_FILTERS.map((filter) => (
              <FilterChip
                key={filter.key}
                label={filter.label}
                active={statusFilter === filter.key}
                onClick={() => setStatusFilter(filter.key)}
              />
            ))}
          </div>
        </div>
      ) : null}

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
                {modalRow.ai_reply_draft || "(No reply text found)"}
              </pre>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-[0.85rem]">
              <div className="truncate text-neutral-500">
                {modalRow.permalink || "No permalink"}
              </div>
              <div className="flex items-center gap-2">
                <ActionButton
                  label="Cancel"
                  variant="ghost"
                  onClick={() => setModalRow(null)}
                />
                <ActionButton
                  label="Post"
                  onClick={() => {
                    const row = modalRow;
                    setModalRow(null);
                    void handlePost(row);
                  }}
                />
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
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
      }`}
    >
      {label}
    </button>
  );
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
  const base =
    "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  const styles =
    variant === "ghost"
      ? "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
      : "border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${
        disabled
          ? "cursor-not-allowed border border-dashed border-neutral-200 bg-neutral-100 text-neutral-400"
          : styles
      }`}
    >
      {label}
    </button>
  );
}

function isSortKey(key: string): key is SortKey {
  return sortableKeys.includes(key as SortKey);
}
