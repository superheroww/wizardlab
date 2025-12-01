import { classifyRedditPost } from "@/tools/reddit/classifier/classify";

async function main() {
  const samplePayload = {
    platform: "reddit",
    permalink: "https://reddit.com/r/investing/comments/abc123/sample-post",
    title: "Is now the time to buy broad-market ETFs?",
    body: "I've been hearing a lot about diversifying, but not sure which ETF mixes to trust.",
  };

  const result = await classifyRedditPost(samplePayload);
  console.log("Classifier result:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
