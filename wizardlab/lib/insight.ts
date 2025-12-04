import { createClient } from "@/utils/supabase/server";

export type InsightSummaryMetrics = {
  totalMixesLast7d: number;
  uniqueMixersLast7d: number;
  repeatMixersLast7d: number;
  scratchMixesLast7d: number;
  templateMixesLast7d: number;
};

export type SourceEngagementRow = {
  source: "scratch" | "template" | "url" | string;
  totalCount: number;
  uniqueUsers: number;
  avgMixesPerUser: number;
};

export type PowerUserRow = {
  anonId: string;
  totalMixes: number;
  scratchMixes: number;
  templateMixes: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type TemplateEngagementRow = {
  templateKey: string | null;
  totalCount: number;
  uniqueUsers: number;
};

export type InsightData = {
  summary: InsightSummaryMetrics;
  sourceEngagement: SourceEngagementRow[];
  powerUsers: PowerUserRow[];
  templateEngagement: TemplateEngagementRow[];
};

const FALLBACK_INSIGHT_DATA: InsightData = {
  summary: {
    totalMixesLast7d: 0,
    uniqueMixersLast7d: 0,
    repeatMixersLast7d: 0,
    scratchMixesLast7d: 0,
    templateMixesLast7d: 0,
  },
  sourceEngagement: [],
  powerUsers: [],
  templateEngagement: [],
};

export async function getInsightData(): Promise<InsightData> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("admin_get_insight_data");

  if (error) {
    console.error("getInsightData: rpc admin_get_insight_data error", error);
    return FALLBACK_INSIGHT_DATA;
  }

  if (!data) {
    console.warn("getInsightData: rpc returned no data");
    return FALLBACK_INSIGHT_DATA;
  }

  // If your RPC returns the JSON with keys matching InsightData exactly,
  // this cast is fine. If you used snake_case in SQL, map the fields here.
  return data as InsightData;
}
