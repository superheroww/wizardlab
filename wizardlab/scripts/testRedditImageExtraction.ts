import assert from "node:assert/strict";
import { extractImageUrls } from "@/lib/social/fetchReddit";

const galleryPayload: Record<string, unknown> = {
  gallery_data: { items: [{ media_id: "abc" }, { media_id: "def" }] },
  media_metadata: {
    abc: {
      s: { u: "https://example.com/high-res.jpg" },
    },
    def: {
      s: { gif: { u: "https://example.com/looping.gif" } },
    },
  },
};

const singleImagePayload: Record<string, unknown> = {
  preview: {
    images: [
      {
        source: {
          url: "https://preview.redd.it/sample.jpg?width=320&amp;auto=webp",
        },
      },
    ],
  },
};

const noImagePayload: Record<string, unknown> = {
  title: "Just text",
  subreddit: "test",
};

function runTests() {
  const galleryImages = extractImageUrls(galleryPayload);
  assert.deepStrictEqual(galleryImages, [
    "https://example.com/high-res.jpg",
    "https://example.com/looping.gif",
  ]);

  const previewImages = extractImageUrls(singleImagePayload);
  assert.deepStrictEqual(previewImages, [
    "https://preview.redd.it/sample.jpg?width=320&auto=webp",
  ]);

  const emptyImages = extractImageUrls(noImagePayload);
  assert.deepStrictEqual(emptyImages, []);

  console.log("Reddit image extraction tests passed.");
}

runTests();
