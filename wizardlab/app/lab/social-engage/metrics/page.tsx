// app/lab/social-engage/metrics/page.tsx
import { createClient } from "@/utils/supabase/server";

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

export default async function SocialEngageMetricsPage() {
  const supabase = createClient();

  const { data: countersRaw, error: countersError } = await supabase
    .rpc("social_engage_counters")
    .single();
  const counters = (countersRaw as Counters | null) ?? null;

  const { data: dailyRaw, error: dailyError } = await supabase.rpc(
    "social_engage_metrics_daily"
  );
  const daily = (dailyRaw ?? []) as DailyMetrics[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Social Engagement Metrics
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Daily activity and pipeline counts from the{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.7rem] dark:bg-zinc-800">
            social_engage
          </code>{" "}
          table.
        </p>

        {(countersError || dailyError) && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {countersError && <div>Counters error: {countersError.message}</div>}
            {dailyError && <div>Daily metrics error: {dailyError.message}</div>}
          </div>
        )}
      </header>

      {/* TOP METRIC CARDS */}
      {counters && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <MetricCard label="Total rows" value={counters.total_rows} />
          <MetricCard label="Unique posts" value={counters.total_unique_posts} />
          <MetricCard label="Pending" value={counters.pending_count} />
          <MetricCard label="Ready" value={counters.ready_count} />
          <MetricCard label="Posted" value={counters.posted_count} />
          <MetricCard
            label="AI should reply"
            value={counters.ai_should_reply_count}
          />
        </div>
      )}

      {/* DAILY TABLE (DESKTOP) */}
      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        {daily.length === 0 ? (
          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">
            No daily metrics yet.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="whitespace-nowrap px-4 py-2">Date</th>
                <th className="whitespace-nowrap px-4 py-2">Status</th>
                <th className="whitespace-nowrap px-4 py-2 text-right">Total</th>
                <th className="whitespace-nowrap px-4 py-2 text-right">Ready</th>
                <th className="whitespace-nowrap px-4 py-2 text-right">Posted</th>
                <th className="whitespace-nowrap px-4 py-2 text-right">
                  Should Reply
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {daily.map((row) => (
                <tr key={`${row.bucket_date}-${row.status}`}>
                  <td className="px-4 py-2 text-xs text-zinc-800 dark:text-zinc-100">
                    {row.bucket_date}
                  </td>
                  <td className="px-4 py-2 text-xs capitalize text-zinc-700 dark:text-zinc-200">
                    {row.status}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-800 dark:text-zinc-100">
                    {row.total_count}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-800 dark:text-zinc-100">
                    {row.ready_count}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-800 dark:text-zinc-100">
                    {row.posted_count}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-zinc-800 dark:text-zinc-100">
                    {row.should_reply_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* DAILY MOBILE CARDS */}
      <div className="space-y-3 md:hidden">
        {daily.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            No daily metrics yet.
          </div>
        ) : (
          daily.map((row) => (
            <div
              key={`${row.bucket_date}-${row.status}`}
              className="rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {row.bucket_date}
              </div>
              <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                {row.status}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem]">
                <Stat label="Total" value={row.total_count} />
                <Stat label="Ready" value={row.ready_count} />
                <Stat label="Posted" value={row.posted_count} />
                <Stat label="Should Reply" value={row.should_reply_count} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* Small reusable components */

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-100 p-2 text-center dark:bg-zinc-800">
      <div className="text-[0.65rem] text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}