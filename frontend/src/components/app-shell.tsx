"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AvatarBadge } from "@/components/avatar-badge";
import { clearAuth, getRole, getUsername, isAuthed } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("user");
  const [role, setRole] = useState("user");
  const [authed, setAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const syncProfile = async () => {
        const loggedIn = isAuthed();
        setAuthed(loggedIn);
        if (loggedIn) {
          try {
            const res = await api.get("/users/me");
            setAvatarUrl(res.data?.avatar_url || null);
          } catch {
            setAvatarUrl(null);
          }
        } else {
          setAvatarUrl(null);
        }
      };

      setMounted(true);
      setUsername(getUsername() || "user");
      setRole(getRole() || "user");
      void syncProfile();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const linkBase =
    "rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-[#f6eef4] transition hover:border-[#B9929F]/60 hover:bg-white/10";

  return (
    <div className="min-h-screen bg-[#0C0910] text-[#FCF8F6]">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#0C0910]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[#F5D547]/35 bg-[#fcf8f6] shadow-[0_0_40px_rgba(245,213,71,0.18)]">
              <Image
                src="/aurea-logo.jpg"
                alt="Aurea logo"
                fill
                className="object-cover"
                sizes="64px"
                priority
              />
            </div>

            <div>
              <div className="text-2xl font-semibold tracking-tight text-[#FCF8F6]">
                Aurea
              </div>
              <div className="text-sm text-[#B9929F]">
                Real-time child safety intelligence
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-3">
            <Link href="/" className={linkBase}>
              Home
            </Link>
            <Link href="/groups" className={linkBase}>
              Groups
            </Link>
            <Link href="/chat" className={linkBase}>
              Chat
            </Link>
            <Link href="/alerts" className={linkBase}>
              Alerts
            </Link>

            {mounted && authed && (
              <Link href="/profile" className={`${linkBase} flex items-center gap-3`}>
                <AvatarBadge
                  name={username}
                  avatarUrl={avatarUrl}
                  size="sm"
                />
                <span>View Profile</span>
              </Link>
            )}

            {mounted && role === "admin" && (
              <Link href="/admin" className={linkBase}>
                Admin
              </Link>
            )}

            {mounted && authed ? (
              <button
                onClick={logout}
                className="rounded-full border border-[#F5D547]/25 bg-[#453750] px-6 py-3 text-sm font-medium text-[#FCF8F6] transition hover:bg-[#5b4965]"
              >
                Logout ({username})
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-[#F5D547]/25 bg-[#453750] px-6 py-3 text-sm font-medium text-[#FCF8F6] transition hover:bg-[#5b4965]"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
