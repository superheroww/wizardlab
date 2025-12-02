// app/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import SocialEngageTable from "./lab/social-engage/SocialEngageTable";
import { SELECT_FIELDS, SocialEngageRow } from "./lab/social-engage/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "WizardLab — Recent Social Engagement",
  robots: { index: false, follow: false },
};

export default async function Home() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("social_engage")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as SocialEngageRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="space-y-3 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recent Social Engagement
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Review the latest <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.7rem] dark:bg-zinc-800">social_engage</code> rows. Filter by status
          (Ready / Others), sort any column, and quickly inspect AI replies.
        </p>
        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            Error loading data: {error.message}
          </div>
        )}
      </header>

      {rows.length === 0 && !error ? (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          No engagement rows found yet.
        </div>
      ) : (
        <SocialEngageTable rows={rows} filterMode="status" />
      )}
    </div>
  );
}