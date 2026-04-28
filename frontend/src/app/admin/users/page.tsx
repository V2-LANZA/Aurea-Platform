"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSurface } from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { toast } from "sonner";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_suspended: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as { response?: { data?: { detail?: string } }; message?: string };
  return typedError?.response?.data?.detail || typedError?.message || fallback;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") || "newest";
  const range = searchParams.get("range") || "all";
  const status = searchParams.get("status") || "";
  const search = searchParams.get("search") || "";

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (!isAdmin()) {
      router.push("/");
      return;
    }
    void loadUsers();
  }, [router, sort, range, status]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === search) return;
      updateQuery({ search: searchInput });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput, search]);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await api.get("/admin/users", { params: { sort, range, status } });
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not load users"));
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`/admin/users?${params.toString()}`);
  }

  async function toggleSuspend(user: AdminUser) {
    setBusyId(user.id);
    try {
      if (user.is_suspended) {
        await api.patch(`/admin/users/${user.id}/unsuspend`);
        toast.success("User unsuspended.");
      } else {
        await api.patch(`/admin/users/${user.id}/suspend`, { reason: "Suspended by admin" });
        toast.success("User suspended.");
      }
      await loadUsers();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update user"));
    } finally {
      setBusyId(null);
    }
  }

  const filteredUsers = users.filter((user) =>
    [user.username, user.email, user.full_name, user.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <AppShell>
      <AdminSurface variant="users">
      <div className="aurea-page mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-6">
          <Link href="/admin" className="aurea-link text-sm font-medium">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#FCF8F6]">Admin Users</h1>
              <p className="mt-2 text-sm text-[#D8CFF0]">
                Review account status, sort by time, and focus on suspended users when needed.
              </p>
            </div>

            <Button
              variant="outline"
              className="aurea-button-ghost rounded-2xl"
              onClick={() => void loadUsers()}
            >
              Refresh
            </Button>
          </div>

          <Card className="aurea-panel rounded-[32px]">
            <CardContent className="grid gap-4 p-6 lg:grid-cols-[180px_180px_180px_1fr_auto]">
              <label className="grid gap-2 text-sm text-[#D8CFF0]">
                <span>Date range</span>
                <select value={range} onChange={(event) => updateQuery({ range: event.target.value })} className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]">
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[#D8CFF0]">
                <span>Sort</span>
                <select value={sort} onChange={(event) => updateQuery({ sort: event.target.value })} className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[#D8CFF0]">
                <span>Status</span>
                <select value={status} onChange={(event) => updateQuery({ status: event.target.value })} className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]">
                  <option value="">All users</option>
                  <option value="suspended">Suspended only</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[#D8CFF0]">
                <span>Search</span>
                <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search user or email..." className="rounded-2xl border-white/12 bg-[#140f25] text-[#F8F5FF] placeholder:text-[#AFA2C9]" />
              </label>
              <div className="flex items-end">
                <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => updateQuery({ sort: "newest", range: "all", status: "", search: "" })}>
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="aurea-panel rounded-[32px]">
            <CardContent className="grid gap-4 p-6">
              {loading ? (
                <div className="grid gap-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={`users-skeleton-${index}`} className="aurea-panel-soft rounded-[24px] p-5">
                      <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
                      <div className="mt-3 h-4 w-56 animate-pulse rounded-full bg-white/8" />
                      <div className="mt-4 flex gap-2">
                        <div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />
                        <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="aurea-panel-soft rounded-[24px] border border-dashed p-6 text-[#D8CFF0]">
                  No users match this filter.
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="aurea-panel-soft flex flex-col gap-4 rounded-[24px] p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="grid gap-2">
                      <Link href={`/profile/${user.username}`} className="text-lg font-semibold text-[#FCF8F6] hover:text-[#F5D547]">
                        {user.full_name || user.username}
                      </Link>
                      <div className="text-sm text-[#D8CFF0]">
                        @{user.username} · {user.email}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="aurea-badge-soft rounded-full px-3 py-1 text-sm font-medium">
                          {user.role}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            user.is_suspended
                              ? "bg-[#fde8ea] text-[#b42318]"
                              : "bg-[#e8f6ef] text-[#166534]"
                          }`}
                        >
                          {user.is_suspended ? "Suspended" : "Active"}
                        </span>
                      </div>
                    </div>

                    <Button
                      disabled={busyId === user.id || user.role === "admin"}
                      className={`rounded-2xl text-white ${
                        user.is_suspended
                          ? "bg-[#1f8a52] hover:bg-[#187042]"
                          : "bg-[#c43232] hover:bg-[#a82626]"
                      }`}
                      onClick={() => void toggleSuspend(user)}
                    >
                      {busyId === user.id
                        ? "Updating..."
                        : user.role === "admin"
                          ? "Admin protected"
                          : user.is_suspended
                            ? "Unsuspend Account"
                            : "Suspend Account"}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </AdminSurface>
    </AppShell>
  );
}
