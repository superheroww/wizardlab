"use client";

"use client";

import { useMemo, useState } from "react";

export type EtfSummaryRow = {
  symbol: string;
  holdingCount: number;
  totalWeight: number;
};

interface EtfHoldingsSummaryCardProps {
  summary: EtfSummaryRow[];
}

type SortKey = "symbol" | "holdingCount" | "totalWeight";

const VISIBLE_LIMIT = 5;

export function EtfHoldingsSummaryCard({ summary }: EtfHoldingsSummaryCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedSummary = useMemo(() => {
    const copy = [...summary];
    copy.sort((a, b) => {
      let comparison = 0;

      if (sortKey === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      } else if (sortKey === "holdingCount") {
        comparison = a.holdingCount - b.holdingCount;
      } else {
        comparison = a.totalWeight - b.totalWeight;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return copy;
  }, [summary, sortKey, sortDirection]);

  const visibleRows = useMemo(() => {
    if (showAll) return sortedSummary;
    return sortedSummary.slice(0, VISIBLE_LIMIT);
  }, [showAll, sortedSummary]);

  const visibleCount = showAll
    ? summary.length
    : Math.min(VISIBLE_LIMIT, summary.length);

  const handleSortChange = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-900">ETF summary</h3>
        <p className="text-xs text-neutral-500">
          Top {visibleCount} of {summary.length} ETFs
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => handleSortChange("symbol")}
                  className="flex items-center gap-1 text-left text-neutral-500"
                >
                  ETF
                  <span aria-hidden>{sortIndicator("symbol")}</span>
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSortChange("holdingCount")}
                  className="flex items-center justify-end gap-1 text-neutral-500"
                >
                  Holdings
                  <span aria-hidden>{sortIndicator("holdingCount")}</span>
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSortChange("totalWeight")}
                  className="flex items-center justify-end gap-1 text-neutral-500"
                >
                  Total weight
                  <span aria-hidden>{sortIndicator("totalWeight")}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visibleRows.map((row) => (
              <tr key={row.symbol}>
                <td className="px-3 py-2 font-medium text-neutral-900">{row.symbol}</td>
                <td className="px-3 py-2 text-right text-neutral-700">{row.holdingCount}</td>
                <td
                  className={`px-3 py-2 text-right font-medium ${weightColorClass(
                    row.totalWeight
                  )}`}
                >
                  {row.totalWeight.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.length > VISIBLE_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-2 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline"
        >
          {showAll ? "Show less" : `Show all (${summary.length})`}
        </button>
      )}
    </div>
  );
}

function weightColorClass(totalWeight: number) {
  if (totalWeight >= 80 && totalWeight <= 101) {
    return "text-green-600";
  }

  if (
    (totalWeight >= 50 && totalWeight <= 79) ||
    (totalWeight > 101 && totalWeight <= 105)
  ) {
    return "text-yellow-600";
  }

  return "text-red-600";
}
