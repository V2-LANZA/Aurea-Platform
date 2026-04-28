"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteChangeEffects() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return null;
}
