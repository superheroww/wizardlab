import Link from "next/link";

import { MainShell } from "@/components/layout/MainShell";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { EtfHoldingsSummaryCard, type EtfSummaryRow } from "./components/EtfHoldingsSummaryCard";
import { EtfHoldingsTable } from "./components/EtfHoldingsTable";
import type { EtfHolding } from "./types";

const MAX_ROWS = 200;

function normalizeSymbol(input?: string | string[] | null): string | null {
  const value = Array.isArray(input) ? input[0] : input;
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

export default async function EtfHoldingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};

  const etfSymbolFilter = normalizeSymbol(resolvedSearchParams.etf_symbol ?? null);
  const holdingSymbolFilter = normalizeSymbol(
    resolvedSearchParams.holding_symbol ?? null
  );

  let query = supabaseAdmin
    .from("etf_holdings")
    .select("*")
    .order("etf_symbol", { ascending: true })
    .order("weight_pct", { ascending: false })
    .limit(MAX_ROWS);

  if (etfSymbolFilter) {
    query = query.ilike("etf_symbol", `${etfSymbolFilter}%`);
  }

  if (holdingSymbolFilter) {
    query = query.ilike("holding_symbol", `${holdingSymbolFilter}%`);
  }

  const { data, error } = await query;

  const holdings = (data ?? []) as EtfHolding[];
  const summaryRows = buildEtfSummary(holdings);

  return (
    <div className="flex flex-col gap-8">
      <MainShell
        title="ETF holdings explorer"
        description="Inspect normalized ETF holdings by fund and underlying symbol."
        actions={
          <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <input
              type="text"
              name="etf_symbol"
              placeholder="ETF symbol (e.g. XEQT)"
              defaultValue={etfSymbolFilter ?? ""}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-0 sm:w-44"
            />
            <input
              type="text"
              name="holding_symbol"
              placeholder="Holding symbol (e.g. AAPL)"
              defaultValue={holdingSymbolFilter ?? ""}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-0 sm:w-44"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Filter
              </button>
              {(etfSymbolFilter || holdingSymbolFilter) && (
                <Link
                  href="/admin/etf-holdings"
                  className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        }
      >
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error loading holdings: {error.message}
          </div>
        ) : null}

        {summaryRows.length > 0 && (
          <EtfHoldingsSummaryCard summary={summaryRows} />
        )}

        <EtfHoldingsTable rows={holdings} />
      </MainShell>
    </div>
  );
}

function buildEtfSummary(rows: EtfHolding[]): EtfSummaryRow[] {
  const grouping = new Map<string, { holdingCount: number; totalWeight: number }>();

  for (const row of rows) {
    const symbol = row.etf_symbol?.trim();
    if (!symbol) continue;

    const rawWeight =
      typeof row.weight_pct === "number"
        ? row.weight_pct
        : Number(row.weight_pct);
    const weight = Number.isFinite(rawWeight) ? rawWeight : 0;

    const existing = grouping.get(symbol);
    if (existing) {
      existing.holdingCount += 1;
      existing.totalWeight += weight;
    } else {
      grouping.set(symbol, { holdingCount: 1, totalWeight: weight });
    }
  }

  const summary: EtfSummaryRow[] = Array.from(grouping.entries())
    .map(([symbol, { holdingCount, totalWeight }]) => ({
      symbol,
      holdingCount,
      totalWeight,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return summary;
}
