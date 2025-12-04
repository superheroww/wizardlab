import { MainShell } from "@/components/layout/MainShell";
import { StatusPill } from "@/components/social/StatusPill";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { getStatusSequence, isKnownStatus, normalizeStatus } from "@/lib/social/statusMeta";
import { createClient } from "@/utils/supabase/server";

import ManualIngestCard from "./components/ManualIngestCard";
import SocialEngagePanel from "./components/SocialEngagePanel";
import { SELECT_FIELDS, type SocialEngageRow } from "./types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DailyMetrics = {
  bucket_date: string;
  status: string;
  total_count: number;
  ready_count: number;
  posted_count: number;
  should_reply_count: number;
};

const dailyColumns: ColumnDef[] = [
  { key: "bucket_date", label: "Date" },
  { key: "status", label: "Status" },
  { key: "total_count", label: "Total", isNumeric: true },
  { key: "ready_count", label: "Ready", isNumeric: true },
  { key: "posted_count", label: "Posted", isNumeric: true },
  { key: "should_reply_count", label: "Should reply", isNumeric: true },
];

export default async function SocialMetricsPage() {
  const supabase = createClient();

  const { data: dailyRaw, error: dailyError } = await supabase.rpc(
    "social_engage_metrics_daily"
  );
  const daily = (dailyRaw ?? []) as DailyMetrics[];

  const { data: rowsRaw, error: rowsError } = await supabase
    .from("social_engage")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (rowsRaw ?? []) as unknown as SocialEngageRow[];

  const dailyRows = daily.map((row) => ({
    bucket_date: row.bucket_date,
    status: row.status,
    total_count: row.total_count,
    ready_count: row.ready_count,
    posted_count: row.posted_count,
    should_reply_count: row.should_reply_count,
  }));

  return (
    <div className="flex flex-col gap-8">
      <MainShell
        title="Social metrics"
        description="Track Reddit triggers, posts, and engagement."
      >
        {(dailyError || rowsError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {dailyError && <div>Daily metrics error: {dailyError.message}</div>}
            {rowsError && <div>Rows error: {rowsError.message}</div>}
          </div>
        )}

        <StatusOverview rows={rows} />

        <div className="space-y-2">
          <h3 className="text-base font-semibold text-neutral-900">Daily activity</h3>
          <DataTable
            columns={dailyColumns}
            rows={dailyRows}
            emptyMessage="No daily metrics yet."
          />
        </div>
      </MainShell>

      <MainShell
        title="Recent social engagement"
        description="Filter by status, sort any column, and review AI replies."
      >
        <div className="space-y-4">
          <ManualIngestCard />
          <SocialEngagePanel rows={rows} filterMode="status" />
        </div>
      </MainShell>
    </div>
  );
}

function StatusOverview({ rows }: { rows: SocialEngageRow[] }) {
  const statusOrder = getStatusSequence();
  const baseCounts = Object.fromEntries(statusOrder.map((key) => [key, 0])) as Record<
    (typeof statusOrder)[number],
    number
  >;
  let otherCount = 0;

  for (const row of rows) {
    const normalized = normalizeStatus(row.status);
    if (isKnownStatus(normalized)) {
      baseCounts[normalized] += 1;
    } else {
      otherCount += 1;
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Status overview
          </div>
          <p className="text-sm text-neutral-500">
            Latest {rows.length || 0} Reddit rows
          </p>
        </div>
        <div className="text-xs font-medium text-neutral-400">
          {rows.length} tracked
        </div>
      </div>
      {rows.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {statusOrder.map((status) => (
            <StatusPill
              key={status}
              status={status}
              count={baseCounts[status]}
              variant="full"
            />
          ))}
          {otherCount > 0 ? (
            <StatusPill status="unknown" count={otherCount} variant="full" />
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
          No social engagement rows yet.
        </div>
      )}
    </div>
  );
}
