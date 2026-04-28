"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { AvatarBadge } from "@/components/avatar-badge";
import { SupportBotWidget } from "@/components/support-bot-widget";
import { clearAuth, getRole, getUsername, isAuthed } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";

const ShellMountContext = createContext(false);

function shouldUseShell(pathname: string) {
  return !(
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password"
  );
}

function NavLink({
  href,
  label,
  count,
  linkBase,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  linkBase: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${linkBase} flex items-center gap-2 ${
        active
          ? "border-[#F5D547]/26 bg-white/12 text-[#FCF8F6] shadow-[0_0_24px_rgba(245,213,71,0.1)]"
          : ""
      }`}
    >
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
  const alreadyMounted = useContext(ShellMountContext);
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("user");
  const [role, setRole] = useState("user");
  const [authed, setAuthed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  const syncProfile = useCallback(async () => {
    const loggedIn = isAuthed();
    setAuthed(loggedIn);
    if (loggedIn) {
      try {
        const meRes = await api.get("/users/me");
        const nextUsername = meRes.data?.username || "user";
        const nextRole = meRes.data?.role || "user";
        setUsername(nextUsername);
        setRole(nextRole);
        setAvatarUrl(meRes.data?.avatar_url || null);

        const unreadRes = await api.get("/groups/unread-counts").catch(() => null);
        const alertCountPromise =
          nextRole === "admin"
            ? api.get("/admin/moderation/counts").catch(() => null)
            : Promise.resolve(null);
        const alertsRes = await alertCountPromise;

        setChatCount(
          unreadRes
            ? Number(unreadRes.data?.total_unread || 0)
            : 0
        );
        setAlertCount(
          alertsRes
            ? Number(alertsRes.data?.new_alerts_count || 0)
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
  }, []);

  useEffect(() => {
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
  }, [syncProfile]);

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const linkBase =
    "rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-[#F8F5FF] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[#B9929F]/60 hover:bg-white/10 hover:shadow-[0_10px_26px_rgba(0,0,0,0.18)]";

  const isActiveLink = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  if (alreadyMounted || !shouldUseShell(pathname)) {
    return <>{children}</>;
  }

  return (
    <ShellMountContext.Provider value={true}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_18%_16%,rgba(92,61,134,0.35),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(185,146,159,0.18),transparent_18%),radial-gradient(circle_at_52%_82%,rgba(36,17,63,0.94),transparent_34%),linear-gradient(180deg,#120B24_0%,#1B1235_48%,#0C0910_100%)] text-[#F8F5FF]">
        <header className="sticky top-0 z-50 border-b border-white/8 bg-[#120B24]/78 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[#F5D547]/25 bg-[#fcf8f6] shadow-[0_0_40px_rgba(245,213,71,0.16)]">
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
                <div className="text-sm text-[#B8A9D6]">
                  Youth chat safety prototype
                </div>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center gap-3">
              <NavLink href="/" label="Home" linkBase={linkBase} active={isActiveLink("/")} />
              <NavLink href="/groups" label="Groups" linkBase={linkBase} active={isActiveLink("/groups")} />
              <NavLink href="/chat" label="Chat" count={mounted && authed ? chatCount : 0} linkBase={linkBase} active={isActiveLink("/chat")} />
              <NavLink
                href="/alerts"
                label={mounted && role === "admin" ? "Safety" : "Safety"}
                count={mounted && role === "admin" ? alertCount : 0}
                linkBase={linkBase}
                active={isActiveLink("/alerts")}
              />

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
                <Link href="/admin" className={`${linkBase} ${isActiveLink("/admin") ? "border-[#F5D547]/26 bg-white/12 text-[#FCF8F6] shadow-[0_0_24px_rgba(245,213,71,0.1)]" : ""}`}>
                  Admin
                </Link>
              )}

              {mounted && authed ? (
                <button
                  onClick={logout}
                  className="rounded-full border border-[#F5D547]/20 bg-[#5c3d86] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#4f3473]"
                >
                  Logout ({username})
                </button>
              ) : (
                <Link
                href="/login"
                  className="rounded-full border border-[#F5D547]/20 bg-[#5c3d86] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#4f3473]"
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
    </ShellMountContext.Provider>
  );
}
