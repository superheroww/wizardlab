import { generateRedditReply } from "@/tools/reddit/reply/generateReply";

async function main() {
  const samplePayload = {
    platform: "reddit",
    permalink: "https://reddit.com/r/investing/comments/def456/sample-thread",
    title: "Need a quick roundup of what ETFs actually hold",
    body: "The post is asking for a practical overview without sounding like hype.",
  };

  const reply = await generateRedditReply(samplePayload);
  console.log("Generated reply:", reply);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
