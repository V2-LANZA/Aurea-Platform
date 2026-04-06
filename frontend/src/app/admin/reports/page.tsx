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
              <h1 className="text-4xl font-semibold tracking-tight text-[#f5ecf8]">
                <span className="text-[#f5ecf8]">Reports</span>
              </h1>
              <p className="mt-1 text-sm text-[#dccfe3]">
                Generate a quick visual snapshot and export CSV files for incidents, users, groups, and summary reporting.
              </p>
            </div>

            <Button
              variant="outline"
              className="rounded-2xl border-[#eadbed] bg-[#f6edf8] px-5 text-[#4f3e58] shadow-sm hover:bg-white"
              onClick={loadReports}
            >
              Refresh
            </Button>
          </div>

          <Card className="rounded-[28px] border border-[#eadbed] bg-[#f6edf8] shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-[#2b1533]">
                Exportable report files
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-wrap gap-3">
              <Button
                className="rounded-2xl bg-[#5f4674] text-white hover:bg-[#72588a]"
                disabled={loading || !dashboard}
                onClick={exportSummaryReport}
              >
                Download summary CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-[#eadbed] bg-white text-[#4f3e58] hover:bg-[#fbf6fc]"
                disabled={loading}
                onClick={exportIncidentReport}
              >
                Download incidents CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-[#eadbed] bg-white text-[#4f3e58] hover:bg-[#fbf6fc]"
                disabled={loading}
                onClick={exportUsersReport}
              >
                Download users CSV
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-[#eadbed] bg-white text-[#4f3e58] hover:bg-[#fbf6fc]"
                disabled={loading}
                onClick={exportGroupsReport}
              >
                Download groups CSV
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-8 xl:grid-cols-[1.2fr_.8fr]">
            <Card className="rounded-[28px] border border-[#eadbed] bg-[#f6edf8] shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#2b1533]">
                  Moderation activity chart
                </CardTitle>
              </CardHeader>

              <CardContent className="max-h-[70vh] overflow-y-auto pr-2">
                {loading ? (
                  <div className="text-[#6d5a75]">Loading chart...</div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid min-h-[260px] grid-cols-5 items-end gap-4 rounded-[24px] bg-white p-6">
                      {chartItems.map((item) => (
                        <div key={item.label} className="flex h-full flex-col justify-end gap-3">
                          <div className="flex justify-center text-sm font-semibold text-[#2b1533]">
                            {item.value}
                          </div>
                          <div
                            className={`w-full rounded-t-[18px] ${item.color}`}
                            style={{
                              height: `${Math.max((item.value / maxChartValue) * 180, 14)}px`,
                            }}
                          />
                          <div className="text-center text-xs font-medium uppercase tracking-wide text-[#7d6783]">
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-sm text-[#6d5a75]">
                      This quick chart gives you a report-friendly picture of the current moderation load.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-[#eadbed] bg-[#f6edf8] shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#2b1533]">
                  Snapshot
                </CardTitle>
              </CardHeader>

              <CardContent className="grid max-h-[70vh] gap-3 overflow-y-auto pr-2">
                <div className="rounded-[22px] bg-white p-4">
                  <div className="text-sm text-[#7d6783]">Reviewed cases</div>
                  <div className="text-3xl font-semibold text-[#2b1533]">{reviewedCount}</div>
                </div>
                <div className="rounded-[22px] bg-white p-4">
                  <div className="text-sm text-[#7d6783]">Dismissed cases</div>
                  <div className="text-3xl font-semibold text-[#2b1533]">{dismissedCount}</div>
                </div>
                <div className="rounded-[22px] bg-white p-4">
                  <div className="text-sm text-[#7d6783]">Medium risk messages</div>
                  <div className="text-3xl font-semibold text-[#2b1533]">{mediumRiskCount}</div>
                </div>
                <div className="rounded-[22px] bg-white p-4">
                  <div className="text-sm text-[#7d6783]">Latest incident</div>
                  <div className="mt-1 text-sm font-medium text-[#2b1533]">
                    {alerts[0] ? formatDate(alerts[0].created_at) : "No incidents yet"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
            <Card className="rounded-[28px] border border-[#eadbed] bg-[#f6edf8] shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#2b1533]">
                  Most common reasons
                </CardTitle>
              </CardHeader>

              <CardContent className="grid max-h-[70vh] gap-3 overflow-y-auto pr-2">
                {loading ? (
                  <div className="text-[#6d5a75]">Loading reasons...</div>
                ) : reasonEntries.length === 0 ? (
                  <div className="text-[#6d5a75]">No flagged reasons available yet.</div>
                ) : (
                  reasonEntries.map(([reason, count]) => (
                    <div
                      key={reason}
                      className="flex items-center justify-between rounded-[20px] bg-white p-4"
                    >
                      <div className="pr-4 text-sm font-medium text-[#2b1533]">{reason}</div>
                      <div className="rounded-full bg-[#f1e2f4] px-3 py-1 text-sm font-semibold text-[#5f4674]">
                        {count}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-[#eadbed] bg-[#f6edf8] shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-[#2b1533]">
                  Report preview
                </CardTitle>
              </CardHeader>

              <CardContent className="grid max-h-[70vh] gap-3 overflow-y-auto pr-2">
                {loading ? (
                  <div className="text-[#6d5a75]">Loading preview...</div>
                ) : alerts.length === 0 ? (
                  <div className="text-[#6d5a75]">No incidents to preview yet.</div>
                ) : (
                  alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-[20px] border border-[#eadbed] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-[#2b1533]">
                          Alert #{alert.id} · {alert.group_name || `Group ${alert.group_id}`}
                        </div>
                        <div className="text-xs text-[#7d6783]">{formatDate(alert.created_at)}</div>
                      </div>
                      <div className="mt-2 text-sm text-[#6d5a75]">
                        Sender:{" "}
                        <span className="font-medium text-[#2b1533]">
                          {alert.sender_display_name || alert.sender_username}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[#2b1533]">
                        {alert.message_content || alert.trigger_text}
                      </div>
                      <div className="mt-3 text-xs text-[#7d6783]">
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
