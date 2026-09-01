import "./_env";
import { runIngest } from "../src/lib/ingest";

function flag(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const days = flag("days", 7);
  const congress = flag("congress", 119);
  const limit = flag("limit", 200);
  console.log(`ingesting congress ${congress}, last ${days} days, limit ${limit}`);

  const started = Date.now();
  const s = await runIngest({
    days,
    congress,
    limit,
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) console.log(`  hydrated ${done}/${total}`);
    },
  });

  console.log(
    `${s.discovered} discovered, ${s.inserted} inserted, ${s.updated} updated, ` +
      `${s.skipped} skipped, ${s.errors} errors in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
  if (s.unknownStatuses.length) {
    console.log(`unanticipated GovTrack statuses: ${s.unknownStatuses.join(", ")}`);
  }
  for (const e of s.errorSamples) console.error(`  error ${e}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
