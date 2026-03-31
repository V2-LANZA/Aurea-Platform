"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const typedError = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = typedError?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String(item.msg)
          : JSON.stringify(item)
      )
      .join(", ");
  }
  if (detail && typeof detail === "object") {
    return "msg" in detail ? String(detail.msg) : JSON.stringify(detail);
  }
  return typedError?.message || fallback;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const statusFilter = searchParams.get("status") || "";

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (!isAdmin()) {
      router.push("/");
      return;
    }
    loadUsers();
  }, [router]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load users"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleSuspend(user: AdminUser) {
    setBusyId(user.id);
    try {
      if (user.is_suspended) {
        await api.patch(`/admin/users/${user.id}/unsuspend`);
        toast.success("User unsuspended");
      } else {
        await api.patch(`/admin/users/${user.id}/suspend`, {
          reason: "Suspended by admin",
        });
        toast.success("User suspended");
      }
      await loadUsers();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update user"));
    } finally {
      setBusyId(null);
    }
  }

  const visibleUsers =
    statusFilter === "suspended"
      ? users.filter((user) => user.is_suspended)
      : users;

  const title =
    statusFilter === "suspended" ? "Suspended users" : "All users";

  const description =
    statusFilter === "suspended"
      ? "See everyone who has been suspended and reverse the action if needed."
      : "Review the full user list, including account role and suspension status.";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#0B132B]">
                Admin Users
              </h1>
              <p className="mt-1 text-sm text-[#3A506B]">{description}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="rounded-2xl border-black/10 bg-white/80 px-5 shadow-sm"
                onClick={loadUsers}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-black/10 bg-white/80 px-5 shadow-sm"
                onClick={() =>
                  router.push(
                    statusFilter === "suspended" ? "/admin/users" : "/admin/users?status=suspended"
                  )
                }
              >
                {statusFilter === "suspended" ? "Show all users" : "Show suspended users"}
              </Button>
            </div>
          </div>

          <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                {title}
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              {loading ? (
                <div className="text-[#3A506B]">Loading users...</div>
              ) : visibleUsers.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-[#F8FAFC] p-6 text-[#3A506B]">
                  No users match this view.
                </div>
              ) : (
                visibleUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 rounded-[24px] border border-black/5 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="grid gap-1">
                      <div className="text-lg font-semibold text-[#0B132B]">
                        {user.full_name || user.username}
                      </div>
                      <div className="text-sm text-[#3A506B]">
                        @{user.username} · {user.email}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                          {user.role}
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            user.is_suspended
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {user.is_suspended ? "Suspended" : "Active"}
                        </div>
                      </div>
                    </div>

                    <Button
                      className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
                      disabled={busyId === user.id || user.role === "admin"}
                      onClick={() => toggleSuspend(user)}
                    >
                      {busyId === user.id
                        ? "Updating..."
                        : user.role === "admin"
                          ? "Admin protected"
                          : user.is_suspended
                            ? "Unsuspend user"
                            : "Suspend user"}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
