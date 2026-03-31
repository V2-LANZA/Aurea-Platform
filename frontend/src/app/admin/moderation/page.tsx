"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { toast } from "sonner";

type AlertItem = {
  id: number;
  group_id: number;
  group_name?: string | null;
  message_id?: number | null;
  sender_username: string;
  sender_user_id?: number | null;
  sender_display_name?: string | null;
  sender_email?: string | null;
  sender_is_suspended?: boolean | null;
  trigger_text: string;
  message_content?: string | null;
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
  message_created_at?: string | null;
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

function formatDate(value?: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminModerationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const severity = searchParams.get("severity") || "";
  const status = searchParams.get("status") || "";

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (!isAdmin()) {
      router.push("/");
      return;
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthed() || !isAdmin()) return;
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, status]);

  async function loadPage() {
    setLoading(true);
    try {
      const [dashboardRes, alertsRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/admin/alerts", {
          params: {
            ...(severity ? { severity } : {}),
            ...(status ? { status } : {}),
          },
        }),
      ]);

      setDashboard(dashboardRes.data);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load moderation data"));
    } finally {
      setLoading(false);
    }
  }

  async function updateAlert(alertId: number, action: "review" | "dismiss" | "escalate") {
    setBusyKey(`alert-${alertId}-${action}`);
    try {
      await api.patch(`/admin/alerts/${alertId}/${action}`, {
        admin_note: `${action} by admin`,
      });
      toast.success(`Alert ${action}ed`);
      await loadPage();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, `Could not ${action} alert`));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleSuspend(alert: AlertItem) {
    if (!alert.sender_user_id) return;

    const isSuspended = Boolean(alert.sender_is_suspended);
    setBusyKey(`user-${alert.sender_user_id}`);
    try {
      if (isSuspended) {
        await api.patch(`/admin/users/${alert.sender_user_id}/unsuspend`);
        toast.success("User unsuspended");
      } else {
        await api.patch(`/admin/users/${alert.sender_user_id}/suspend`, {
          reason: `Suspended from alert ${alert.id}`,
        });
        toast.success("User suspended");
      }
      await loadPage();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update user"));
    } finally {
      setBusyKey(null);
    }
  }

  const cards = dashboard
    ? [
        { label: "Users", value: dashboard.total_users, href: "/admin/users" },
        { label: "Groups", value: dashboard.total_groups, href: "/admin/groups" },
        { label: "Flagged Messages", value: dashboard.total_alerts, href: "/admin/moderation" },
        { label: "Pending Review", value: dashboard.pending_alerts, href: "/admin/moderation?status=pending" },
        { label: "High Risk", value: dashboard.high_severity_alerts, href: "/admin/moderation?severity=high" },
        { label: "Escalated", value: dashboard.escalated_alerts, href: "/admin/moderation?status=escalated" },
        { label: "Suspended Users", value: dashboard.suspended_users, href: "/admin/users?status=suspended" },
        { label: "Reports", value: "Open", href: "/admin/reports" },
      ]
    : [];

  const filterLinks = [
    { label: "All flagged", href: "/admin/moderation", active: !severity && !status },
    { label: "Pending review", href: "/admin/moderation?status=pending", active: status === "pending" },
    { label: "High risk", href: "/admin/moderation?severity=high", active: severity === "high" },
    { label: "Escalated", href: "/admin/moderation?status=escalated", active: status === "escalated" },
    { label: "Reviewed", href: "/admin/moderation?status=reviewed", active: status === "reviewed" },
  ];

  let heading = "Flagged messages";
  let description =
    "See flagged chat content with the sender, the group it came from, and moderation actions in one place.";

  if (severity === "high") {
    heading = "High risk messages";
    description =
      "Focus on the riskiest flagged messages first. You can review, escalate, dismiss, or suspend the sender from here.";
  } else if (status === "escalated") {
    heading = "Escalated cases";
    description =
      "These are the cases that were escalated after review. Use this view to track the most serious incidents.";
  } else if (status === "pending") {
    heading = "Pending review";
    description =
      "Messages waiting for admin action. This is the closest equivalent to an alerts or reports queue in the current app.";
  } else if (status === "reviewed") {
    heading = "Reviewed cases";
    description = "Messages that have already been reviewed and closed out by an admin.";
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#0B132B]">
                Moderation Center
              </h1>
              <p className="mt-1 text-sm text-[#3A506B]">{description}</p>
            </div>

            <Button
              variant="outline"
              className="rounded-2xl border-black/10 bg-white/80 px-5 shadow-sm"
              onClick={loadPage}
            >
              Refresh
            </Button>
          </div>

          {!loading && cards.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              {cards.map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  className="block h-full cursor-pointer"
                  aria-label={`Open ${card.label}`}
                >
                  <Card className="h-full min-h-[180px] cursor-pointer rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex h-full flex-col justify-between p-6">
                      <div className="flex min-h-[3.5rem] items-start">
                        <p className="line-clamp-2 text-base font-medium leading-6 text-slate-500">
                          {card.label}
                        </p>
                      </div>

                      <div className="flex flex-1 items-end">
                        <p className="text-4xl font-semibold tracking-tight text-slate-900">
                          {card.value}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {filterLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  item.active
                    ? "border-[#0B132B] bg-[#0B132B] text-white"
                    : "border-black/10 bg-white text-[#0B132B] hover:bg-[#F8FAFC]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
            <CardContent className="grid gap-4 p-6">
              <div>
                <div className="text-2xl font-semibold text-[#0B132B]">{heading}</div>
                <div className="mt-1 text-sm text-[#3A506B]">
                  Each message shows who sent it and the group where it was posted. This app does not track a single recipient, because these are group messages.
                </div>
              </div>

              {loading ? (
                <div className="text-[#3A506B]">Loading moderation data...</div>
              ) : alerts.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-[#F8FAFC] p-6 text-[#3A506B]">
                  No messages match the current filter.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="grid gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-[#0B132B]">
                            Alert #{alert.id}
                          </div>
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

                        <div className="grid gap-1 text-sm text-[#3A506B]">
                          <div>
                            Sender:{" "}
                            <span className="font-medium text-[#0B132B]">
                              {alert.sender_display_name || alert.sender_username}
                            </span>
                            {alert.sender_email ? ` · ${alert.sender_email}` : ""}
                          </div>
                          <div>
                            Username:{" "}
                            <span className="font-medium text-[#0B132B]">
                              @{alert.sender_username || "unknown"}
                            </span>
                          </div>
                          <div>
                            Group:{" "}
                            <span className="font-medium text-[#0B132B]">
                              {alert.group_name || `Group ${alert.group_id}`}
                            </span>
                          </div>
                          <div>
                            Sent:{" "}
                            <span className="font-medium text-[#0B132B]">
                              {formatDate(alert.message_created_at || alert.created_at)}
                            </span>
                          </div>
                          {alert.reviewed_by_username && (
                            <div>
                              Reviewed by:{" "}
                              <span className="font-medium text-[#0B132B]">
                                {alert.reviewed_by_username}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          disabled={busyKey !== null}
                          onClick={() => updateAlert(alert.id, "review")}
                        >
                          {busyKey === `alert-${alert.id}-review` ? "Saving..." : "Review"}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          disabled={busyKey !== null}
                          onClick={() => updateAlert(alert.id, "dismiss")}
                        >
                          {busyKey === `alert-${alert.id}-dismiss` ? "Saving..." : "Dismiss"}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          disabled={busyKey !== null}
                          onClick={() => updateAlert(alert.id, "escalate")}
                        >
                          {busyKey === `alert-${alert.id}-escalate` ? "Saving..." : "Escalate"}
                        </Button>
                        {alert.sender_user_id && (
                          <Button
                            className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
                            disabled={busyKey !== null}
                            onClick={() => toggleSuspend(alert)}
                          >
                            {busyKey === `user-${alert.sender_user_id}`
                              ? "Updating..."
                              : alert.sender_is_suspended
                                ? "Unsuspend user"
                                : "Suspend user"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                      <div className="rounded-[20px] bg-[#F8FAFC] p-4">
                        <div className="text-sm font-semibold uppercase tracking-wide text-[#3A506B]">
                          Message
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-[#0B132B]">
                          {alert.message_content || alert.trigger_text || "Message content unavailable."}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-[20px] bg-[#F8FAFC] p-4">
                          <div className="text-sm font-semibold uppercase tracking-wide text-[#3A506B]">
                            Why it was flagged
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#0B132B]">
                            {alert.matched_reasons || alert.detail}
                          </p>
                        </div>

                        <div className="rounded-[20px] bg-[#F8FAFC] p-4">
                          <div className="text-sm font-semibold uppercase tracking-wide text-[#3A506B]">
                            Admin note
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#0B132B]">
                            {alert.admin_note || "No admin note yet."}
                          </p>
                        </div>
                      </div>
                    </div>
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
