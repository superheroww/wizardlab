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

type EtfHoldingsTableProps = {
  rows: EtfHolding[];
};

export function EtfHoldingsTable({ rows }: EtfHoldingsTableProps) {
  const tableRows = rows.map((row) => {
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

  return (
    <DataTable
      columns={columns}
      rows={tableRows}
      emptyMessage="No holdings match the current filters."
    />
  );
}
