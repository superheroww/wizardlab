import { NextRequest, NextResponse } from "next/server";
import { enrichPendingSocialIngest } from "@/lib/socialIngest/enrich";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function handleCronRequest() {
  const processed = await enrichPendingSocialIngest();
  return NextResponse.json({ processed });
}

async function runHandler() {
  try {
    return await handleCronRequest();
  } catch (error) {
    console.error("social_ingest: cron failed", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest) {
  return runHandler();
}

export async function POST(_req: NextRequest) {
  return runHandler();
}
