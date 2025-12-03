import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { MainShell } from "@/components/layout/MainShell";
import { StatCard } from "@/components/ui/StatCard";

import MixEventsTable from "./components/MixEventsTable";
import type { MixEventsTableRow, RangeOption } from "./types";

const MAX_TABLE_ROWS = 200;

type SummaryCounts = {
  today: number;
  twoDays: number;
  threeDays: number;
  week: number;
  allTime: number;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function parseRangeOption(value?: string | string[] | null): RangeOption {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "2d") {
    return "2d";
  }
  if (raw === "all") {
    return "all";
  }
  return "today";
}

function getRangeStart(range: RangeOption, now: Date) {
  const date = new Date(now);
  if (range === "today") {
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
  if (range === "2d") {
    date.setUTCDate(date.getUTCDate() - 2);
    return date;
  }
  return undefined;
}

function normalizeSymbol(value: unknown): string | null {
  if (!value) return null;
  const candidate = String(value).trim();
  if (!candidate) return null;
  return candidate.toUpperCase();
}

function getSymbolFromEntryValue(entry: unknown): string | null {
  if (typeof entry === "object" && entry !== null) {
    const record = entry as Record<string, unknown>;
    return (
      normalizeSymbol(record.symbol) ??
      normalizeSymbol(record.ticker) ??
      normalizeSymbol(record.asset)
    );
  }

  return normalizeSymbol(entry);
}

function extractSymbolsFromPositions(raw: unknown): string[] {
  if (!raw) {
    return [];
  }

  const collector: string[] = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const symbol = getSymbolFromEntryValue(entry);
      if (symbol) {
        collector.push(symbol);
      }
    }
  } else if (typeof raw === "object") {
    const symbol = getSymbolFromEntryValue(raw);
    if (symbol) {
      collector.push(symbol);
    }
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return extractSymbolsFromPositions(parsed);
    } catch {
      return raw
        .split(/[,+]/)
        .map((part) => normalizeSymbol(part))
        .filter(Boolean) as string[];
    }
  }

  return collector.filter(Boolean);
}

function summarizePositions(raw: unknown): string {
  if (Array.isArray(raw)) {
    const parts: string[] = [];
    for (const entry of raw) {
      const symbol = getSymbolFromEntryValue(entry);
      if (!symbol) continue;

      const weightValue = typeof entry === "object" && entry !== null
        ? (entry as Record<string, unknown>).weight
        : undefined;

      const parsedWeight =
        typeof weightValue === "number"
          ? weightValue
          : typeof weightValue === "string" && weightValue.trim()
          ? Number(weightValue)
          : undefined;

      const normalizedWeight =
        typeof parsedWeight === "number" && Number.isFinite(parsedWeight)
          ? parsedWeight <= 1
            ? parsedWeight * 100
            : parsedWeight
          : undefined;

      const weightLabel =
        typeof normalizedWeight === "number"
          ? `${Math.round(normalizedWeight)}%`
          : undefined;

      parts.push(weightLabel ? `${symbol} ${weightLabel}` : symbol);
    }

    if (parts.length) {
      return parts.join(" · ");
    }
  }

  const symbols = extractSymbolsFromPositions(raw);
  if (symbols.length) {
    return symbols.join(" · ");
  }

  return "—";
}

function summarizeTopItems(items: Record<string, number>) {
  return Object.entries(items)
    .map(([key, value]) => ({ key, count: value }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function fetchMixEvents(range: RangeOption) {
  const now = new Date();
  const rangeStart = getRangeStart(range, now);

  const query = supabaseAdmin
    .from("mix_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_TABLE_ROWS);

  if (rangeStart) {
    query.gte("created_at", rangeStart.toISOString());
  }

  return query;
}

export default async function MixEventsAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseRangeOption(resolvedSearchParams.range ?? null);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startTwoDays = new Date(now);
  startTwoDays.setUTCDate(startTwoDays.getUTCDate() - 2);
  const startThreeDays = new Date(now);
  startThreeDays.setUTCDate(startThreeDays.getUTCDate() - 3);
  const startWeek = new Date(now);
  startWeek.setUTCDate(startWeek.getUTCDate() - 7);

  const fetchCount = async (since?: Date) => {
    let query = supabaseAdmin
      .from("mix_events")
      .select("id", { count: "exact", head: true });

    if (since) {
      query = query.gte("created_at", since.toISOString());
    }

    const { count, error } = await query;
    if (error) {
      throw error;
    }

    return count ?? 0;
  };

  const [
    summaryToday,
    summaryTwoDays,
    summaryThreeDays,
    summaryWeek,
    summaryAll,
  ] = await Promise.all([
    fetchCount(startOfToday),
    fetchCount(startTwoDays),
    fetchCount(startThreeDays),
    fetchCount(startWeek),
    fetchCount(),
  ]);

  const summaryCounts: SummaryCounts = {
    today: summaryToday,
    twoDays: summaryTwoDays,
    threeDays: summaryThreeDays,
    week: summaryWeek,
    allTime: summaryAll,
  };

  const mixEventsResponse = await fetchMixEvents(range);
  if (mixEventsResponse.error) {
    throw mixEventsResponse.error;
  }

  const mixEvents = mixEventsResponse.data ?? [];

  const symbolCounts: Record<string, number> = {};
  const comboCounts: Record<string, number> = {};

  for (const event of mixEvents) {
    const symbols = Array.from(
      new Set(extractSymbolsFromPositions(event.positions))
    );

    for (const symbol of symbols) {
      symbolCounts[symbol] = (symbolCounts[symbol] ?? 0) + 1;
    }

    if (symbols.length > 0) {
      const sorted = [...symbols].sort();
      const comboKey = sorted.join(" + ");
      comboCounts[comboKey] = (comboCounts[comboKey] ?? 0) + 1;
    }
  }

  const topSymbols = summarizeTopItems(symbolCounts);
  const topCombinations = summarizeTopItems(comboCounts);

  const tableRows: MixEventsTableRow[] = mixEvents.map((event) => ({
    id: event.id,
    createdAt: event.created_at,
    source: event.source ?? null,
    templateKey: event.template_key ?? null,
    benchmarkSymbol: event.benchmark_symbol ?? null,
    referrer: event.referrer ?? null,
    anonId: event.anon_id ?? null,
    positions: summarizePositions(event.positions),
  }));

  return (
    <div className="flex flex-col gap-8">
      <MainShell
        title="Mix events analytics"
        description="Inspect ETF mixes, top symbols, and popular combinations."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Today"
              value={numberFormatter.format(summaryCounts.today)}
              helperText="Since midnight"
            />
            <StatCard
              label="Last 3 days"
              value={numberFormatter.format(summaryCounts.threeDays)}
              helperText="Rolling 72h"
            />
            <StatCard
              label="All time"
              value={numberFormatter.format(summaryCounts.allTime)}
              helperText="Total mix events"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">
                  Top 10 ETFs
                </h3>
                <p className="text-xs font-medium text-neutral-500">
                  Current range
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-neutral-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {topSymbols.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-4 text-center text-sm text-neutral-500"
                        >
                          No picks in this range yet.
                        </td>
                      </tr>
                    ) : (
                      topSymbols.map((item) => (
                        <tr key={item.key} className="hover:bg-neutral-50/80">
                          <td className="px-3 py-2 font-medium text-neutral-900">
                            {item.key}
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {numberFormatter.format(item.count)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">
                  Top 10 combinations
                </h3>
                <p className="text-xs font-medium text-neutral-500">
                  Symbol sets
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-neutral-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">Combination</th>
                      <th className="px-3 py-2">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {topCombinations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-4 text-center text-sm text-neutral-500"
                        >
                          No combinations in this range yet.
                        </td>
                      </tr>
                    ) : (
                      topCombinations.map((item) => (
                        <tr key={item.key} className="hover:bg-neutral-50/80">
                          <td className="px-3 py-2 font-medium text-neutral-900">
                            {item.key}
                          </td>
                          <td className="px-3 py-2 text-neutral-600">
                            {numberFormatter.format(item.count)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </MainShell>

      <MainShell
        title="Recent mix events"
        description={`Showing up to ${mixEvents.length} rows for the selected range.`}
      >
        <MixEventsTable rows={tableRows} />
      </MainShell>
    </div>
  );
}
