import { supabaseAdmin } from "@/lib/supabase/admin";
import { MODELS, openai } from "@/tools/utils/openai";

const SEMANTIC_THRESHOLD = Number(
  process.env.SOCIAL_SEMANTIC_DUPLICATE_THRESHOLD ?? "0.92"
);

export async function computeEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await openai.embeddings.create({
    model: MODELS.embedding,
    input: normalized,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("OpenAI did not return an embedding vector");
  }

  return embedding.map((value) => Number(value));
}

export async function findSemanticDuplicate(params: {
  platform: string;
  author: string | null;
  embedding: number[];
  excludeId: string;
}): Promise<{ id: string; similarity: number } | null> {
  const { platform, author, embedding, excludeId } = params;

  if (!author) {
    // Semantic dedupe is scoped to a single author to avoid false positives.
    return null;
  }

  const { data, error } = await supabaseAdmin.rpc(
    "social_find_semantic_duplicates",
    {
      p_platform: platform,
      p_author: author,
      p_embedding: embedding,
      p_threshold: SEMANTIC_THRESHOLD,
    }
  );

  if (error) {
    throw new Error(`Semantic duplicate lookup failed: ${error.message}`);
  }

  const candidates = Array.isArray(data)
    ? (data as Array<{ id?: string; similarity?: number }>)
    : [];

  const match = candidates.find((candidate) => {
    if (!candidate?.id || candidate.id === excludeId) {
      return false;
    }
    return typeof candidate.similarity === "number";
  });

  if (!match || !match.id || typeof match.similarity !== "number") {
    return null;
  }

  return {
    id: match.id,
    similarity: match.similarity,
  };
}
