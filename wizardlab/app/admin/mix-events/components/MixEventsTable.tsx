"use client";

import { useMemo, useState } from "react";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import type { MixEventsTableRow } from "../types";

type SortKey = keyof Pick<
  MixEventsTableRow,
  | "createdAt"
  | "source"
  | "templateKey"
  | "benchmarkSymbol"
  | "referrer"
  | "anonId"
  | "positions"
>;

const columns: ColumnDef[] = [
  { key: "createdAt", label: "Created" },
  { key: "source", label: "Source" },
  { key: "templateKey", label: "Template" },
  { key: "benchmarkSymbol", label: "Benchmark" },
  { key: "referrer", label: "Referrer" },
  { key: "anonId", label: "Anon ID" },
  { key: "positions", label: "Positions" },
];

const ROW_INCREMENT = 20;

type MixEventsTableProps = {
  rows: MixEventsTableRow[];
};

export default function MixEventsTable({ rows }: MixEventsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [visibleCount, setVisibleCount] = useState<number>(ROW_INCREMENT);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (sortKey === "createdAt") {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        const diff = aDate - bDate;
        return sortDirection === "asc" ? diff : -diff;
      }

      const aValue = String(a[sortKey] ?? "").toLowerCase();
      const bValue = String(b[sortKey] ?? "").toLowerCase();
      const compare = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? compare : -compare;
    });

    return sorted;
  }, [rows, sortDirection, sortKey]);

  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount]
  );

  const handleSortChange = (key: string) => {
    if (!isSortKey(key)) return;
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const tableRows = visibleRows.map((row) => ({
    createdAt: (
      <span className="whitespace-nowrap font-medium text-neutral-900">
        {formatDate(row.createdAt)}
      </span>
    ),
    source: row.source ?? "—",
    templateKey: row.templateKey ?? "—",
    benchmarkSymbol: row.benchmarkSymbol ?? "—",
    referrer: row.referrer ?? "—",
    anonId: row.anonId ?? "—",
    positions: row.positions,
  }));

  const remainingRowsCount = Math.max(sortedRows.length - visibleRows.length, 0);
  const shouldShowLoadMore = remainingRowsCount > 0;
  const handleLoadMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + ROW_INCREMENT, sortedRows.length)
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        rows={tableRows}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        emptyMessage="No mix events in this range yet."
      />

      {shouldShowLoadMore && (
        <div className="flex justify-center">
          <button
            type="button"
            className="inline-flex w-full max-w-sm items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 sm:text-sm"
            onClick={handleLoadMore}
          >
            Load {Math.min(ROW_INCREMENT, remainingRowsCount)} more events
          </button>
        </div>
      )}
    </div>
  );
}

function isSortKey(key: string): key is SortKey {
  return columns.some((column) => column.key === key);
}
