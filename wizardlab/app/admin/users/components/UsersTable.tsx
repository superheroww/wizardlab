"use client";

import { useMemo, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import type { AdminUserRow } from "@/lib/users/fetchUsers";

const COLUMNS: ColumnDef[] = [
  { key: "createdAt", label: "Created" },
  { key: "domain", label: "Domain" },
  { key: "id", label: "User ID" },
];

type SortKey = "createdAt" | "domain" | "id";
type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

const DEFAULT_SORT: SortConfig = {
  key: "createdAt",
  direction: "desc",
};

export default function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);

  const sortedRows = useMemo(() => {
    const { key, direction } = sortConfig;
    const dirFactor = direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const compareValue = compareByKey(a, b, key);
      return compareValue * dirFactor;
    });
  }, [rows, sortConfig]);

  const handleSortChange = (columnKey: string) => {
    if (!isSortKey(columnKey)) return;
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const tableRows = sortedRows.map((row) => ({
    createdAt: (
      <span className="whitespace-nowrap text-neutral-700">
        {formatDateTime(row.createdAt)}
      </span>
    ),
    domain: (
      <span className="text-sm font-medium text-neutral-900">
        {row.domain ?? "(unknown)"}
      </span>
    ),
    id: (
      <span className="font-mono text-xs uppercase tracking-wide text-neutral-500">
        {truncateId(row.id)}
      </span>
    ),
  }));

  return (
    <DataTable
      columns={COLUMNS}
      rows={tableRows}
      sortKey={sortConfig.key}
      sortDirection={sortConfig.direction}
      onSortChange={handleSortChange}
      emptyMessage="No users available yet."
    />
  );
}

function compareByKey(a: AdminUserRow, b: AdminUserRow, key: SortKey) {
  if (key === "createdAt") {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  }

  const aValue = String(key === "domain" ? a.domain ?? "" : a.id ?? "").toLowerCase();
  const bValue = String(key === "domain" ? b.domain ?? "" : b.id ?? "").toLowerCase();

  return aValue.localeCompare(bValue);
}

function formatDateTime(value: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function truncateId(value: string) {
  if (!value) return "—";
  return value.length <= 8 ? value : value.slice(0, 8);
}

function isSortKey(value: string): value is SortKey {
  return value === "createdAt" || value === "domain" || value === "id";
}
