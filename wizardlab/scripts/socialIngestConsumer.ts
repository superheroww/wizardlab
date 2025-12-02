import { enrichPendingSocialIngest } from "@/lib/socialIngest/enrich";

async function main() {
  console.log("social_ingest_consumer: starting job");

  const processed = await enrichPendingSocialIngest();
  if (processed === 0) {
    console.log("social_ingest_consumer: no pending reddit rows found");
    return;
  }

  console.log("social_ingest_consumer: processed pending reddit rows", { processed });
}

main().catch((error) => {
  console.error("social_ingest_consumer: fatal error", error);
  process.exit(1);
});
