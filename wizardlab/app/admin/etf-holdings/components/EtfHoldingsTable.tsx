"use client";

import { useMemo, useState } from "react";

import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import type { EtfHolding } from "../types";

const columns: ColumnDef[] = [
  { key: "etf_symbol", label: "ETF" },
  { key: "holding_symbol", label: "Holding" },
  { key: "holding_name", label: "Name" },
  { key: "weight_pct", label: "Weight", isNumeric: true },
  { key: "country", label: "Country" },
  { key: "sector", label: "Sector" },
  { key: "asset_class", label: "Asset class" },
  { key: "nav_date", label: "NAV date" },
  { key: "provider", label: "Provider" },
];

type SortKey =
  | "etf_symbol"
  | "holding_symbol"
  | "holding_name"
  | "weight_pct"
  | "country"
  | "sector"
  | "asset_class"
  | "nav_date"
  | "provider";

type EtfHoldingsTableProps = {
  rows: EtfHolding[];
};

export function EtfHoldingsTable({ rows }: EtfHoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("weight_pct");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "weight_pct") {
        const aVal = Number(a.weight_pct ?? 0);
        const bVal = Number(b.weight_pct ?? 0);
        return (aVal - bVal) * direction;
      }

      if (sortKey === "nav_date") {
        const aDate = new Date(a.nav_date).getTime();
        const bDate = new Date(b.nav_date).getTime();
        return (aDate - bDate) * direction;
      }

      const aVal = String(a[sortKey] ?? "").toLowerCase();
      const bVal = String(b[sortKey] ?? "").toLowerCase();
      return aVal.localeCompare(bVal) * direction;
    });

    return copy;
  }, [rows, sortDirection, sortKey]);

  const tableRows = sortedRows.map((row) => {
    const weightNumber = Number(row.weight_pct);
    const weightLabel = Number.isFinite(weightNumber)
      ? `${weightNumber.toFixed(2)}%`
      : "—";

    return {
      etf_symbol: (
        <span className="font-medium text-neutral-900">{row.etf_symbol}</span>
      ),
      holding_symbol: row.holding_symbol,
      holding_name: row.holding_name,
      weight_pct: weightLabel,
      country: row.country ?? "—",
      sector: row.sector ?? "—",
      asset_class: row.asset_class ?? "—",
      nav_date: row.nav_date,
      provider: row.provider ?? "—",
    };
  });

  const handleSortChange = (key: string) => {
    if (!isSortKey(key)) return;
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <DataTable
      columns={columns}
      rows={tableRows}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={handleSortChange}
      emptyMessage="No holdings match the current filters."
    />
  );
}

function isSortKey(key: string): key is SortKey {
  return columns.some((column) => column.key === key);
}
