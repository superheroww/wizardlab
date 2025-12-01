import type { Metadata } from "next";

import { supabaseAdmin } from "@/lib/supabase/admin";

import SocialEngageTable from "./SocialEngageTable";
import { SELECT_FIELDS, SocialEngageRow } from "./types";

export const metadata: Metadata = {
  title: "Social Engagement Stream",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Page() {
  const { data, error } = await supabaseAdmin
    .from("social_engage")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as SocialEngageRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Social Engagement Stream</h1>
        <p className="text-sm text-zinc-600">
          Debug view of the Gmail/F5Bot → wizardLab AI pipeline. No actions can be taken here.
        </p>
      </header>

      <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
        <span>
          Loaded <span className="font-semibold text-zinc-900">{rows.length}</span> rows
        </span>
        <span>Showing latest 100 rows</span>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Error loading social_engage rows</p>
          <p>{error.message}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          No engagement rows found yet.
        </div>
      ) : (
        <SocialEngageTable rows={rows} />
      )}
    </div>
  );
}
