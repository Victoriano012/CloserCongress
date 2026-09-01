"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** A <details> menu that closes itself when the route changes. */
export function MobileMenu({
  className, children,
}: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);
  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
