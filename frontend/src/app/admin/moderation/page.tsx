"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSurface } from "@/components/admin/admin-surface";
import { ActionModal } from "@/components/ui/action-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  sender_is_restricted_in_group?: boolean;
  trigger_text: string;
  message_content?: string | null;
  matched_reasons?: string | null;
  category: string;
  severity: string;
  detail: string;
  status: string;
  admin_note?: string | null;
  reviewed_by_username?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type ReportItem = {
  id: number;
  reporter_id: number;
  reporter_username: string;
  reported_user_id: number;
  reported_username: string;
  reported_user_display_name?: string | null;
  reported_user_is_suspended?: boolean | null;
  reported_user_is_restricted_in_group?: boolean;
  group_id: number;
  group_name?: string | null;
  message_id?: number | null;
  message_preview?: string | null;
  reason: string;
  details?: string | null;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by_username?: string | null;
  admin_note?: string | null;
};

type AdminDashboardData = {
  pending_alerts: number;
  high_risk_alerts: number;
  reviewed_alerts: number;
  pending_reports: number;
};

type ModerationCounts = {
  pending_review_count: number;
  high_risk_count: number;
  reviewed_count: number;
  reported_users_count: number;
  new_alerts_count: number;
};

const TAB_OPTIONS = [
  { key: "pending_review", label: "Pending Review" },
  { key: "high_risk", label: "High Risk" },
  { key: "reviewed", label: "Reviewed" },
  { key: "reported_users", label: "Reported Users" },
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = typedError?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return typedError?.message || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function severityClasses(severity: string) {
  if (severity === "high") return "border border-[#c43232]/30 bg-[#c43232]/18 text-[#ffd8d8]";
  if (severity === "medium") return "border border-[#f5d547]/25 bg-[#f5d547]/14 text-[#fdeca9]";
  return "border border-[#7c5bb8]/30 bg-[#7c5bb8]/18 text-[#e3d8ff]";
}

function statusClasses(status: string) {
  if (status === "high_risk") return "border border-[#c43232]/30 bg-[#c43232]/18 text-[#ffd8d8]";
  if (status === "reviewed") return "border border-[#1f8a52]/30 bg-[#1f8a52]/18 text-[#cbf4db]";
  if (status === "dismissed") return "border border-white/14 bg-white/8 text-[#d8cff0]";
  return "border border-[#7a56a8]/30 bg-[#7a56a8]/18 text-[#e5d8ff]";
}

export default function AdminModerationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") || "pending_review";
  const sort = searchParams.get("sort") || "newest";
  const range = searchParams.get("range") || "all";
  const severity = searchParams.get("severity") || "all";
  const reportStatus = searchParams.get("reportStatus") || "pending";
  const selectedUser = searchParams.get("user") || "all";
  const search = searchParams.get("search") || "";

  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [userSuspensionState, setUserSuspensionState] = useState<Record<number, boolean>>({});
  const [groupRestrictionState, setGroupRestrictionState] = useState<Record<string, boolean>>({});
  const [noteModal, setNoteModal] = useState<{ alertId: number; value: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  }, [router]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!isAuthed() || !isAdmin()) return;
    void loadPage();
  }, [tab, sort, range, reportStatus, severity]);

  useEffect(() => {
    if (!isAuthed() || !isAdmin()) return;
    void loadCounts();
    const interval = window.setInterval(() => {
      void loadCounts();
    }, 12000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchInput === search) return;
      updateQuery({ search: searchInput });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput, search]);

  async function loadPage() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const dashboardPromise = api.get("/admin/dashboard");
      const alertsPromise =
        tab === "reported_users"
          ? Promise.resolve({ data: [] })
          : api.get("/admin/alerts", {
              params: {
                status: tab,
                sort,
                range,
                severity: severity === "all" ? undefined : severity,
              },
            });
      const reportsPromise =
        tab === "reported_users"
          ? api.get("/admin/reports", {
              params: {
                status: reportStatus === "all" ? undefined : reportStatus,
                sort,
                range,
              },
            })
          : Promise.resolve({ data: [] });

      const [dashboardRes, alertsRes, reportsRes] = await Promise.all([
        dashboardPromise,
        alertsPromise,
        reportsPromise,
      ]);

      setDashboard(dashboardRes.data);
      const nextAlerts = Array.isArray(alertsRes.data) ? alertsRes.data : [];
      const nextReports = Array.isArray(reportsRes.data) ? reportsRes.data : [];
      setAlerts(nextAlerts);
      setReports(nextReports);
      setUserSuspensionState(() => {
        const nextState: Record<number, boolean> = {};
        nextAlerts.forEach((alert) => {
          if (typeof alert.sender_user_id === "number") {
            nextState[alert.sender_user_id] = Boolean(alert.sender_is_suspended);
          }
        });
        nextReports.forEach((report) => {
          nextState[report.reported_user_id] = Boolean(report.reported_user_is_suspended);
        });
        return nextState;
      });
      setGroupRestrictionState(() => {
        const nextState: Record<string, boolean> = {};
        nextAlerts.forEach((alert) => {
          if (typeof alert.sender_user_id === "number") {
            nextState[`${alert.group_id}:${alert.sender_user_id}`] = Boolean(alert.sender_is_restricted_in_group);
          }
        });
        nextReports.forEach((report) => {
          nextState[`${report.group_id}:${report.reported_user_id}`] = Boolean(report.reported_user_is_restricted_in_group);
        });
        return nextState;
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Could not load moderation data");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    try {
      const response = await api.get("/admin/moderation/counts");
      const counts = response.data as ModerationCounts;
      setDashboard((prev) => ({
        ...(prev || {
          pending_alerts: 0,
          high_risk_alerts: 0,
          reviewed_alerts: 0,
          pending_reports: 0,
        }),
        pending_alerts: counts.pending_review_count,
        high_risk_alerts: counts.high_risk_count,
        reviewed_alerts: counts.reviewed_count,
        pending_reports: counts.reported_users_count,
      }));
    } catch {
      // keep current counts if polling fails
    }
  }

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`/admin/moderation?${params.toString()}`);
  }

  function clearFilters() {
    updateQuery({
      tab,
      sort: "newest",
      range: "all",
      severity: "",
      reportStatus: tab === "reported_users" ? "pending" : "",
      user: "",
      search: "",
    });
  }

  async function updateAlert(alertId: number, action: "review" | "dismiss" | "escalate" | "resolve") {
    setBusyKey(`alert-${alertId}-${action}`);
    try {
      await api.patch(`/admin/alerts/${alertId}/${action}`, {
        admin_note: `${action} by admin`,
      });
      toast.success("Alert updated.");
      await Promise.all([loadPage(), loadCounts()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update alert"));
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleSuspend(userId: number, isSuspended: boolean) {
    setBusyKey(`user-${userId}`);
    setUserSuspensionState((prev) => ({ ...prev, [userId]: !isSuspended }));
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.sender_user_id === userId ? { ...alert, sender_is_suspended: !isSuspended } : alert
      )
    );
    setReports((prev) =>
      prev.map((report) =>
        report.reported_user_id === userId
          ? { ...report, reported_user_is_suspended: !isSuspended }
          : report
      )
    );
    try {
      if (isSuspended) {
        await api.patch(`/admin/users/${userId}/unsuspend`);
        toast.success("Account unsuspended.");
      } else {
        await api.patch(`/admin/users/${userId}/suspend`, {
          reason: "Suspended from moderation queue",
        });
        toast.success("Account suspended.");
      }
    } catch (error: unknown) {
      await loadPage();
      toast.error(getErrorMessage(error, "Could not update account"));
    } finally {
      setBusyKey(null);
    }
  }

  function getEffectiveSuspensionState(userId: number, fallback?: boolean | null) {
    if (typeof userId === "number" && userId in userSuspensionState) {
      return userSuspensionState[userId];
    }
    return Boolean(fallback);
  }

  function getRestrictionKey(groupId: number, userId: number) {
    return `${groupId}:${userId}`;
  }

  function getEffectiveRestrictionState(groupId: number, userId: number, fallback?: boolean | null) {
    const key = getRestrictionKey(groupId, userId);
    if (key in groupRestrictionState) return groupRestrictionState[key];
    return Boolean(fallback);
  }

  async function toggleRestriction(groupId: number, userId: number, makeRestriction: boolean) {
    setBusyKey(`restrict-${groupId}-${userId}`);
    try {
      if (makeRestriction) {
        await api.patch(`/admin/groups/${groupId}/members/${userId}/restrict`, {
          reason: "Restricted from moderation queue",
        });
        toast.success("User restricted in this group.");
      } else {
        await api.patch(`/admin/groups/${groupId}/members/${userId}/unrestrict`);
        toast.success("Group restriction removed.");
      }
      setGroupRestrictionState((prev) => ({
        ...prev,
        [getRestrictionKey(groupId, userId)]: makeRestriction,
      }));
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.group_id === groupId && alert.sender_user_id === userId
            ? { ...alert, sender_is_restricted_in_group: makeRestriction }
            : alert
        )
      );
      setReports((prev) =>
        prev.map((report) =>
          report.group_id === groupId && report.reported_user_id === userId
            ? { ...report, reported_user_is_restricted_in_group: makeRestriction }
            : report
        )
      );
    } catch (error: unknown) {
      console.error("Could not update group restriction", {
        error,
        status: (error as { response?: { status?: number } })?.response?.status,
        detail: (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail,
      });
      await loadPage();
      toast.error(
        getErrorMessage(
          error,
          "Could not restrict user. They may already be restricted or the backend rejected the request."
        )
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function updateReport(reportId: number, action: "review" | "dismiss") {
    setBusyKey(`report-${reportId}-${action}`);
    try {
      await api.patch(`/admin/reports/${reportId}/${action}`, {
        admin_note: `${action} by admin`,
      });
      toast.success("Report updated.");
      await Promise.all([loadPage(), loadCounts()]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update report"));
    } finally {
      setBusyKey(null);
    }
  }

  const cardItems = useMemo(
    () => [
      { label: "Pending Review", value: dashboard?.pending_alerts ?? 0, tabKey: "pending_review" },
      { label: "High Risk", value: dashboard?.high_risk_alerts ?? 0, tabKey: "high_risk" },
      { label: "Reviewed", value: dashboard?.reviewed_alerts ?? 0, tabKey: "reviewed" },
      { label: "Reported Users", value: dashboard?.pending_reports ?? 0, tabKey: "reported_users" },
    ],
    [dashboard]
  );

  const filteredAlerts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return alerts.filter((alert) => {
      if (selectedUser !== "all" && alert.sender_username !== selectedUser) return false;
      if (!needle) return true;
      return (
      [
        alert.sender_display_name,
        alert.sender_username,
        alert.group_name,
        alert.message_content,
        alert.trigger_text,
        alert.matched_reasons,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
      );
    });
  }, [alerts, search, selectedUser]);

  const filteredReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (selectedUser !== "all" && report.reported_username !== selectedUser) return false;
      if (!needle) return true;
      return (
      [
        report.reporter_username,
        report.reported_username,
        report.reported_user_display_name,
        report.group_name,
        report.reason,
        report.details,
        report.message_preview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
      );
    });
  }, [reports, search, selectedUser]);

  const userOptions = useMemo(() => {
    const names =
      tab === "reported_users"
        ? reports.map((report) => report.reported_username).filter(Boolean)
        : alerts.map((alert) => alert.sender_username).filter(Boolean);
    return ["all", ...Array.from(new Set(names)).sort((left, right) => left.localeCompare(right))];
  }, [alerts, reports, tab]);

  const activeChips = [
    range !== "all" ? `Range: ${range}` : null,
    sort !== "newest" ? `Sort: ${sort}` : null,
    severity !== "all" && tab !== "reported_users" ? `Severity: ${severity}` : null,
    tab === "reported_users" && reportStatus !== "pending" ? `Report status: ${reportStatus}` : null,
    selectedUser !== "all" ? `User: ${selectedUser}` : null,
    search ? `Search: ${search}` : null,
  ].filter(Boolean);

  async function saveAlertNote() {
    if (!noteModal) return;
    setBusyKey(`note-${noteModal.alertId}`);
    try {
      const response = await api.patch(`/admin/alerts/${noteModal.alertId}/note`, {
        admin_note: noteModal.value.trim() || null,
      });
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === noteModal.alertId
            ? {
                ...alert,
                admin_note: response.data?.admin_note ?? noteModal.value,
                reviewed_by_username: response.data?.reviewed_by_username ?? alert.reviewed_by_username,
                reviewed_at: response.data?.reviewed_at ?? alert.reviewed_at,
              }
            : alert
        )
      );
      toast.success("Admin note saved.");
      setNoteModal(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not save admin note"));
    } finally {
      setBusyKey(null);
    }
  }

  const tabCounts: Record<string, number> = {
    pending_review: dashboard?.pending_alerts ?? 0,
    high_risk: dashboard?.high_risk_alerts ?? 0,
    reviewed: dashboard?.reviewed_alerts ?? 0,
    reported_users: dashboard?.pending_reports ?? 0,
  };

  return (
    <AppShell>
      <AdminSurface variant="moderation">
      <div className="aurea-page mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-6">
          <Link href="/admin" className="aurea-link text-sm font-medium">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#FCF8F6]">Moderation Center</h1>
              <p className="mt-2 text-sm text-[#D8CFF0]">
                Review alerts, move high-risk cases forward, and manage user reports with a simpler filter flow.
              </p>
            </div>

            <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => void loadPage()}>
              Refresh
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cardItems.map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={() => updateQuery({ tab: card.tabKey, user: "" })}
                className={`rounded-[28px] border p-6 text-left shadow-sm transition-all duration-200 ${
                  tab === card.tabKey
                    ? "admin-active-chip"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                }`}
              >
                <div className="text-sm font-medium text-[#D8CFF0]">{card.label}</div>
                <div className="mt-4 text-4xl font-semibold text-[#FCF8F6]">{card.value}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {TAB_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => updateQuery({ tab: option.key, user: "" })}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  tab === option.key
                    ? "admin-active-chip text-white"
                    : "border-white/12 bg-white/6 text-[#F8F5FF] hover:bg-white/10"
                }`}
              >
                {option.label}
                <span className="ml-2 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs">
                  {tabCounts[option.key]}
                </span>
              </button>
            ))}
          </div>

          <Card className="aurea-panel rounded-[32px]">
            <CardContent className="grid gap-4 p-6">
              <div className="grid gap-4 lg:grid-cols-[160px_160px_180px_180px_1fr_auto]">
                <label className="grid gap-2 text-sm text-[#D8CFF0]">
                  <span>Date range</span>
                  <select
                    value={range}
                    onChange={(event) => updateQuery({ range: event.target.value })}
                    className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]"
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[#D8CFF0]">
                  <span>Sort</span>
                  <select
                    value={sort}
                    onChange={(event) => updateQuery({ sort: event.target.value })}
                    className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[#D8CFF0]">
                  <span>{tab === "reported_users" ? "Report status" : "Severity"}</span>
                  {tab === "reported_users" ? (
                    <select
                      value={reportStatus}
                      onChange={(event) => updateQuery({ reportStatus: event.target.value })}
                      className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="all">All statuses</option>
                    </select>
                  ) : (
                    <select
                      value={severity}
                      onChange={(event) => updateQuery({ severity: event.target.value })}
                      className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]"
                    >
                      <option value="all">All severities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  )}
                </label>

                <label className="grid gap-2 text-sm text-[#D8CFF0]">
                  <span>User</span>
                  <select
                    value={selectedUser}
                    onChange={(event) => updateQuery({ user: event.target.value })}
                    className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]"
                  >
                    {userOptions.map((userOption) => (
                      <option key={userOption} value={userOption}>
                        {userOption === "all" ? "All users" : userOption}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-[#D8CFF0]">
                  <span>Search</span>
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search group, user, message..."
                    className="rounded-2xl border-white/12 bg-[#140f25] text-[#F8F5FF] placeholder:text-[#AFA2C9]"
                  />
                </label>

                <div className="flex items-end">
                  <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              </div>

              {activeChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((chip) => (
                    <span key={chip} className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs text-[#D8CFF0]">
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="aurea-panel rounded-[32px]">
            <CardContent className="grid gap-4 p-6">
              {loading ? (
                <div className="grid gap-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`moderation-skeleton-${index}`} className="aurea-panel-soft rounded-[24px] p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="grid gap-3">
                          <div className="h-6 w-36 animate-pulse rounded-full bg-white/10" />
                          <div className="h-4 w-64 animate-pulse rounded-full bg-white/8" />
                          <div className="h-4 w-52 animate-pulse rounded-full bg-white/8" />
                          <div className="flex gap-2">
                            <div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />
                            <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-10 w-28 animate-pulse rounded-2xl bg-white/10" />
                          <div className="h-10 w-28 animate-pulse rounded-2xl bg-white/10" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : errorMessage ? (
                <div className="rounded-[24px] border border-red-400/20 bg-red-500/10 p-6 text-red-100">{errorMessage}</div>
              ) : tab === "reported_users" ? (
                filteredReports.length === 0 ? (
                  <div className="aurea-panel-soft rounded-[24px] border border-dashed p-6 text-[#D8CFF0]">
                    No reports match the current filters.
                  </div>
                ) : (
                  filteredReports.map((report) => (
                    <div key={report.id} className="aurea-panel-soft rounded-[24px] p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="grid gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-semibold text-[#FCF8F6]">Report #{report.id}</div>
                            <div className={`rounded-full px-3 py-1 text-sm font-medium ${statusClasses(report.status)}`}>
                              {report.status}
                            </div>
                          </div>
                          <div className="text-sm text-[#D8CFF0]">Reported user: <Link href={`/profile/${report.reported_username}?group=${report.group_id}`} className="font-medium text-[#FCF8F6] hover:text-[#F5D547]">{report.reported_user_display_name || report.reported_username}</Link></div>
                          <div className="text-sm text-[#D8CFF0]">Reported by: <Link href={`/profile/${report.reporter_username}?group=${report.group_id}`} className="font-medium text-[#FCF8F6] hover:text-[#F5D547]">@{report.reporter_username}</Link></div>
                          <div className="text-sm text-[#D8CFF0]">Group: <span className="font-medium text-[#FCF8F6]">{report.group_name || `Group ${report.group_id}`}</span></div>
                          <div className="text-sm text-[#D8CFF0]">Date: <span className="font-medium text-[#FCF8F6]">{formatDate(report.created_at)}</span></div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                              getEffectiveSuspensionState(report.reported_user_id, report.reported_user_is_suspended)
                                ? "bg-[#fde8ea] text-[#b42318]"
                                : "bg-[#e8f6ef] text-[#166534]"
                            }`}>
                              {getEffectiveSuspensionState(report.reported_user_id, report.reported_user_is_suspended) ? "Suspended" : "Active"}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                              getEffectiveRestrictionState(report.group_id, report.reported_user_id, report.reported_user_is_restricted_in_group)
                                ? "bg-[#f5d547]/16 text-[#f5d547]"
                                : "bg-white/8 text-[#d8cff0]"
                            }`}>
                              {getEffectiveRestrictionState(report.group_id, report.reported_user_id, report.reported_user_is_restricted_in_group)
                                ? "Restricted in group"
                                : "Not restricted in group"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {report.status === "pending" ? (
                            <>
                              <Button className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]" disabled={busyKey !== null} onClick={() => void updateReport(report.id, "review")}>
                                {busyKey === `report-${report.id}-review` ? "Saving..." : "Review Report"}
                              </Button>
                              <Button variant="outline" className="aurea-button-ghost rounded-2xl" disabled={busyKey !== null} onClick={() => void updateReport(report.id, "dismiss")}>
                                {busyKey === `report-${report.id}-dismiss` ? "Saving..." : "Dismiss Report"}
                              </Button>
                            </>
                          ) : null}
                          <Button
                            className={`rounded-2xl text-white ${
                              getEffectiveRestrictionState(report.group_id, report.reported_user_id, report.reported_user_is_restricted_in_group)
                                ? "bg-[#1f8a52] hover:bg-[#187042]"
                                : "bg-[#6a46a4] hover:bg-[#59398a]"
                            }`}
                            disabled={busyKey !== null}
                            onClick={() =>
                              void toggleRestriction(
                                report.group_id,
                                report.reported_user_id,
                                !getEffectiveRestrictionState(
                                  report.group_id,
                                  report.reported_user_id,
                                  report.reported_user_is_restricted_in_group
                                )
                              )
                            }
                          >
                            {busyKey === `restrict-${report.group_id}-${report.reported_user_id}`
                              ? "Updating..."
                              : getEffectiveRestrictionState(
                                    report.group_id,
                                    report.reported_user_id,
                                    report.reported_user_is_restricted_in_group
                                  )
                                ? "Unrestrict in This Group"
                                : "Restrict in This Group"}
                          </Button>
                          <Button
                            disabled={busyKey === `user-${report.reported_user_id}`}
                            className={`rounded-2xl text-white ${
                              getEffectiveSuspensionState(report.reported_user_id, report.reported_user_is_suspended)
                                ? "bg-[#1f8a52] hover:bg-[#187042]"
                                : "bg-[#c43232] hover:bg-[#a82626]"
                            }`}
                            onClick={() =>
                              void toggleSuspend(
                                report.reported_user_id,
                                getEffectiveSuspensionState(report.reported_user_id, report.reported_user_is_suspended)
                              )
                            }
                          >
                            {busyKey === `user-${report.reported_user_id}`
                              ? "Updating..."
                              : getEffectiveSuspensionState(report.reported_user_id, report.reported_user_is_suspended)
                                ? "Unsuspend Account"
                                : "Suspend Account"}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div className="aurea-panel-soft rounded-[20px] p-4">
                          <div className="text-sm font-semibold uppercase tracking-wide text-[#B8A9D6]">Reason</div>
                          <p className="mt-2 text-sm leading-7 text-[#FCF8F6]">{report.reason}</p>
                          <p className="mt-3 text-sm leading-7 text-[#D8CFF0]">{report.details || "No extra details."}</p>
                        </div>
                        <div className="aurea-panel-soft rounded-[20px] p-4">
                          <div className="text-sm font-semibold uppercase tracking-wide text-[#B8A9D6]">Message Preview</div>
                          <p className="mt-2 text-sm leading-7 text-[#FCF8F6]">{report.message_preview || "No linked message."}</p>
                          <p className="mt-3 text-sm leading-7 text-[#D8CFF0]">{report.admin_note || "No admin note yet."}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : filteredAlerts.length === 0 ? (
                <div className="aurea-panel-soft rounded-[24px] border border-dashed p-6 text-[#D8CFF0]">
                  No alerts match the current filters.
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div key={alert.id} className="aurea-panel-soft rounded-[24px] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-[#FCF8F6]">Alert #{alert.id}</div>
                          <div className={`rounded-full px-3 py-1 text-sm font-medium ${severityClasses(alert.severity)}`}>{alert.severity}</div>
                          <div className={`rounded-full px-3 py-1 text-sm font-medium ${statusClasses(alert.status)}`}>{alert.status}</div>
                        </div>
                        <div className="text-sm text-[#D8CFF0]">Sender: <Link href={`/profile/${alert.sender_username}?group=${alert.group_id}`} className="font-medium text-[#FCF8F6] hover:text-[#F5D547]">{alert.sender_display_name || alert.sender_username}</Link></div>
                        <div className="text-sm text-[#D8CFF0]">Group: <span className="font-medium text-[#FCF8F6]">{alert.group_name || `Group ${alert.group_id}`}</span></div>
                        <div className="text-sm text-[#D8CFF0]">Date: <span className="font-medium text-[#FCF8F6]">{formatDate(alert.created_at)}</span></div>
                        {alert.sender_user_id ? (
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                              getEffectiveSuspensionState(alert.sender_user_id, alert.sender_is_suspended)
                                ? "bg-[#fde8ea] text-[#b42318]"
                                : "bg-[#e8f6ef] text-[#166534]"
                            }`}>
                              {getEffectiveSuspensionState(alert.sender_user_id, alert.sender_is_suspended) ? "Suspended" : "Active"}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                              getEffectiveRestrictionState(alert.group_id, alert.sender_user_id, alert.sender_is_restricted_in_group)
                                ? "bg-[#f5d547]/16 text-[#f5d547]"
                                : "bg-white/8 text-[#d8cff0]"
                            }`}>
                              {getEffectiveRestrictionState(alert.group_id, alert.sender_user_id, alert.sender_is_restricted_in_group)
                                ? "Restricted in group"
                                : "Not restricted in group"}
                            </span>
                          </div>
                        ) : null}
                        {alert.reviewed_by_username ? (
                          <div className="text-sm text-[#D8CFF0]">Reviewed by: <span className="font-medium text-[#FCF8F6]">{alert.reviewed_by_username}</span>{alert.reviewed_at ? ` · ${formatDate(alert.reviewed_at)}` : ""}</div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {tab === "pending_review" ? (
                          <>
                            <Button className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]" disabled={busyKey !== null} onClick={() => void updateAlert(alert.id, "review")}>
                              {busyKey === `alert-${alert.id}-review` ? "Saving..." : "Review"}
                            </Button>
                            <Button className="rounded-2xl bg-[#7a56a8] text-white hover:bg-[#694896]" disabled={busyKey !== null} onClick={() => void updateAlert(alert.id, "escalate")}>
                              {busyKey === `alert-${alert.id}-escalate` ? "Saving..." : "Escalate to High Risk"}
                            </Button>
                            <Button variant="outline" className="aurea-button-ghost rounded-2xl" disabled={busyKey !== null} onClick={() => void updateAlert(alert.id, "dismiss")}>
                              {busyKey === `alert-${alert.id}-dismiss` ? "Saving..." : "Dismiss"}
                            </Button>
                          </>
                        ) : null}

                        {tab === "high_risk" && alert.sender_user_id ? (
                          <>
                            <Button
                              className={`rounded-2xl text-white ${
                                getEffectiveRestrictionState(alert.group_id, alert.sender_user_id, alert.sender_is_restricted_in_group)
                                  ? "bg-[#1f8a52] hover:bg-[#187042]"
                                  : "bg-[#6a46a4] hover:bg-[#59398a]"
                              }`}
                              disabled={busyKey !== null}
                              onClick={() =>
                                void toggleRestriction(
                                  alert.group_id,
                                  alert.sender_user_id!,
                                  !getEffectiveRestrictionState(
                                    alert.group_id,
                                    alert.sender_user_id!,
                                    alert.sender_is_restricted_in_group
                                  )
                                )
                              }
                            >
                              {busyKey === `restrict-${alert.group_id}-${alert.sender_user_id}`
                                ? "Updating..."
                                : getEffectiveRestrictionState(
                                      alert.group_id,
                                      alert.sender_user_id!,
                                      alert.sender_is_restricted_in_group
                                    )
                                  ? "Unrestrict in This Group"
                                  : "Restrict in This Group"}
                            </Button>
                            <Button
                              disabled={busyKey === `user-${alert.sender_user_id}`}
                              className={`rounded-2xl text-white ${
                                getEffectiveSuspensionState(alert.sender_user_id, alert.sender_is_suspended)
                                  ? "bg-[#1f8a52] hover:bg-[#187042]"
                                  : "bg-[#c43232] hover:bg-[#a82626]"
                              }`}
                              onClick={() =>
                                void toggleSuspend(
                                  alert.sender_user_id!,
                                  getEffectiveSuspensionState(alert.sender_user_id!, alert.sender_is_suspended)
                                )
                              }
                            >
                              {busyKey === `user-${alert.sender_user_id}`
                                ? "Updating..."
                                : getEffectiveSuspensionState(alert.sender_user_id!, alert.sender_is_suspended)
                                  ? "Unsuspend Account"
                                  : "Suspend Account"}
                            </Button>
                            <Button variant="outline" className="aurea-button-ghost rounded-2xl" disabled={busyKey !== null} onClick={() => void updateAlert(alert.id, "resolve")}>
                              {busyKey === `alert-${alert.id}-resolve` ? "Saving..." : "Mark as Resolved"}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                      <div className="aurea-panel-soft rounded-[20px] p-4">
                        <div className="text-sm font-semibold uppercase tracking-wide text-[#B8A9D6]">Message</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#FCF8F6]">{alert.message_content || alert.trigger_text}</p>
                      </div>
                      <div className="grid gap-3">
                        <div className="aurea-panel-soft rounded-[20px] p-4">
                          <div className="text-sm font-semibold uppercase tracking-wide text-[#B8A9D6]">Why it was flagged</div>
                          <p className="mt-2 text-sm leading-7 text-[#FCF8F6]">{alert.matched_reasons || alert.detail}</p>
                        </div>
                        <div className="aurea-panel-soft rounded-[20px] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold uppercase tracking-wide text-[#B8A9D6]">Admin Note</div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="aurea-button-ghost rounded-full"
                              onClick={() => setNoteModal({ alertId: alert.id, value: alert.admin_note || "" })}
                            >
                              {alert.admin_note ? "Edit note" : "Add note"}
                            </Button>
                          </div>
                          <p className="mt-2 text-sm leading-7 text-[#FCF8F6]">{alert.admin_note || "No admin note yet."}</p>
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
      </AdminSurface>

      <ActionModal
        open={noteModal !== null}
        title={noteModal?.value ? "Edit admin note" : "Add admin note"}
        description="Notes stay attached to this alert so moderation decisions are easier to follow later."
        onClose={() => setNoteModal(null)}
      >
        <div className="grid gap-4">
          <Textarea
            value={noteModal?.value || ""}
            onChange={(event) =>
              setNoteModal((prev) => (prev ? { ...prev, value: event.target.value } : prev))
            }
            rows={6}
            placeholder="Add context for the moderation team..."
            className="rounded-[20px] border-white/12 bg-[#140f25] text-[#f8f5ff] placeholder:text-[#afa2c9]"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="aurea-button-ghost rounded-2xl"
              onClick={() => setNoteModal(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]"
              disabled={!noteModal || busyKey === `note-${noteModal.alertId}`}
              onClick={() => void saveAlertNote()}
            >
              {noteModal && busyKey === `note-${noteModal.alertId}` ? "Saving..." : "Save note"}
            </Button>
          </div>
        </div>
      </ActionModal>
    </AppShell>
  );
}
