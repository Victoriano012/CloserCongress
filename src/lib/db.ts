import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = neon(url);

/**
 * `sql.query` with a row type.
 *
 * Select date columns as `::text`. Every date here is a calendar date with no
 * time and no zone; the driver would hand back a Date, which shifts by the
 * server's offset and which React refuses to render.
 */
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql.query(text, params)) as T[];
}
