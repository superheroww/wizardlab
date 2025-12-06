import { supabaseAdmin } from "@/lib/supabase/admin";

export type AdminUserRow = {
  id: string;
  createdAt: string;
  domain: string | null;
};

export async function fetchAdminUsers(limit = 500): Promise<AdminUserRow[]> {
  const supabase = supabaseAdmin;
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: limit,
  });

  if (error || !data) {
    console.error("Failed to fetch admin users", error);
    return [];
  }

  const users = data.users ?? [];

  return users.map((row) => {
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
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (error || !data) {
    console.error("Failed to fetch admin user count", error);
    return 0;
  }

  return data.total ?? data.users?.length ?? 0;
}
