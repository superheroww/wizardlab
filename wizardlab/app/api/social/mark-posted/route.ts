import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient();

  let body: { id?: string } = {};
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("social_engage")
    .update({
      status: "posted",
      posted_at: now,
      posted_by: "lab-dashboard",
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to mark social_engage row as posted", error);
    return NextResponse.json(
      { error: "Failed to update row" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
