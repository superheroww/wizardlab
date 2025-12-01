import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClassifierResult } from "@/tools/reddit/classifier/classify";
import { MODELS } from "@/tools/utils/openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type IngestPayload = {
  platform: string;
  permalink: string;
  title: string;
  body?: string;
  source?: string;
  trackingUrl?: string;
};

type InsertArgs = {
  payload: IngestPayload;
  classifier: ClassifierResult;
  replyText: string;
};

export async function insertEngagementRow({ payload, classifier, replyText }: InsertArgs) {
  const row = {
    platform: payload.platform,
    permalink: payload.permalink,
    title: payload.title,
    body: payload.body ?? null,
    classifier_model: MODELS.classifier,
    should_reply: classifier.should_reply,
    relevance_score: classifier.confidence,
    relevance_reason: classifier.reason,
    reply_model: MODELS.reply,
    reply_text: replyText ?? "",
    status: "pending",
    source: payload.source ?? "gmail-f5bot",
  };

  const { error } = await supabaseAdmin.from("social_engage").insert(row);

  if (error) {
    console.error("Failed to insert social_engage row", error);
    throw new Error(`Supabase insert error: ${error.message}`);
  }

  return row;
}

export async function findExistingEngagementByPermalink(
  client: SupabaseClient,
  platform: string,
  permalink: string
) {
  return client
    .from("social_engage")
    .select("id, status")
    .eq("platform", platform)
    .eq("permalink", permalink)
    .maybeSingle();
}
