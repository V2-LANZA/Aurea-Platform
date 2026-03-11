"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthed } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthed()) router.replace("/login");
  }, [router]);

  return <>{children}</>;
}
