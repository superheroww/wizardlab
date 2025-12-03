import { MainShell } from "@/components/layout/MainShell";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { createClient } from "@/utils/supabase/server";

import SocialEngageTable from "./components/SocialEngageTable";
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

type Counters = {
  total_rows: number;
  total_unique_posts: number;
  pending_count: number;
  ready_count: number;
  posted_count: number;
  ai_should_reply_count: number;
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

  const { data: countersRaw, error: countersError } = await supabase
    .rpc("social_engage_counters")
    .single();
  const counters = (countersRaw as Counters | null) ?? null;

  const { data: dailyRaw, error: dailyError } = await supabase.rpc(
    "social_engage_metrics_daily"
  );
  const daily = (dailyRaw ?? []) as DailyMetrics[];

  const { data: rowsRaw, error: rowsError } = await supabase
    .from("social_engage")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (rowsRaw ?? []) as SocialEngageRow[];

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
        {(countersError || dailyError || rowsError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {countersError && <div>Counters error: {countersError.message}</div>}
            {dailyError && <div>Daily metrics error: {dailyError.message}</div>}
            {rowsError && <div>Rows error: {rowsError.message}</div>}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {counters ? (
            <>
              <StatCard label="Total rows" value={counters.total_rows} />
              <StatCard label="Unique posts" value={counters.total_unique_posts} />
              <StatCard label="Pending" value={counters.pending_count} />
              <StatCard label="Ready" value={counters.ready_count} />
              <StatCard label="Posted" value={counters.posted_count} />
              <StatCard
                label="AI should reply"
                value={counters.ai_should_reply_count}
              />
            </>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              No counters available yet.
            </div>
          )}
        </div>

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
        <SocialEngageTable rows={rows} filterMode="status" />
      </MainShell>
    </div>
  );
}
