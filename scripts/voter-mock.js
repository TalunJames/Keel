#!/usr/bin/env node
import "dotenv/config";
import { openDb } from "../server/db.js";
import { registerVoterFileInDb } from "../server/voter/warehouse.js";
import { generateMockWarehouse } from "../server/voter/mock.js";

function usage() {
  console.log(`Usage: npm run voter:mock -- --client <client-id> [--count <n>]

Generates a synthetic, fully geocoded voter warehouse for demos/testing.
Voters are placed inside real El Paso County precinct polygons, so precinct,
state senate/house, and commissioner districts are internally consistent.

Options:
  --client <id>   Target client id (e.g. d11-colorado-springs)   [required]
  --count <n>     Approximate number of voters to generate        [default 25000]
`);
}

function parseArgs(argv) {
  const out = { client: null, count: 25000, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--client") out.client = argv[++i];
    else if (arg === "--count") out.count = Number(argv[++i]) || 25000;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.client) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  console.log(`Generating ~${args.count.toLocaleString()} mock voters for client "${args.client}"…`);
  const started = Date.now();
  const manifest = await generateMockWarehouse({
    clientId: args.client,
    count: args.count,
    onProgress: (n) => {
      if (n % 5000 < 300) console.log(`  …${n.toLocaleString()} voters`);
    },
  });

  const db = openDb();
  registerVoterFileInDb(db, { clientId: args.client, manifest });
  db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
    "voter-mock",
    `Generated mock voter warehouse for ${args.client} (${manifest.recordCount.toLocaleString()} records)`,
    "Data"
  );
  db.close();

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${manifest.recordCount.toLocaleString()} voters`);
  console.log(`  Precincts: ${manifest.precincts.length}, unique addresses: ${manifest.uniqueAddresses.toLocaleString()}`);
  console.log(`  All voters pre-geocoded — open the Voter Data module for client "${args.client}".`);
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
