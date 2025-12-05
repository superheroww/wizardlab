"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getFilterLabel,
  INSIGHTS_FILTERS,
  type InsightsTimeFilter,
} from "@/lib/mix-insights/timeFilters";

type TopItem = {
  key: string;
  count: number;
};

type TopCard = {
  templateKey: string;
  count: number;
  percentage: number;
};

type InsightsResponse = {
  topEtfs: TopItem[];
  topCombinations: TopItem[];
  topCards: TopCard[];
};

const numberFormatter = new Intl.NumberFormat("en-US");

export function MixInsightsSection() {
  const [timeFilter, setTimeFilter] = useState<InsightsTimeFilter>("today");
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/insights?timeFilter=${timeFilter}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error("Failed to load insights");
        }

        const payload = (await res.json()) as InsightsResponse;
        setData(payload);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    load();

    return () => controller.abort();
  }, [timeFilter]);

  const activeFilterLabel = useMemo(
    () => getFilterLabel(timeFilter),
    [timeFilter]
  );

  const topEtfs = data?.topEtfs ?? [];
  const topCombinations = data?.topCombinations ?? [];
  const topCards = data?.topCards ?? [];
  const showLoading = !data && isLoading;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Mix insights
          </h2>
          <p className="text-xs text-neutral-500">
            Top ETFs, combinations, and cards for the selected time window.
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto rounded-full bg-neutral-50 px-1 py-1 text-xs whitespace-nowrap">
          {INSIGHTS_FILTERS.map((filter) => {
            const isActive = timeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTimeFilter(filter.id)}
                className={[
                  "rounded-full px-3 py-1 font-medium transition",
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300",
                ].join(" ")}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Top 10 ETFs
              </h3>
              <p className="text-xs text-neutral-500">{activeFilterLabel}</p>
            </div>
            {isLoading && (
              <span className="text-xs font-medium text-neutral-400">Updating…</span>
            )}
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
                {showLoading ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-center text-sm text-neutral-500"
                    >
                      Loading insights…
                    </td>
                  </tr>
                ) : topEtfs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-center text-sm text-neutral-500"
                    >
                      No picks yet.
                    </td>
                  </tr>
                ) : (
                  topEtfs.map((item) => (
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
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Top 10 combinations
              </h3>
              <p className="text-xs text-neutral-500">{activeFilterLabel}</p>
            </div>
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
                {showLoading ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-4 text-center text-sm text-neutral-500"
                    >
                      Loading insights…
                    </td>
                  </tr>
                ) : topCombinations.length === 0 ? (
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
            <div>
              <h3 className="text-base font-semibold text-neutral-900">
                Top cards (by usage)
              </h3>
              <p className="text-xs text-neutral-500">{activeFilterLabel}</p>
            </div>
          </div>
          <ul className="space-y-2">
            {showLoading ? (
              <li className="px-3 py-4 text-center text-sm text-neutral-500">
                Loading insights…
              </li>
            ) : topCards.length === 0 ? (
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
                    {numberFormatter.format(card.count)} runs ·{" "}
                    {card.percentage.toFixed(1)}%
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
