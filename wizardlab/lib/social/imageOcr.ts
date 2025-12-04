import { logIngestError, logIngestInfo } from "@/lib/log/socialLog";
import { openai } from "@/tools/utils/openai";
import { RedditPostNormalized } from "@/lib/social/fetchReddit";

export type VisionConfig = {
  model: string | null;
  maxImages: number;
};

const DEFAULT_MAX_IMAGES = 1;
const PROMPT =
  "Extract all legible text from this image, especially portfolio-related content (tickers, weights, prices, account balances, dates). Return plain text only.";

function sanitizeHtml(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const withoutBreaks = value.replace(/<br\s*\/?>/gi, " ");
  const withoutTags = withoutBreaks.replace(/<\/?[^>]+>/gi, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

export function getVisionModelConfig(): VisionConfig {
  const modelRaw = process.env.SOCIAL_VISION_MODEL?.trim() || null;
  const maxImagesRaw = process.env.SOCIAL_IMAGE_OCR_MAX_IMAGES;
  const parsed = Number(maxImagesRaw);
  const maxImages =
    Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_IMAGES;
  return {
    model: modelRaw || null,
    maxImages,
  };
}

type ResponsesOutputBlock = {
  type?: string;
  text?: { value?: string | null };
};

type ResponsesOutput = {
  output?: Array<{
    content?: unknown;
  }>;
};

function buildResponseText(
  response: Awaited<ReturnType<typeof openai.responses.create>>
): string {
  const pieces: string[] = [];

  // The Responses API returns `output` as an array of messages.
  const outputs = (response as any).output ?? [];

  for (const output of outputs) {
    const contentBlocks = (output as any).content ?? [];
    if (!Array.isArray(contentBlocks)) continue;

    for (const block of contentBlocks) {
      if (!block || typeof block !== "object") continue;
      if ((block as any).type !== "output_text") continue;

      const rawText = (block as any).text;

      // Case 1: text is a plain string (what your logs show)
      if (typeof rawText === "string") {
        const trimmed = rawText.trim();
        if (trimmed) {
          pieces.push(trimmed);
        }
        continue;
      }

      // Case 2: text is an object with a `value` field
      if (rawText && typeof rawText === "object" && typeof (rawText as any).value === "string") {
        const trimmed = (rawText as any).value.trim();
        if (trimmed) {
          pieces.push(trimmed);
        }
      }
    }
  }

  return pieces.join("\n\n").trim();
}

async function runVisionOcr(imageUrl: string, model: string): Promise<string> {
  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: PROMPT },
          { type: "input_image", image_url: imageUrl },
        ],
      },
    ],
  });
  return buildResponseText(response);
}



export async function extractImageTextForPost(
  post: RedditPostNormalized
): Promise<{ enrichedInput: string; ocrFragments: string[] }> {
  const config = getVisionModelConfig();
  const baseText = sanitizeHtml(post.content_html ?? "");
  const images = (post.images ?? []).filter(Boolean);
  logIngestInfo("image_ocr", {
    message: "Starting image OCR enrichment",
    url: post.post_url,
    platform: "reddit",
    attempt: "ingest",
    extra: {
      image_count: images.length,
      max_images: config.maxImages,
      model: config.model,
    },
  });

  if (!config.model) {
    const message = "SOCIAL_VISION_MODEL missing; skipping image OCR.";
    logIngestError("image_ocr", {
      message,
      url: post.post_url,
      platform: "reddit",
      attempt: "ingest",
      reason: "config",
    });
    logIngestInfo("image_ocr", {
      message: "Completed OCR enrichment",
      url: post.post_url,
      platform: "reddit",
      attempt: "ingest",
      extra: {
        image_count: images.length,
        ocr_fragments_count: 0,
        enriched_input_length: baseText.length,
      },
    });
    return { enrichedInput: baseText, ocrFragments: [] };
  }

  if (images.length === 0) {
    logIngestInfo("image_ocr", {
      message: "Completed OCR enrichment",
      url: post.post_url,
      platform: "reddit",
      attempt: "ingest",
      extra: {
        image_count: 0,
        ocr_fragments_count: 0,
        enriched_input_length: baseText.length,
      },
    });
    return { enrichedInput: baseText, ocrFragments: [] };
  }

  const limited = images.slice(0, config.maxImages);
  const fragments: string[] = [];

  for (let index = 0; index < limited.length; index += 1) {
    const imageUrl = limited[index];
    logIngestInfo("image_ocr", {
      message: "Processing image for OCR",
      url: post.post_url,
      platform: "reddit",
      attempt: "ingest",
      extra: {
        image_url: imageUrl,
        index,
        model: config.model,
      },
    });

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Image fetch failed: ${response.status}`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logIngestError("image_ocr", {
        message: `Image OCR failed (fetch): ${detail}`,
        url: post.post_url,
        attempt: "ingest",
        reason: "fetch",
        platform: "reddit",
        extra: {
          image_url: imageUrl,
          index,
        },
      });
      continue;
    }

    try {
      const ocrText = await runVisionOcr(imageUrl, config.model);
      if (!ocrText) {
        continue;
      }

      fragments.push(ocrText);
      logIngestInfo("image_ocr", {
        message: "Image OCR success",
        url: post.post_url,
        platform: "reddit",
        attempt: "ingest",
        extra: {
          image_url: imageUrl,
          index,
          text_length: ocrText.length,
          text_preview: ocrText.slice(0, 120),
        },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logIngestError("image_ocr", {
        message: `Image OCR failed: ${detail}`,
        url: post.post_url,
        attempt: "ingest",
        reason: "ocr",
        platform: "reddit",
        extra: {
          image_url: imageUrl,
          index,
        },
      });
    }
  }

  const enrichedInput =
    fragments.length > 0
      ? `${baseText}\n\nImage text extracted (for enrichment):\n\n${fragments.join(
          "\n\n---\n\n"
        )}`
      : baseText;

  logIngestInfo("image_ocr", {
    message: "Completed OCR enrichment",
    url: post.post_url,
    platform: "reddit",
    attempt: "ingest",
    extra: {
      image_count: images.length,
      ocr_fragments_count: fragments.length,
      enriched_input_length: enrichedInput.length,
    },
  });

  return { enrichedInput, ocrFragments: fragments };
}
