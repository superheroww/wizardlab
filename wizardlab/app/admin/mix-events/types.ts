export type MixEventsTableRow = {
  id: string;
  createdAt: string;
  source: string | null;
  templateKey: string | null;
  benchmarkSymbol: string | null;
  referrer: string | null;
  anonId: string | null;
  positions: string;
};

export type RangeOption = "today" | "2d" | "all";
