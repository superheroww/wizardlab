import type { ReactNode } from "react";

import { MainShell } from "@/components/layout/MainShell";
import { getInsightData } from "@/lib/insight";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const numberFormatter = new Intl.NumberFormat("en-US");
const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function InsightPage() {
  const insight = await getInsightData();

  return (
    <div className="flex flex-col gap-8">
      <MainShell
        title="Insight dashboard"
        description="Early behavior analytics summarizing mix volume, sources, and active users."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="Total mixes"
            value={numberFormatter.format(insight.summary.totalMixesLast7d)}
            sublabel="Last 7 days"
          />
          <SummaryCard
            title="Unique mixers"
            value={numberFormatter.format(insight.summary.uniqueMixersLast7d)}
            sublabel={`Repeat mixers: ${numberFormatter.format(
              insight.summary.repeatMixersLast7d
            )}`}
          />
          <SummaryCard title="Mixes by source (last 7 days)">
            <dl className="space-y-1">
              <div className="flex items-center justify-between text-sm text-neutral-600">
                <dt>Scratch</dt>
                <dd className="font-semibold text-neutral-900">
                  {numberFormatter.format(insight.summary.scratchMixesLast7d)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-600">
                <dt>Template</dt>
                <dd className="font-semibold text-neutral-900">
                  {numberFormatter.format(insight.summary.templateMixesLast7d)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-neutral-500">Last 7 days</p>
          </SummaryCard>
        </div>
      </MainShell>

      <MainShell
        title="Source engagement"
        description="Volume, reach, and depth by mix creation source."
      >
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Source
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Total mixes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Unique users
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Mixes per user
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              {insight.sourceEngagement.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    No source engagement data yet.
                  </td>
                </tr>
              ) : (
                insight.sourceEngagement.map((row) => (
                  <tr key={row.source}>
                    <td className="px-4 py-3 font-medium capitalize">{row.source}</td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.totalCount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.uniqueUsers)}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-600">
                      {decimalFormatter.format(row.avgMixesPerUser)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </MainShell>

      <MainShell
        title="Template ideas from scratch"
        description="Scratch-only mixes that show up repeatedly without a matching template (last 30 days)."
      >
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-[480px] divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Mix (top symbols)
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Scratch mixes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Unique users
                </th>
                <th scope="col" className="px-4 py-3">
                  First seen
                </th>
                <th scope="col" className="px-4 py-3">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              {insight.templateIdeas.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    No clear scratch-only patterns yet. Once more people build custom mixes,
                    likely template ideas will show up here.
                  </td>
                </tr>
              ) : (
                insight.templateIdeas.map((row) => (
                  <tr key={row.mixKey}>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {row.topSymbols.length > 0 ? row.topSymbols.join(" / ") : row.mixKey}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.scratchCount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.uniqueUsers)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(row.firstSeenAt)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDate(row.lastSeenAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </MainShell>

      <MainShell
        title="Power users"
        description="Top repeat mixers with first/last seen timestamps."
      >
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-[640px] divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Anon ID
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Total mixes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Scratch mixes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Template mixes
                </th>
                <th scope="col" className="px-4 py-3">
                  First seen
                </th>
                <th scope="col" className="px-4 py-3">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              {insight.powerUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    No repeat mixer data yet.
                  </td>
                </tr>
              ) : (
                insight.powerUsers.map((row) => (
                  <tr key={row.anonId}>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-neutral-700">
                      {shortAnonId(row.anonId)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.totalMixes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.scratchMixes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.templateMixes)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {formatDate(row.firstSeenAt)}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {formatDate(row.lastSeenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </MainShell>

      <MainShell
        title="Top templates"
        description="Templates that generated the most mix activity recently."
      >
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="min-w-[480px] divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Template
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Total mixes
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Unique users
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-900">
              {insight.templateEngagement.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm text-neutral-500"
                  >
                    No template usage yet.
                  </td>
                </tr>
              ) : (
                insight.templateEngagement.map((row, index) => (
                  <tr key={`${row.templateKey ?? "none"}-${index}`}>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {row.templateKey ?? "(none)"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.totalCount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {numberFormatter.format(row.uniqueUsers)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </MainShell>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sublabel,
  children,
}: {
  title: string;
  value?: ReactNode;
  sublabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      {value ? (
        <div className="mt-2 text-3xl font-semibold text-neutral-900">{value}</div>
      ) : null}
      {children ? <div className={value ? "mt-3" : "mt-2"}>{children}</div> : null}
      {sublabel ? <div className="mt-2 text-xs text-neutral-500">{sublabel}</div> : null}
    </div>
  );
}

function shortAnonId(raw: string) {
  if (!raw) return "unknown";
  return raw.slice(0, 8);
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
