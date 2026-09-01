import Link from "next/link";
import { MobileMenu } from "@/components/mobile-menu";

const NAV = [
  { href: "/bills", label: "Bills" },
  { href: "/parties", label: "Parties" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/me", label: "Your record" },
];

const LINK =
  "rounded-md px-3 py-2 text-[var(--bd-muted)] transition-colors hover:bg-blue-50 hover:text-[var(--bd-blue-deep)]";
const CTA =
  "rounded-md bg-blue-700 px-3.5 py-2 font-medium text-white transition-colors hover:bg-blue-800";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--bd-line)] bg-white/90 backdrop-blur">
      <div className="bd-container flex h-16 items-center gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--bd-navy)] text-[13px] font-bold text-white"
          >
            BD
          </span>
          <span className="truncate font-serif text-lg font-semibold text-[var(--bd-navy)]">
            BetterDemocracy
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 text-sm lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={LINK}>
              {item.label}
            </Link>
          ))}
          <Link href="/delegate" className={`ml-2 ${CTA}`}>
            Your list
          </Link>
        </nav>

        <MobileMenu className="bd-menu ml-auto lg:hidden">
          <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border border-[var(--bd-line)] text-[var(--bd-navy)]">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
            <span className="sr-only">Menu</span>
          </summary>

          <nav className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-[var(--bd-line)] bg-white p-4 text-sm shadow-lg">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={LINK}>
                {item.label}
              </Link>
            ))}
            <Link href="/delegate" className={`mt-1 text-center ${CTA}`}>
              Your list
            </Link>
          </nav>
        </MobileMenu>
      </div>
    </header>
  );
}
