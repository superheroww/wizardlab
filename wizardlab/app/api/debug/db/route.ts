import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("id", { ascending: true })
    .limit(1000);

  return Response.json({ data, error });
}