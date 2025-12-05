import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { extractSymbolsFromPositions } from "@/lib/mix-events/symbols";
import {
  getFromDateBoundary,
  type InsightsTimeFilter,
} from "@/lib/mix-insights/timeFilters";

type MixEventRecord = {
  id: string;
  positions: unknown;
  template_key: string | null;
  created_at: string;
};

type TopItem = { key: string; count: number };

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

function parseTimeFilter(value: string | null): InsightsTimeFilter {
  if (value === "today" || value === "last2d" || value === "last7d" || value === "all") {
    return value;
  }
  return "today";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const timeFilterParam = parseTimeFilter(url.searchParams.get("timeFilter"));

  const fromDate = getFromDateBoundary(timeFilterParam);

  const [rows, totalCount] = await Promise.all([
    fetchMixEvents(fromDate),
    fetchEventsCount(fromDate),
  ]);

  const symbolCounts: Record<string, number> = {};
  const comboCounts: Record<string, number> = {};
  const templateCounts: Record<string, number> = {};

  for (const row of rows) {
    const symbols = Array.from(
      new Set(extractSymbolsFromPositions(row.positions))
    );

    for (const symbol of symbols) {
      symbolCounts[symbol] = (symbolCounts[symbol] ?? 0) + 1;
    }

    if (symbols.length > 0) {
      const comboKey = [...symbols].sort().join(" + ");
      comboCounts[comboKey] = (comboCounts[comboKey] ?? 0) + 1;
    }

    if (row.template_key) {
      templateCounts[row.template_key] =
        (templateCounts[row.template_key] ?? 0) + 1;
    }
  }

  const topEtfs = summarizeTopItems(symbolCounts);
  const topCombinations = summarizeTopItems(comboCounts);
  const topCards = summarizeTopCards(templateCounts, totalCount);

  return NextResponse.json({
    topEtfs,
    topCombinations,
    topCards,
  });
}

function summarizeTopItems(items: Record<string, number>): TopItem[] {
  return Object.entries(items)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function summarizeTopCards(
  items: Record<string, number>,
  totalCount: number
) {
  return Object.entries(items)
    .map(([templateKey, count]) => ({
      templateKey,
      count,
      percentage: totalCount === 0 ? 0 : (count / totalCount) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function fetchMixEvents(fromDate: string | null) {
  const rows: MixEventRecord[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabaseAdmin
      .from("mix_events")
      .select("id, positions, template_key, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchEventsCount(fromDate: string | null) {
  let query = supabaseAdmin
    .from("mix_events")
    .select("id", { count: "exact", head: true });

  if (fromDate) {
    query = query.gte("created_at", fromDate);
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return count ?? 0;
}
