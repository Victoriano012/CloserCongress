import { NextResponse } from "next/server";
import { secretEquals } from "@/lib/crypto";
import { runIngest } from "@/lib/ingest";

// Scheduled in vercel.json as "0 8 * * *". Vercel crons run in UTC and JSON
// has no comments, so the conversion lives here: 08:00 UTC is 04:00 US Eastern
// during daylight time (EDT, most of the congressional calendar) and 03:00
// during standard time (EST). Every run also re-checks in-progress bills, so
// outcomes that changed overnight are on the Bills page by morning.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed. An unset secret used to mean "open to the internet", which is
  // exactly the configuration mistake this check exists to catch.
  if (!secret) {
    return NextResponse.json({ error: "cron is not configured" }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!secretEquals(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Leave headroom under maxDuration so a slow govinfo stops cleanly and
    // reports a partial run rather than being killed mid-flight.
    const summary = await runIngest({
      days: 7,
      congress: 119,
      limit: 200,
      deadline: Date.now() + 250_000,
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    // The message can carry a database URL or an upstream URL; log it, don't serve it.
    console.error("cron ingest failed:", e);
    return NextResponse.json({ ok: false, error: "ingest failed" }, { status: 500 });
  }
}
