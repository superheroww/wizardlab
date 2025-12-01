import { NextRequest, NextResponse } from "next/server";
import { classifyRedditPost } from "@/tools/reddit/classifier/classify";
import { generateRedditReply } from "@/tools/reddit/reply/generateReply";
import { IngestPayload, insertEngagementRow } from "@/lib/socialEngage";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured (WEBHOOK_SECRET missing)." },
      { status: 500 }
    );
  }

  const token = req.headers.get("x-wizardlab-token");
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestBody: Partial<IngestPayload> | undefined;
  try {
    requestBody = await req.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { platform, permalink, title, body, source } = requestBody ?? {};
  if (!platform || !permalink || !title) {
    return NextResponse.json(
      { error: "Missing required fields: platform, permalink, and title are required." },
      { status: 400 }
    );
  }

  const payload: IngestPayload = { platform, permalink, title, body, source };

  try {
    const classification = await classifyRedditPost(payload);

    if (!classification.should_reply) {
      await insertEngagementRow({ payload, classifier: classification, replyText: "" });
      return NextResponse.json({ success: true, should_reply: false, classification });
    }

    const reply = await generateRedditReply(payload);
    await insertEngagementRow({ payload, classifier: classification, replyText: reply });
    return NextResponse.json({
      success: true,
      should_reply: true,
      reply,
      classification,
    });
  } catch (error) {
    console.error("Webhook ingestion error:", error);
    return NextResponse.json(
      { success: false, error: "Internal error processing webhook." },
      { status: 500 }
    );
  }
}
