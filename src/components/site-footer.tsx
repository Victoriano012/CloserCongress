import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--bd-line)] bg-white">
      <div className="bd-container flex flex-col gap-6 py-10 text-sm text-[var(--bd-muted)] sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md space-y-2">
          <p className="font-serif text-base font-semibold text-[var(--bd-navy)]">
            Closer Democracy
          </p>
          <p>
            This is a demonstration and has no relation to the government. Nothing here affects
            any law. The bills are real, but the electorate and parties are simulated.
          </p>
        </div>
        <nav className="flex flex-col gap-2 sm:text-right">
          <Link className="hover:text-[var(--bd-blue-deep)]" href="/how-it-works">
            How it works
          </Link>
          <Link className="hover:text-[var(--bd-blue-deep)]" href="/parties">
            The parties
          </Link>
          <Link className="hover:text-[var(--bd-blue-deep)]" href="/me">
            Your record
          </Link>
          <Link className="hover:text-[var(--bd-blue-deep)]" href="/methodology">
            Methodology
          </Link>
        </nav>
      </div>
    </footer>
  );
}
