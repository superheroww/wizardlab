import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminUserRow = {
  id: string;
  createdAt: string;
  domain: string | null;
};

export async function fetchAdminUsers(limit = 500): Promise<AdminUserRow[]> {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase
    .schema("auth")
    .from("users")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch admin users", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const domain =
      row.email && row.email.includes("@") ? row.email.split("@")[1] : null;

    return {
      id: row.id,
      createdAt: row.created_at ?? "",
      domain,
    };
  });
}

export async function fetchAdminUserCount(): Promise<number> {
  const supabase = supabaseAdmin;
  const { count, error } = await supabase
    .schema("auth")
    .from("users")
    .select("*", { head: true, count: "exact" });

  if (error || count == null) {
    console.error("Failed to fetch admin user count", error);
    return 0;
  }

  return count;
}
