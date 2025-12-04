import { supabaseAdmin } from "@/lib/supabase/admin";

export type TopCard = {
  templateKey: string;
  count: number;
  percentage: number;
};

export async function getTopCards(): Promise<TopCard[]> {
  const totalResult = await supabaseAdmin
    .from("mix_events")
    .select("id", { count: "exact", head: true });

  if (totalResult.error) {
    throw totalResult.error;
  }

  const totalMixEvents = totalResult.count ?? 0;

  const { data, error } = await supabaseAdmin
    .from("mix_events")
    .select("template_key")
    .not("template_key", "is", null);

  if (error) {
    throw error;
  }

  const rows = data ?? [];

  const counts = rows.reduce((acc, row) => {
    const key = row.template_key ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(counts)
    .map(([templateKey, count]) => ({
      templateKey,
      count,
      percentage: totalMixEvents === 0 ? 0 : (count / totalMixEvents) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}
