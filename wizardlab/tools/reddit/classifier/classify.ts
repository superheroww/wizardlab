import { openai, MODELS } from "@/tools/utils/openai";
import relevanceClassifierPrompt from "@/prompts/relevance_classifier";

export type ClassifierResult = {
  should_reply: boolean;
  confidence: number;
  reason: string;
};

type ClassifyPayload = {
  platform: string;
  permalink: string;
  title: string;
  body?: string;
};

const buildPrompt = ({ platform, permalink, title, body }: ClassifyPayload) => {
  const details = [
    `Platform: ${platform}`,
    `Permalink: ${permalink}`,
    `Title: ${title}`,
    body ? `Body: ${body}` : undefined,
  ].filter(Boolean);

  return [relevanceClassifierPrompt, ...details].join("\n\n");
};

export async function classifyRedditPost(payload: ClassifyPayload): Promise<ClassifierResult> {
  const prompt = buildPrompt(payload);

  const completion = await openai.chat.completions.create({
    model: MODELS.classifier,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = completion.choices?.[0]?.message?.content?.toString().trim();

  if (!content) {
    throw new Error("No content returned from classifier completion.");
  }

  try {
    return JSON.parse(content) as ClassifierResult;
  } catch (error) {
    throw new Error(`Failed to parse classifier response as JSON: ${(error as Error).message}`);
  }
}
