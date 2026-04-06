"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AvatarBadge } from "@/components/avatar-badge";
import { SupportBotWidget } from "@/components/support-bot-widget";
import { clearAuth, getRole, getUsername, isAuthed } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";

function NavLink({
  href,
  label,
  count,
  linkBase,
}: {
  href: string;
  label: string;
  count?: number;
  linkBase: string;
}) {
  return (
    <Link href={href} className={`${linkBase} flex items-center gap-2`}>
      <span>{label}</span>
      {count && count > 0 ? (
        <span className="rounded-full bg-[#F5D547] px-2 py-0.5 text-xs font-semibold text-[#0C0910]">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("user");
  const [role, setRole] = useState("user");
  const [authed, setAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  useEffect(() => {
    const syncProfile = async () => {
      const loggedIn = isAuthed();
      setAuthed(loggedIn);
      if (loggedIn) {
        try {
          if (pathname.startsWith("/chat")) {
            await api.post("/groups/read-all");
          }

          const meRes = await api.get("/users/me");
          setUsername(meRes.data?.username || "user");
          setRole(meRes.data?.role || "user");
          setAvatarUrl(meRes.data?.avatar_url || null);

          const [unreadRes, alertsRes] = await Promise.allSettled([
            api.get("/groups/unread-summary"),
            api.get("/alerts"),
          ]);

          setChatCount(
            unreadRes.status === "fulfilled"
              ? Number(unreadRes.value.data?.total_unread || 0)
              : 0
          );
          setAlertCount(
            alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value.data)
              ? alertsRes.value.data.length
              : 0
          );
        } catch {
          setAvatarUrl(null);
          setChatCount(0);
          setAlertCount(0);
        }
      } else {
        setAvatarUrl(null);
        setChatCount(0);
        setAlertCount(0);
      }
    };

    const timer = window.setTimeout(() => {
      setMounted(true);
      setUsername(getUsername() || "user");
      setRole(getRole() || "user");
      void syncProfile();
    }, 0);

    const interval = window.setInterval(() => {
      void syncProfile();
    }, 15000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
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
            <NavLink href="/" label="Home" linkBase={linkBase} />
            <NavLink href="/groups" label="Groups" linkBase={linkBase} />
            <NavLink href="/chat" label="Chat" count={mounted && authed ? chatCount : 0} linkBase={linkBase} />
            <NavLink href="/alerts" label="Alerts" count={mounted && authed ? alertCount : 0} linkBase={linkBase} />

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
      {mounted && authed ? <SupportBotWidget /> : null}
    </div>
  );
}
