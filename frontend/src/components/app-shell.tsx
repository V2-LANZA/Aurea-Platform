"use client";

import Link from "next/link";
import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAuth, getUsername, isAuthed } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(isAuthed());
    setUser(getUsername());
  }, []);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7FBFF] via-white to-[#F2FFFD]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <Sparkles className="h-5 w-5 text-[#5BC0BE]" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-[#0B132B]">
              Aurea
            </div>
            <div className="text-sm text-[#3A506B]">
              whimsical safety-first live chat prototype
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/chat">Chat</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/alerts">Alerts</Link>
          </Button>

          {authed ? (
            <Button onClick={logout} className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]">
              <LogOut className="mr-2 h-4 w-4" />
              Logout {user ? `(${user})` : ""}
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  );
}
