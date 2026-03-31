"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type AdminUser = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_suspended: boolean;
};

type GroupMember = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  is_suspended: boolean;
  joined_at: string;
};

type AdminGroup = {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
  created_by_username: string;
  member_count: number;
  members: GroupMember[];
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

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (!isAdmin()) {
      router.push("/");
      return;
    }
    loadReports();
  }, [router]);

  async function loadReports() {
    setLoading(true);
    try {
      const [dashboardRes, alertsRes, usersRes, groupsRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/admin/alerts"),
        api.get("/admin/users"),
        api.get("/admin/groups"),
      ]);

      setDashboard(dashboardRes.data);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load reports"));
    } finally {
      setLoading(false);
    }
  }

  const chartItems = dashboard
    ? [
        { label: "Flagged", value: dashboard.total_alerts, color: "bg-sky-400" },
        { label: "Pending", value: dashboard.pending_alerts, color: "bg-amber-400" },
        { label: "High risk", value: dashboard.high_severity_alerts, color: "bg-red-400" },
        { label: "Escalated", value: dashboard.escalated_alerts, color: "bg-fuchsia-400" },
        { label: "Suspended", value: dashboard.suspended_users, color: "bg-slate-500" },
      ]
    : [];

  const maxChartValue = Math.max(...chartItems.map((item) => item.value), 1);
  const reviewedCount = alerts.filter((alert) => alert.status === "reviewed").length;
  const dismissedCount = alerts.filter((alert) => alert.status === "dismissed").length;
  const mediumRiskCount = alerts.filter((alert) => alert.severity === "medium").length;
  const topReasons = alerts
    .flatMap((alert) => (alert.matched_reasons || alert.detail).split(","))
    .map((reason) => reason.trim())
    .filter(Boolean)
    .reduce<Record<string, number>>((acc, reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

  const reasonEntries = Object.entries(topReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  function exportIncidentReport() {
    downloadCsv(
      "aurea-incident-report.csv",
      [
        "alert_id",
        "status",
        "severity",
        "group_id",
        "group_name",
        "sender_username",
        "sender_display_name",
        "sender_email",
        "sender_suspended",
        "message_id",
        "message_content",
        "flag_reason",
        "admin_note",
        "reviewed_by",
        "reviewed_at",
        "created_at",
      ],
      alerts.map((alert) => [
        alert.id,
        alert.status,
        alert.severity,
        alert.group_id,
        alert.group_name || "",
        alert.sender_username,
        alert.sender_display_name || "",
        alert.sender_email || "",
        alert.sender_is_suspended ? "yes" : "no",
        alert.message_id || "",
        alert.message_content || alert.trigger_text,
        alert.matched_reasons || alert.detail,
        alert.admin_note || "",
        alert.reviewed_by_username || "",
        alert.reviewed_at || "",
        alert.created_at,
      ])
    );
  }

  function exportUsersReport() {
    downloadCsv(
      "aurea-users-report.csv",
      ["user_id", "username", "full_name", "email", "role", "is_suspended"],
      users.map((user) => [
        user.id,
        user.username,
        user.full_name || "",
        user.email,
        user.role,
        user.is_suspended ? "yes" : "no",
      ])
    );
  }

  function exportGroupsReport() {
    downloadCsv(
      "aurea-groups-report.csv",
      [
        "group_id",
        "group_name",
        "invite_code",
        "created_at",
        "created_by",
        "member_count",
        "member_usernames",
      ],
      groups.map((group) => [
        group.id,
        group.name,
        group.invite_code,
        group.created_at,
        group.created_by_username,
        group.member_count,
        group.members.map((member) => member.username).join(" | "),
      ])
    );
  }

  function exportSummaryReport() {
    if (!dashboard) return;

    downloadCsv(
      "aurea-summary-report.csv",
      ["metric", "value"],
      [
        ["total_users", dashboard.total_users],
        ["total_groups", dashboard.total_groups],
        ["total_messages", dashboard.total_messages],
        ["flagged_messages", dashboard.total_alerts],
        ["pending_reviews", dashboard.pending_alerts],
        ["high_risk_messages", dashboard.high_severity_alerts],
        ["escalated_cases", dashboard.escalated_alerts],
        ["suspended_users", dashboard.suspended_users],
        ["reviewed_cases", reviewedCount],
        ["dismissed_cases", dismissedCount],
      ]
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#0B132B]">
                Reports
              </h1>
              <p className="mt-1 text-sm text-[#3A506B]">
                Generate a quick visual snapshot and export CSV files for incidents, users, groups, and summary reporting.
              </p>
            </div>

            <Button
              variant="outline"
              className="rounded-2xl border-black/10 bg-white/80 px-5 shadow-sm"
              onClick={loadReports}
            >
              Refresh
            </Button>
          </div>

          <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                Exportable report files
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-3">
              <Button
                className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
                disabled={loading || !dashboard}
                onClick={exportSummaryReport}
              >
                Download summary CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={loading}
                onClick={exportIncidentReport}
              >
                Download incidents CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={loading}
                onClick={exportUsersReport}
              >
                Download users CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={loading}
                onClick={exportGroupsReport}
              >
                Download groups CSV
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-8 xl:grid-cols-[1.2fr_.8fr]">
            <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                  Moderation activity chart
                </CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div className="text-[#3A506B]">Loading chart...</div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid min-h-[260px] grid-cols-5 items-end gap-4 rounded-[24px] bg-[#F8FAFC] p-6">
                      {chartItems.map((item) => (
                        <div key={item.label} className="flex h-full flex-col justify-end gap-3">
                          <div className="flex justify-center text-sm font-semibold text-[#0B132B]">
                            {item.value}
                          </div>
                          <div
                            className={`w-full rounded-t-[18px] ${item.color}`}
                            style={{
                              height: `${Math.max((item.value / maxChartValue) * 180, 14)}px`,
                            }}
                          />
                          <div className="text-center text-xs font-medium uppercase tracking-wide text-[#3A506B]">
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-sm text-[#3A506B]">
                      This quick chart gives you a report-friendly picture of the current moderation load.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                  Snapshot
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <div className="rounded-[22px] bg-[#F8FAFC] p-4">
                  <div className="text-sm text-[#3A506B]">Reviewed cases</div>
                  <div className="text-3xl font-semibold text-[#0B132B]">{reviewedCount}</div>
                </div>
                <div className="rounded-[22px] bg-[#F8FAFC] p-4">
                  <div className="text-sm text-[#3A506B]">Dismissed cases</div>
                  <div className="text-3xl font-semibold text-[#0B132B]">{dismissedCount}</div>
                </div>
                <div className="rounded-[22px] bg-[#F8FAFC] p-4">
                  <div className="text-sm text-[#3A506B]">Medium risk messages</div>
                  <div className="text-3xl font-semibold text-[#0B132B]">{mediumRiskCount}</div>
                </div>
                <div className="rounded-[22px] bg-[#F8FAFC] p-4">
                  <div className="text-sm text-[#3A506B]">Latest incident</div>
                  <div className="mt-1 text-sm font-medium text-[#0B132B]">
                    {alerts[0] ? formatDate(alerts[0].created_at) : "No incidents yet"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
            <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                  Most common reasons
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                {loading ? (
                  <div className="text-[#3A506B]">Loading reasons...</div>
                ) : reasonEntries.length === 0 ? (
                  <div className="text-[#3A506B]">No flagged reasons available yet.</div>
                ) : (
                  reasonEntries.map(([reason, count]) => (
                    <div
                      key={reason}
                      className="flex items-center justify-between rounded-[20px] bg-[#F8FAFC] p-4"
                    >
                      <div className="pr-4 text-sm font-medium text-[#0B132B]">{reason}</div>
                      <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#0B132B]">
                        {count}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                  Report preview
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                {loading ? (
                  <div className="text-[#3A506B]">Loading preview...</div>
                ) : alerts.length === 0 ? (
                  <div className="text-[#3A506B]">No incidents to preview yet.</div>
                ) : (
                  alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-[20px] border border-black/5 bg-[#F8FAFC] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-[#0B132B]">
                          Alert #{alert.id} · {alert.group_name || `Group ${alert.group_id}`}
                        </div>
                        <div className="text-xs text-[#3A506B]">{formatDate(alert.created_at)}</div>
                      </div>
                      <div className="mt-2 text-sm text-[#3A506B]">
                        Sender:{" "}
                        <span className="font-medium text-[#0B132B]">
                          {alert.sender_display_name || alert.sender_username}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[#0B132B]">
                        {alert.message_content || alert.trigger_text}
                      </div>
                      <div className="mt-3 text-xs text-[#3A506B]">
                        Reason: {alert.matched_reasons || alert.detail}
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
