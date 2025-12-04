import OpenAI from "openai";

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable.");
}

export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const MODELS = {
  classifier: process.env.OPENAI_MODEL_CLASSIFIER ?? "gpt-5-mini",
  reply: process.env.OPENAI_MODEL_REPLY ?? "gpt-5.1",
  ingest: process.env.OPENAI_MODEL_INGEST ?? "gpt-5.1",
  embedding: process.env.OPENAI_MODEL_EMBEDDING ?? "text-embedding-3-small",
};
