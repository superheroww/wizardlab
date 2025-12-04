import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  let body: { id?: string } = {};

  try {
    body = await req.json();
  } catch (_error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("social_engage")
    .update({
      status: "posted",
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("social_mark_posted: update_failed", { id, error });
    return NextResponse.json(
      { error: "Failed to update row" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "ok" });
}
