import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bd-container py-24">
      <div className="bd-rule mb-6" />
      <h1 className="font-serif text-3xl font-semibold">There is nothing here</h1>
      <p className="mt-4 max-w-lg text-[var(--bd-muted)]">
        That bill or party is not in the record. It may never have existed, or the
        address may have a typo in it.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/bills"
          className="rounded-md bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          Browse the bills
        </Link>
        <Link
          href="/"
          className="rounded-md border border-[var(--bd-line)] bg-white px-5 py-3 font-medium hover:bg-blue-50"
        >
          Back to the start
        </Link>
      </div>
    </div>
  );
}
