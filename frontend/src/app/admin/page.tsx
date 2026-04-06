"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type AlertItem = {
  id: number;
  group_id: number;
  message_id?: number | null;
  sender_username: string;
  trigger_text: string;
  matched_reasons?: string | null;
  severity: string;
  level: string;
  detail: string;
  status: string;
  is_reviewed: boolean;
  admin_note?: string | null;
  reviewed_by_id?: number | null;
  reviewed_by_username?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type AdminDashboardData = {
  total_users: number;
  total_groups: number;
  total_messages: number;
  total_alerts: number;
  pending_alerts: number;
  high_severity_alerts: number;
  escalated_alerts: number;
  suspended_users: number;
  recent_alerts: AlertItem[];
};

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

function severityClasses(severity: string) {
  if (severity === "high") return "bg-red-100 text-red-700";
  if (severity === "medium") return "bg-amber-100 text-amber-700";
  return "bg-sky-100 text-sky-700";
}

function statusClasses(status: string) {
  if (status === "escalated") return "bg-red-100 text-red-700";
  if (status === "reviewed") return "bg-emerald-100 text-emerald-700";
  if (status === "dismissed") return "bg-slate-100 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

export default function AdminPage() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (!isAdmin()) {
      router.push("/");
      return;
    }
    loadAll();
  }, [router]);

  async function loadAll() {
    setLoading(true);
    try {
      const [dashboardRes, alertsRes, usersRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/admin/alerts"),
        api.get("/admin/users"),
      ]);

      setDashboard(dashboardRes.data);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load admin dashboard"));
    } finally {
      setLoading(false);
    }
  }

  async function updateAlert(
    alertId: number,
    action: "review" | "dismiss" | "escalate"
  ) {
    setBusyId(alertId);
    try {
      await api.patch(`/admin/alerts/${alertId}/${action}`, {
        admin_note: `${action} by admin`,
      });
      toast.success(`Alert ${action}ed`);
      await loadAll();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, `Could not ${action} alert`));
    } finally {
      setBusyId(null);
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
      await loadAll();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update user"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-6 py-10 text-[#4f3e58]">
          Loading admin dashboard...
        </div>
      </AppShell>
    );
  }

  const statCards = [
    { label: "Users", value: dashboard?.total_users ?? 0, href: "/admin/users" },
    { label: "Groups", value: dashboard?.total_groups ?? 0, href: "/admin/groups" },
    { label: "Flagged Messages", value: dashboard?.total_alerts ?? 0, href: "/admin/moderation" },
    { label: "Pending Review", value: dashboard?.pending_alerts ?? 0, href: "/admin/moderation?status=pending" },
    { label: "High Risk", value: dashboard?.high_severity_alerts ?? 0, href: "/admin/moderation?severity=high" },
    { label: "Escalated", value: dashboard?.escalated_alerts ?? 0, href: "/admin/moderation?status=escalated" },
    { label: "Suspended Users", value: dashboard?.suspended_users ?? 0, href: "/admin/users?status=suspended" },
    { label: "Reports", value: "Open", href: "/admin/reports" },
  ];

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#FCF8F6]">
                Admin Dashboard
              </h1>
              <p className="mt-1 text-sm text-[#ead8ea]">
                Monitor alerts, users, and moderation activity.
              </p>
            </div>

            <Button
              variant="outline"
              className="rounded-2xl border-white/10 bg-white/5 px-5 text-white shadow-sm hover:bg-white/10"
              onClick={loadAll}
            >
              Refresh
            </Button>
          </div>

          {dashboard && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              {statCards.map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  className="block h-full cursor-pointer"
                  aria-label={`Open ${card.label}`}
                >
                  <Card className="h-full min-h-[180px] cursor-pointer rounded-3xl border border-[#d8bfd8] bg-[#f3e6f4] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f8edf8] hover:shadow-md">
                    <CardContent className="flex h-full flex-col justify-between p-6">
                      <div className="flex min-h-[3.5rem] items-start">
                        <p className="line-clamp-2 text-base font-medium leading-6 text-[#6c4f71]">
                          {card.label}
                        </p>
                      </div>

                      <div className="flex flex-1 items-end">
                        <p className={`${typeof card.value === "string" ? "text-2xl" : "text-4xl"} font-semibold tracking-tight text-[#2b1533]`}>
                          {card.value}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <Card className="rounded-[28px] border border-[#d8bfd8] bg-[#f3e6f4] shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold text-[#2b1533]">
                Admin Guide
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-3 text-sm text-[#4f3e58]">
              <div className="rounded-2xl bg-white/70 px-4 py-3">
                Example grooming cues: “don’t tell your parents”, “send me a picture”, “where do you live”, “meet me alone”.
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-3">
                Example abuse cues: “kill yourself”, “fuck you”, “I hate you”, threats, slurs, or repeated humiliation.
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-3">
                Quick workflow: review the message, inspect the sender, escalate if serious, and suspend only when the behavior clearly puts others at risk.
              </div>
            </CardContent>
          </Card>


          <div className="grid gap-8 xl:grid-cols-[1.4fr_.9fr]">
            <Card className="rounded-[28px] border border-[#d8bfd8] bg-[#f3e6f4] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-[#2b1533]">
                  Moderation Queue
                </CardTitle>
              </CardHeader>

              <CardContent className="grid max-h-[70vh] gap-4 overflow-y-auto pr-2">
                {alerts.length === 0 ? (
                  <div className="text-[#4f3e58]">No alerts available.</div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-[24px] border border-[#dec9e0] bg-white/70 p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-[#2b1533]">
                            Alert #{alert.id}
                          </div>
                          <div className="mt-1 text-sm text-[#6b5b73]">
                            Sender: {alert.sender_username} · Group ID: {alert.group_id}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <div
                            className={`rounded-full px-3 py-1 text-sm font-medium ${severityClasses(
                              alert.severity
                            )}`}
                          >
                            {alert.severity}
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-sm font-medium ${statusClasses(
                              alert.status
                            )}`}
                          >
                            {alert.status}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-[#8b5f92]">
                            Trigger message
                          </div>
                          <div className="mt-1 text-[#2b1533]">{alert.trigger_text}</div>
                        </div>

                        <div className="rounded-2xl bg-white px-4 py-3">
                          <div className="text-xs font-medium uppercase tracking-wide text-[#8b5f92]">
                            Why flagged
                          </div>
                          <div className="mt-1 text-[#2b1533]">{alert.detail}</div>
                        </div>

                        <div className="text-xs text-[#7d6a80]">
                          Created: {new Date(alert.created_at).toLocaleString()}
                        </div>

                        {alert.reviewed_by_username && (
                          <div className="text-xs text-[#8f7d8f]">
                            Last reviewed by: {alert.reviewed_by_username}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            variant="outline"
                            className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                            disabled={busyId === alert.id}
                            onClick={() => updateAlert(alert.id, "review")}
                          >
                            Mark reviewed
                          </Button>

                          <Button
                            variant="outline"
                            className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                            disabled={busyId === alert.id}
                            onClick={() => updateAlert(alert.id, "dismiss")}
                          >
                            Dismiss
                          </Button>

                          <Button
                            className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                            disabled={busyId === alert.id}
                            onClick={() => updateAlert(alert.id, "escalate")}
                          >
                            Escalate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-[#d8bfd8] bg-[#f3e6f4] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-[#2b1533]">
                  User Control
                </CardTitle>
              </CardHeader>

              <CardContent className="grid max-h-[70vh] gap-3 overflow-y-auto pr-2">
                {users.length === 0 ? (
                  <div className="text-[#4f3e58]">No users found.</div>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-[24px] border border-[#dec9e0] bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#2b1533]">
                            {user.full_name || user.username}
                          </div>
                          <div className="text-sm text-[#5f4d66]">@{user.username}</div>
                          <div className="text-sm text-[#5f4d66]">{user.email}</div>

                          <div className="mt-2 flex gap-2">
                            <span className="rounded-full bg-[#e5d3e8] px-3 py-1 text-xs text-[#4f3e58]">
                              {user.role}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs ${
                                user.is_suspended
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {user.is_suspended ? "suspended" : "active"}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="rounded-2xl border-[#dec9e0] bg-white text-[#4f3e58] hover:bg-[#f8edf8]"
                          disabled={busyId === user.id || user.role === "admin"}
                          onClick={() => toggleSuspend(user)}
                        >
                          {user.is_suspended ? "Unsuspend" : "Suspend"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
