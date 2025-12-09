// app/admin/insight/page.tsx

import { supabaseAdmin } from "@/lib/supabase/admin";

type Summary = {
  totalMixesLast14d: number;
  uniqueMixersLast14d: number;
  repeatMixersLast14d: number;
  scratchMixesLast14d: number;
  templateMixesLast14d: number;
  avgMixesPerMixerLast14d: number;
  canadaSharePctLast14d: number;
};

type DailyTrendPoint = {
  day: string;
  totalMixes: number;
  uniqueMixers: number;
  mixesPerMixer: number;
};

type CountryRow = {
  countryCode: string | null;
  totalMixes: number;
  sharePct: number;
};

type SourceEngagementRow = {
  source: string | null;
  totalCount: number;
  uniqueUsers: number;
  avgMixesPerUser: number;
};

type PowerUserRow = {
  anonId: string;
  totalMixes: number;
  scratchMixes: number;
  templateMixes: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

type TemplateEngagementRow = {
  templateKey: string;
  totalCount: number;
  uniqueUsers: number;
};

type CountrySourceRow = {
  countryCode: string | null;
  source: string | null;
  totalMixes: number;
  uniqueMixers: number;
  mixesPerMixer: number;
};

type CountryTemplateRow = {
  countryCode: string | null;
  templateKey: string;
  totalMixes: number;
  uniqueMixers: number;
};

type ScratchCountryTickerRow = {
  countryCode: string | null;
  symbol: string;
  totalMixes: number;
  uniqueMixers: number;
};

type ScratchCountryComboRow = {
  countryCode: string | null;
  comboKey: string;
  totalMixes: number;
  uniqueMixers: number;
};

type AdminInsightResponse = {
  summary: Summary;
  dailyTrendsLast30d: DailyTrendPoint[];
  countryBreakdownLast14d: CountryRow[];
  sourceEngagement: SourceEngagementRow[];
  powerUsers: PowerUserRow[];
  templateEngagement: TemplateEngagementRow[];
  countrySourceEngagementLast14d: CountrySourceRow[];
  countryTemplateEngagementLast14d: CountryTemplateRow[];
  scratchCountryTickersLast14d: ScratchCountryTickerRow[];
  scratchCountryCombosLast14d: ScratchCountryComboRow[];
};

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("en-CA").format(value);
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export const metadata = {
  title: "Insight dashboard",
  description:
    "Early behavior analytics summarizing mix volume, geography, and active users.",
};

export default async function InsightDashboardPage() {
  const { data, error } = await supabaseAdmin.rpc("admin_get_insight_data");

  if (error) {
    console.error("Error fetching admin insights", error);
  }

  const insights = (data ?? {}) as AdminInsightResponse;

  const summary: Summary = insights.summary ?? {
    totalMixesLast14d: 0,
    uniqueMixersLast14d: 0,
    repeatMixersLast14d: 0,
    scratchMixesLast14d: 0,
    templateMixesLast14d: 0,
    avgMixesPerMixerLast14d: 0,
    canadaSharePctLast14d: 0,
  };

  const dailyTrends = insights.dailyTrendsLast30d ?? [];
  const countryRows = insights.countryBreakdownLast14d ?? [];
  const sourceRows = insights.sourceEngagement ?? [];
  const powerUsers = insights.powerUsers ?? [];
  const templateRows = insights.templateEngagement ?? [];
  const countrySourceRows = insights.countrySourceEngagementLast14d ?? [];
  const countryTemplateRows = insights.countryTemplateEngagementLast14d ?? [];
  const scratchTickerRows = insights.scratchCountryTickersLast14d ?? [];
  const scratchComboRows = insights.scratchCountryCombosLast14d ?? [];

  const scratchTotal = summary.scratchMixesLast14d ?? 0;
  const templateTotal = summary.templateMixesLast14d ?? 0;
  const totalForSource = scratchTotal + templateTotal;

  const scratchPct =
    totalForSource > 0 ? (scratchTotal / totalForSource) * 100 : 0;
  const templatePct =
    totalForSource > 0 ? (templateTotal / totalForSource) * 100 : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-8">
        {/* HEADER + TOP CARDS */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Insight dashboard
              </h2>
              <p className="text-sm text-neutral-500">
                Early behavior analytics summarizing mix volume, geography, and
                active users.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Total mixes (14d) */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Total mixes
              </div>
              <div className="mt-2 text-3xl font-semibold text-neutral-900">
                {formatNumber(summary.totalMixesLast14d)}
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                Last 14 days (all sources)
              </div>
            </div>

            {/* Unique + repeat mixers (14d) */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Unique mixers
              </div>
              <div className="mt-2 text-3xl font-semibold text-neutral-900">
                {formatNumber(summary.uniqueMixersLast14d)}
              </div>
              <div className="mt-2 text-xs text-neutral-500">
                Repeat mixers:{" "}
                {formatNumber(summary.repeatMixersLast14d ?? 0)}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Avg mixes per mixer:{" "}
                {summary.avgMixesPerMixerLast14d?.toFixed(2) ?? "0.00"}
              </div>
            </div>

            {/* Source + Canada share (14d) */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Mixes by source (last 14 days)
              </div>
              <div className="mt-2">
                <dl className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-neutral-600">
                    <dt>Scratch</dt>
                    <dd className="font-semibold text-neutral-900">
                      {formatNumber(scratchTotal)}{" "}
                      <span className="text-xs text-neutral-500">
                        ({formatPercent(scratchPct, 0)})
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-sm text-neutral-600">
                    <dt>Template</dt>
                    <dd className="font-semibold text-neutral-900">
                      {formatNumber(templateTotal)}{" "}
                      <span className="text-xs text-neutral-500">
                        ({formatPercent(templatePct, 0)})
                      </span>
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-neutral-500">
                  Canada share:{" "}
                  <span className="font-medium text-neutral-900">
                    {formatPercent(summary.canadaSharePctLast14d, 1)}
                  </span>{" "}
                  of all mixes in the last 14 days.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DAILY TRENDS (30d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Daily mix trends
              </h2>
              <p className="text-sm text-neutral-500">
                Mix volume, unique mixers, and depth over the last 30 days.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {dailyTrends.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No mix activity yet in the last 30 days.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Day</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                      <th className="py-2 pr-4">Mixes per mixer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {dailyTrends.map((row) => (
                      <tr key={row.day}>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.day}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueMixers)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.mixesPerMixer?.toFixed(2) ?? "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* COUNTRY BREAKDOWN (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Countries (last 14 days)
              </h2>
              <p className="text-sm text-neutral-500">
                Where mixes are coming from, based on country_code.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {countryRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No country data available yet for the last 14 days.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">% of mixes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {countryRows.map((row) => (
                      <tr key={row.countryCode ?? "UNKNOWN"}>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.countryCode ?? "UNKNOWN"}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatPercent(row.sharePct, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* SOURCE ENGAGEMENT (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Source engagement
              </h2>
              <p className="text-sm text-neutral-500">
                Volume, reach, and depth by mix creation source (last 14 days).
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {sourceRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No source data available yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                      <th className="py-2 pr-4">Avg mixes per mixer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {sourceRows.map((row) => (
                      <tr key={row.source ?? "unknown"}>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.source ?? "unknown"}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalCount)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueUsers)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.avgMixesPerUser?.toFixed(2) ?? "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* SOURCE BY COUNTRY (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Source by country
              </h2>
              <p className="text-sm text-neutral-500">
                Scratch vs template usage by country over the last 14 days.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {countrySourceRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No country/source data available yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Source</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                      <th className="py-2 pr-4">Mixes per mixer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {countrySourceRows.map((row, idx) => (
                      <tr
                        key={`${row.countryCode ?? "UNKNOWN"}-${
                          row.source ?? "unknown"
                        }-${idx}`}
                      >
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.countryCode ?? "UNKNOWN"}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.source ?? "unknown"}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueMixers)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.mixesPerMixer?.toFixed(2) ?? "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* POWER USERS (all-time) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Power users
              </h2>
              <p className="text-sm text-neutral-500">
                Anon IDs with more than one mix across all time.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {powerUsers.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No power users identified yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Anon ID</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Scratch</th>
                      <th className="py-2 pr-4">Template</th>
                      <th className="py-2 pr-4">First seen</th>
                      <th className="py-2 pr-4">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {powerUsers.map((user) => (
                      <tr key={user.anonId}>
                        <td className="py-2 pr-4 text-xs font-mono text-neutral-700">
                          {user.anonId}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(user.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(user.scratchMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(user.templateMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {user.firstSeenAt}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {user.lastSeenAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* TEMPLATE ENGAGEMENT (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Template engagement
              </h2>
              <p className="text-sm text-neutral-500">
                Top templates by total mixes and reach (last 14 days).
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {templateRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No template usage recorded in the last 14 days.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Template key</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {templateRows.map((row) => (
                      <tr key={row.templateKey}>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.templateKey}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalCount)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueUsers)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* TEMPLATES BY COUNTRY (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Templates by country
              </h2>
              <p className="text-sm text-neutral-500">
                Which templates are being used in each country (last 14 days).
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {countryTemplateRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No country/template data available yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Template key</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {countryTemplateRows.map((row, idx) => (
                      <tr
                        key={`${row.countryCode ?? "UNKNOWN"}-${
                          row.templateKey
                        }-${idx}`}
                      >
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.countryCode ?? "UNKNOWN"}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.templateKey}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueMixers)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* SCRATCH LAB: TOP TICKERS BY COUNTRY (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Scratch lab – top tickers by country
            </h2>
            <p className="text-sm text-neutral-500">
              For scratch mixes only, showing the most common tickers per
              country (last 14 days).
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {scratchTickerRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No scratch ticker data available yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Symbol</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {scratchTickerRows.map((row, idx) => (
                      <tr
                        key={`${row.countryCode ?? "UNKNOWN"}-${
                          row.symbol
                        }-${idx}`}
                      >
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.countryCode ?? "UNKNOWN"}
                        </td>
                        <td className="py-2 pr-4 text-xs font-mono text-neutral-800">
                          {row.symbol}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueMixers)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* SCRATCH LAB: TOP COMBOS BY COUNTRY (14d) */}
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Scratch lab – top combos by country
            </h2>
            <p className="text-sm text-neutral-500">
              The most common scratch combinations (unique sets of tickers) per
              country over the last 14 days.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            {scratchComboRows.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No scratch combo data available yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="py-2 pr-4">Country</th>
                      <th className="py-2 pr-4">Combo (symbols)</th>
                      <th className="py-2 pr-4">Total mixes</th>
                      <th className="py-2 pr-4">Unique mixers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {scratchComboRows.map((row, idx) => (
                      <tr
                        key={`${row.countryCode ?? "UNKNOWN"}-${
                          row.comboKey
                        }-${idx}`}
                      >
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {row.countryCode ?? "UNKNOWN"}
                        </td>
                        <td className="py-2 pr-4 text-xs font-mono text-neutral-800">
                          {row.comboKey}
                        </td>
                        <td className="py-2 pr-4 text-xs font-medium text-neutral-900">
                          {formatNumber(row.totalMixes)}
                        </td>
                        <td className="py-2 pr-4 text-xs text-neutral-700">
                          {formatNumber(row.uniqueMixers)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}