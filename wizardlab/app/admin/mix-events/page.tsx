import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { MainShell } from "@/components/layout/MainShell";
import { StatCard } from "@/components/ui/StatCard";
import { summarizePositions } from "@/lib/mix-events/symbols";

import MixEventsTable from "./components/MixEventsTable";
import { MixInsightsSection } from "./components/MixInsightsSection";
import type { MixEventsTableRow } from "./types";

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

async function fetchMixEvents() {
  const now = new Date();

  const query = supabaseAdmin
    .from("mix_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(MAX_TABLE_ROWS);

  return query;
}

export default async function MixEventsAnalyticsPage() {
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

          <MixInsightsSection />
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
