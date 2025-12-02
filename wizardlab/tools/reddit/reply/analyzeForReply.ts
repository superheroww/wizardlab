import { openai, MODELS } from "@/tools/utils/openai";
import { aiReplyDecisionPrompt } from "@/prompts/aiReplyDecision";

const CATEGORY_VALUES = [
  "portfolio_construction",
  "etf_selection",
  "asset_allocation",
  "stock_picking",
  "off_topic",
  "other",
] as const;

const PRIORITY_VALUES = ["low", "medium", "high"] as const;

type Category = (typeof CATEGORY_VALUES)[number];
type Priority = (typeof PRIORITY_VALUES)[number];

type RiskFlags = {
  is_personal_advice: boolean;
  mentions_leverage: boolean;
  mentions_options: boolean;
  mentions_crypto: boolean;
};

export interface AiReplyDecision {
  should_reply: boolean;
  reason: string;
  post_summary: string;
  category: Category;
  priority: Priority;
  reply_draft: string;
  risk_flags: RiskFlags;
}

/**
 * Analyzes a Reddit post to decide if WizardFolio should reply and generates a draft if yes.
 */
export async function analyzeForReply(params: {
  postTitle: string | null;
  postBody: string | null;
  url: string;
  subject: string | null;
  snippet: string | null;
}): Promise<AiReplyDecision> {
  const userMessage = buildUserMessage(params);

  const messages = [
    { role: "system" as const, content: aiReplyDecisionPrompt.system },
    { role: "user" as const, content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: MODELS.reply,
    temperature: 0.2,
    messages,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices?.[0]?.message?.content?.toString().trim();
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  return parseAiReplyDecision(raw);
}

/**
 * Build the user message by substituting template variables.
 */
function buildUserMessage(params: {
  postTitle: string | null;
  postBody: string | null;
  url: string;
  subject: string | null;
  snippet: string | null;
}): string {
  let template = aiReplyDecisionPrompt.userTemplate;

  // Substitute template variables
  template = template.replace(
    "{{post_title}}",
    params.postTitle?.trim() || "(Not provided)"
  );
  template = template.replace(
    "{{post_body}}",
    params.postBody?.trim() || "(Not provided)"
  );
  template = template.replace("{{url}}", params.url || "(Not provided)");
  template = template.replace(
    "{{subject}}",
    params.subject?.trim() || "(Not provided)"
  );
  template = template.replace(
    "{{snippet}}",
    params.snippet?.trim() || "(Not provided)"
  );

  return template;
}

/**
 * Parse and validate the AI response JSON.
 */
function parseAiReplyDecision(raw: string): AiReplyDecision {
  const parsed = parseJson(raw);
  if (!parsed) {
    throw new Error("Failed to parse JSON from OpenAI response.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("OpenAI response was not an object.");
  }

  const candidate = parsed as Record<string, unknown>;

  const shouldReply = candidate.should_reply;
  const reason = candidate.reason;
  const postSummary = candidate.post_summary;
  const category = candidate.category;
  const priority = candidate.priority;
  const replyDraftRaw = candidate.reply_draft;
  const riskFlags = candidate.risk_flags;

  if (typeof shouldReply !== "boolean") {
    throw new Error("Missing boolean should_reply.");
  }
  if (typeof reason !== "string") {
    throw new Error("Missing string reason.");
  }
  if (typeof postSummary !== "string") {
    throw new Error("Missing string post_summary.");
  }

  const normalizedCategory =
    typeof category === "string" ? category.trim().toLowerCase() : category;
  if (!isValidCategory(normalizedCategory)) {
    throw new Error(`Invalid category value: ${category}`);
  }

  const normalizedPriority =
    typeof priority === "string" ? priority.trim().toLowerCase() : priority;
  if (!isValidPriority(normalizedPriority)) {
    throw new Error(`Invalid priority value: ${priority}`);
  }

  if (typeof replyDraftRaw !== "string") {
    throw new Error("Missing string reply_draft.");
  }

  const resolvedRiskFlags = parseRiskFlags(riskFlags);
  if (!resolvedRiskFlags) {
    throw new Error("Missing or invalid risk_flags.");
  }

  const normalizedReply = shouldReply ? replyDraftRaw.trim() : "";

  return {
    should_reply: shouldReply,
    reason: reason.trim(),
    post_summary: postSummary.trim(),
    category: normalizedCategory,
    priority: normalizedPriority,
    reply_draft: normalizedReply,
    risk_flags: resolvedRiskFlags,
  };
}

/**
 * Parse JSON, trying to extract JSON object if wrapped in markdown or extra text.
 */
function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isValidCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_VALUES.includes(value as Category);
}

function isValidPriority(value: unknown): value is Priority {
  return typeof value === "string" && PRIORITY_VALUES.includes(value as Priority);
}

function parseRiskFlags(value: unknown): RiskFlags | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const isPersonalAdvice = candidate.is_personal_advice;
  const mentionsLeverage = candidate.mentions_leverage;
  const mentionsOptions = candidate.mentions_options;
  const mentionsCrypto = candidate.mentions_crypto;

  if (
    typeof isPersonalAdvice !== "boolean" ||
    typeof mentionsLeverage !== "boolean" ||
    typeof mentionsOptions !== "boolean" ||
    typeof mentionsCrypto !== "boolean"
  ) {
    return null;
  }

  return {
    is_personal_advice: isPersonalAdvice,
    mentions_leverage: mentionsLeverage,
    mentions_options: mentionsOptions,
    mentions_crypto: mentionsCrypto,
  };
}
