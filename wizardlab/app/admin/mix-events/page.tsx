import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { MainShell } from "@/components/layout/MainShell";
import { StatCard } from "@/components/ui/StatCard";
import { getTopCards } from "@/lib/wizardlab/analytics";

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
const TORONTO_TIMEZONE = "America/Toronto";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type TimezoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTimezoneDateParts(date: Date, timeZone: string): TimezoneDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const normalized: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      normalized[part.type] = part.value;
    }
  }

  return {
    year: Number(normalized.year ?? 0),
    month: Number(normalized.month ?? 0),
    day: Number(normalized.day ?? 0),
    hour: Number(normalized.hour ?? 0),
    minute: Number(normalized.minute ?? 0),
    second: Number(normalized.second ?? 0),
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string) {
  const tzParts = getTimezoneDateParts(date, timeZone);
  const utcParts = getTimezoneDateParts(date, "UTC");

  const tzDate = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second
  );

  const utcDate = Date.UTC(
    utcParts.year,
    utcParts.month - 1,
    utcParts.day,
    utcParts.hour,
    utcParts.minute,
    utcParts.second
  );

  return tzDate - utcDate;
}

function getTorontoStartOfDay(reference: Date) {
  const parts = getTimezoneDateParts(reference, TORONTO_TIMEZONE);
  const localMidnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);

  let candidate = localMidnightUtc;
  for (let i = 0; i < 5; i++) {
    const offset = getTimezoneOffsetMs(new Date(candidate), TORONTO_TIMEZONE);
    const nextCandidate = localMidnightUtc - offset;
    if (Math.abs(nextCandidate - candidate) < 1000) {
      break;
    }
    candidate = nextCandidate;
  }

  return new Date(candidate);
}

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

async function fetchMixEvents() {
  const now = new Date();

  const query = supabaseAdmin
    .from("mix_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_TABLE_ROWS);

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
  const startOfToday = getTorontoStartOfDay(now);
  const startTwoDays = new Date(startOfToday.getTime() - 2 * MS_PER_DAY);
  const startThreeDays = new Date(startOfToday.getTime() - 3 * MS_PER_DAY);
  const startWeek = new Date(startOfToday.getTime() - 7 * MS_PER_DAY);

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

  const mixEventsResponse = await fetchMixEvents();
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
  const topCards = await getTopCards();

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-neutral-900">
                    Top 10 ETFs
                  </h3>
                  <p className="text-xs font-medium text-neutral-500">
                    All time
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
                          No picks yet.
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
                          No combinations yet.
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

            <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-neutral-900">
                  Top cards (by usage)
                </h3>
                <p className="text-xs font-medium text-neutral-500">
                  Quick-start cards
                </p>
              </div>
              <ul className="space-y-2 list-none">
                {topCards.length === 0 ? (
                  <li className="px-3 py-4 text-center text-sm text-neutral-500">
                    No card usage recorded yet.
                  </li>
                ) : (
                  topCards.map((card) => (
                    <li
                      key={card.templateKey}
                      className="flex justify-between rounded-xl border border-neutral-100 px-3 py-2"
                    >
                      <span className="font-medium text-neutral-900">
                        {card.templateKey}
                      </span>
                      <span className="text-sm text-neutral-500">
                        {numberFormatter.format(card.count)} runs · {card.percentage.toFixed(1)}%
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </MainShell>

      <MainShell
        title="Recent mix events"
        description={`Showing up to ${mixEvents.length} rows.`}
      >
        <MixEventsTable rows={tableRows} />
      </MainShell>
    </div>
  );
}
