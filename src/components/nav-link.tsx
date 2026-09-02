"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A nav <Link> that sets aria-current="page" when the current route is under `href`. */
export function NavLink({
  href, className, children,
}: { href: string; className: string; children: React.ReactNode }) {
  const active = isActivePath(usePathname() ?? "", href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
