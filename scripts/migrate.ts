import "./_env";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { PARTIES } from "../src/lib/parties";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const schema = readFileSync("db/schema.sql", "utf8");
  // neon's http driver runs one statement per call; split on ";" at line ends.
  const statements = schema
    .split(/;\s*$/m)
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`applied ${statements.length} statements`);

  for (const [i, p] of PARTIES.entries()) {
    await sql.query(
      `insert into parties (slug, name, emoji, axis, tagline, scope, stance, color, is_blank, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (slug) do update set
         name = excluded.name, emoji = excluded.emoji, axis = excluded.axis,
         tagline = excluded.tagline, scope = excluded.scope, stance = excluded.stance,
         color = excluded.color, is_blank = excluded.is_blank, sort_order = excluded.sort_order`,
      [p.slug, p.name, p.emoji, p.axis, p.tagline, p.scope, p.stance, p.color, !!p.isBlank, i],
    );
  }
  console.log(`seeded ${PARTIES.length} parties`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
