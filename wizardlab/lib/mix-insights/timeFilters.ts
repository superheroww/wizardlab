export type InsightsTimeFilter = "today" | "last2d" | "last7d" | "all";

export const INSIGHTS_FILTERS: { id: InsightsTimeFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last2d", label: "Last 2 days" },
  { id: "last7d", label: "Last 7 days" },
  { id: "all", label: "All time" },
];

export function getFilterLabel(filter: InsightsTimeFilter | null | undefined) {
  return (
    INSIGHTS_FILTERS.find((candidate) => candidate.id === (filter ?? "today"))
      ?.label ?? "Today"
  );
}

export function getFromDateBoundary(
  filter: InsightsTimeFilter | null | undefined,
  nowInput?: Date
): string | null {
  const now = nowInput ?? new Date();
  const selected = filter ?? "today";

  if (selected === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  if (selected === "last2d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 2);
    return start.toISOString();
  }

  if (selected === "last7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return start.toISOString();
  }

  return null;
}
