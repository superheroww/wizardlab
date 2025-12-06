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

export type TemplateIdeaCandidate = {
  mixKey: string;
  topSymbols: string[];
  scratchCount: number;
  uniqueUsers: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type InsightData = {
  summary: InsightSummaryMetrics;
  sourceEngagement: SourceEngagementRow[];
  powerUsers: PowerUserRow[];
  templateEngagement: TemplateEngagementRow[];
  templateIdeas: TemplateIdeaCandidate[];
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
  templateIdeas: [],
};

type SupabaseServerClient = ReturnType<typeof createClient>;

type MixEventPosition = {
  symbol?: string | null;
  weightPct?: number | null;
};

function buildMixKey(
  positions: unknown,
  maxSymbols = 3
): { mixKey: string; topSymbols: string[] } {
  if (!Array.isArray(positions)) {
    return { mixKey: "unknown", topSymbols: [] };
  }

  const typed = (positions as MixEventPosition[])
    .filter((p) => p?.symbol)
    .map((p) => ({
      symbol: String(p.symbol).toUpperCase(),
      weight: typeof p.weightPct === "number" ? p.weightPct : 0,
    }))
    .filter((p) => p.weight > 0);

  if (typed.length === 0) {
    return { mixKey: "unknown", topSymbols: [] };
  }

  const top = typed
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxSymbols);

  const bucketed = top
    .map((p) => ({
      symbol: p.symbol,
      weightBucket: Math.round(p.weight / 5) * 5,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const mixKey = bucketed.map((p) => `${p.symbol}:${p.weightBucket}`).join("|");
  const topSymbols = bucketed.map((p) => p.symbol);

  return { mixKey, topSymbols };
}

async function getTemplateIdeaCandidates(
  supabase: SupabaseServerClient
): Promise<TemplateIdeaCandidate[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("mix_events")
    .select("id, positions, source, anon_id, created_at, template_key")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error || !data) {
    console.error("Failed to fetch mix_events for template ideas", error);
    return [];
  }

  type Row = {
    id: string;
    positions: unknown;
    source: string | null;
    anon_id: string | null;
    created_at: string;
    template_key: string | null;
  };

  const scratchStats = new Map<
    string,
    {
      topSymbols: string[];
      scratchCount: number;
      anonIds: Set<string>;
      firstSeenAt: string;
      lastSeenAt: string;
    }
  >();
  const templateMixKeys = new Set<string>();

  for (const row of data as Row[]) {
    const { mixKey, topSymbols } = buildMixKey(row.positions);

    if (mixKey === "unknown") continue;

    const createdAt = row.created_at;
    const anonId = row.anon_id ?? "unknown";

    if (row.source === "scratch") {
      let entry = scratchStats.get(mixKey);
      if (!entry) {
        entry = {
          topSymbols,
          scratchCount: 0,
          anonIds: new Set(),
          firstSeenAt: createdAt,
          lastSeenAt: createdAt,
        };
        scratchStats.set(mixKey, entry);
      }

      entry.scratchCount += 1;
      entry.anonIds.add(anonId);
      if (createdAt < entry.firstSeenAt) entry.firstSeenAt = createdAt;
      if (createdAt > entry.lastSeenAt) entry.lastSeenAt = createdAt;
    }

    if (row.source === "template") {
      templateMixKeys.add(mixKey);
    }
  }

  const MIN_SCRATCH_COUNT = 3;
  const MIN_UNIQUE_USERS = 2;
  const candidates: TemplateIdeaCandidate[] = [];

  for (const [mixKey, entry] of scratchStats.entries()) {
    if (templateMixKeys.has(mixKey)) continue;

    const uniqueUsers = entry.anonIds.size;

    if (entry.scratchCount >= MIN_SCRATCH_COUNT && uniqueUsers >= MIN_UNIQUE_USERS) {
      candidates.push({
        mixKey,
        topSymbols: entry.topSymbols,
        scratchCount: entry.scratchCount,
        uniqueUsers,
        firstSeenAt: entry.firstSeenAt,
        lastSeenAt: entry.lastSeenAt,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.scratchCount !== a.scratchCount) {
      return b.scratchCount - a.scratchCount;
    }
    if (b.uniqueUsers !== a.uniqueUsers) {
      return b.uniqueUsers - a.uniqueUsers;
    }
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });

  return candidates.slice(0, 5);
}

export async function getInsightData(): Promise<InsightData> {
  const supabase = createClient();
  const templateIdeasPromise = getTemplateIdeaCandidates(supabase);

  const { data, error } = await supabase.rpc("admin_get_insight_data");
  const templateIdeas = await templateIdeasPromise;

  if (error) {
    console.error("getInsightData: rpc admin_get_insight_data error", error);
    return { ...FALLBACK_INSIGHT_DATA, templateIdeas };
  }

  if (!data) {
    console.warn("getInsightData: rpc returned no data");
    return { ...FALLBACK_INSIGHT_DATA, templateIdeas };
  }

  // If your RPC returns the JSON with keys matching InsightData exactly,
  // this cast is fine. If you used snake_case in SQL, map the fields here.
  const rpcData = data as Omit<InsightData, "templateIdeas">;
  return {
    ...rpcData,
    templateIdeas,
  };
}
