import { openai, MODELS } from "@/tools/utils/openai";
import redditReplyPrompt from "@/prompts/reddit_reply";

type ReplyPayload = {
  platform: string;
  permalink: string;
  title: string;
  body?: string;
};

const buildPrompt = ({ platform, permalink, title, body }: ReplyPayload) => {
  const details = [
    `Platform: ${platform}`,
    `Permalink: ${permalink}`,
    `Title: ${title}`,
    body ? `Body: ${body}` : undefined,
  ].filter(Boolean);

  return [redditReplyPrompt, ...details].join("\n\n");
};

export async function generateRedditReply(payload: ReplyPayload): Promise<string> {
  const prompt = buildPrompt(payload);

  const completion = await openai.chat.completions.create({
    model: MODELS.reply,
    messages: [{ role: "user", content: prompt }],
  });

  const reply = completion.choices?.[0]?.message?.content?.toString().trim();

  if (!reply) {
    throw new Error("OpenAI reply generator returned an empty response.");
  }

  return reply;
}
