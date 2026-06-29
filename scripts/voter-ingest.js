#!/usr/bin/env node
import "dotenv/config";
import { openDb } from "../server/db.js";
import { ingestVoterFile, registerVoterFileInDb } from "../server/voter/warehouse.js";

function usage() {
  console.log(`Usage: npm run voter:ingest -- --client <client-id> --file <csv-path> [options]

Options:
  --source <label>   Display label for the file (default: CSV filename)
  --link             Symlink instead of copying the CSV into data/voter/
`);
}

function parseArgs(argv) {
  const out = { client: null, file: null, source: null, link: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--link") out.link = true;
    else if (arg === "--client") out.client = argv[++i];
    else if (arg === "--file") out.file = argv[++i];
    else if (arg === "--source") out.source = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.client || !args.file) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  console.log(`Ingesting voter file for client "${args.client}"…`);
  const started = Date.now();
  const manifest = await ingestVoterFile({
    clientId: args.client,
    sourcePath: args.file,
    source: args.source,
    link: args.link,
    onProgress: (n) => {
      if (n % 50000 < 2000) console.log(`  …${n.toLocaleString()} rows`);
    },
  });

  const db = openDb();
  registerVoterFileInDb(db, { clientId: args.client, manifest });
  db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
    "voter-ingest",
    `Ingested voter file for ${args.client}: ${manifest.source} (${manifest.recordCount.toLocaleString()} records)`,
    "Data"
  );
  db.close();

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${manifest.recordCount.toLocaleString()} records`);
  console.log(`  Unique addresses: ${manifest.uniqueAddresses.toLocaleString()}`);
  console.log(`  Run: npm run voter:geocode -- --client ${args.client}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
