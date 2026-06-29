#!/usr/bin/env node
import "dotenv/config";
import { geocodeClientVoters } from "../server/voter/warehouse.js";

function usage() {
  console.log(`Usage: npm run voter:geocode -- --client <client-id>

Geocodes unique registration addresses via the US Census geocoder (free, no API key).
Results are cached in data/voter/<client-id>/geocode-cache.db for reuse across refreshes.
`);
}

async function main() {
  const clientId = process.argv.find((a, i) => process.argv[i - 1] === "--client");
  if (!clientId || process.argv.includes("--help")) {
    usage();
    process.exit(clientId ? 0 : 1);
  }

  console.log(`Geocoding addresses for "${clientId}"…`);
  const started = Date.now();
  const result = await geocodeClientVoters(clientId, {
    onProgress: ({ done, total, phase }) => {
      if (done % 10000 < 500 || done === total) {
        console.log(`  [${phase}] ${done.toLocaleString()} / ${total.toLocaleString()}`);
      }
    },
  });

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  Geocoded voters: ${result.geocodedCount.toLocaleString()}`);
  console.log(`  Unique addresses processed: ${result.uniqueAddresses.toLocaleString()}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
