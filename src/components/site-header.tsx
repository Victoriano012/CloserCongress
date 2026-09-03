import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLink } from "@/components/nav-link";

const NAV = [
  { href: "/parties", label: "Parties" },
  { href: "/bills", label: "Bills" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/delegate", label: "My list" },
];

const LINK =
  "rounded-md px-3 py-2 text-[var(--bd-muted)] transition-colors hover:bg-blue-50 hover:text-[var(--bd-blue-deep)] aria-[current=page]:bg-blue-50 aria-[current=page]:font-semibold aria-[current=page]:text-[var(--bd-navy)] aria-[current=page]:shadow-[inset_0_-2px_0_var(--bd-blue)]";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--bd-line)] bg-white/90 backdrop-blur">
      <div className="bd-container flex h-16 items-center gap-4">
        <Link href="/" aria-label="Closer Congress home" className="min-w-0">
          <Logo
            size={32}
            wordmark="Closer Congress"
            title="Closer Congress ballot logo"
            className="text-[var(--bd-navy)]"
            wordmarkClassName="font-wordmark text-xl tracking-tight md:text-[1.625rem]"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 text-sm lg:flex">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} className={LINK}>
              {item.label}
            </NavLink>
          ))}
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
              <NavLink key={item.href} href={item.href} className={LINK}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </MobileMenu>
      </div>
    </header>
  );
}
