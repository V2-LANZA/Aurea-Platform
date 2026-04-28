"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSurface } from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { toast } from "sonner";

type Point = { label: string; value: number };
type Analytics = {
  summary: {
    total_alerts: number;
    pending_review_alerts: number;
    high_risk_alerts: number;
    reviewed_alerts: number;
    dismissed_alerts: number;
    total_user_reports: number;
    suspended_users: number;
    restricted_groups: number;
    active_group_restrictions: number;
    suspended_groups: number;
  };
  alerts_by_severity: Point[];
  alerts_by_status: Point[];
  reports_by_reason: Point[];
  safety_activity_over_time: Point[];
  top_flagged_groups: Point[];
  top_risk_categories: Point[];
};

type RecentReport = {
  id: number;
  reporter_username: string;
  reported_username: string;
  group_name?: string | null;
  reason: string;
  details?: string | null;
  message_preview?: string | null;
  created_at: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as { response?: { data?: { detail?: string } }; message?: string };
  return typedError?.response?.data?.detail || typedError?.message || fallback;
}

function BarChartCard({ title, points }: { title: string; points: Point[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <Card className="aurea-panel rounded-[28px]">
      <CardContent className="p-6">
        <div className="text-lg font-semibold text-[#FCF8F6]">{title}</div>
        <div className="mt-5 grid gap-4">
          {points.length === 0 ? (
            <div className="text-sm text-[#D8CFF0]">No data available.</div>
          ) : (
            points.map((point) => (
              <div key={point.label} className="grid gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[#F8F5FF]">{point.label}</span>
                  <span className="text-[#D8CFF0]">{point.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#F5D547,#9A6DF0)]"
                    style={{ width: `${(point.value / max) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "all";
  const sort = searchParams.get("sort") || "newest";
  const search = searchParams.get("search") || "";
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);
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
    void loadReports();
  }, [router, range]);

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

  async function loadReports() {
    setLoading(true);
    try {
      const [analyticsRes, reportsRes] = await Promise.all([
        api.get("/admin/reports/analytics", { params: { range } }),
        api.get("/admin/reports", { params: { range, sort: "newest" } }),
      ]);
      setAnalytics(analyticsRes.data);
      setRecentReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not load reports"));
    } finally {
      setLoading(false);
    }
  }

  function updateRange(nextRange: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", nextRange);
    router.push(`/admin/reports?${params.toString()}`);
  }

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`/admin/reports?${params.toString()}`);
  }

  async function downloadCsv(path: string, filename: string) {
    try {
      const response = await api.get(path, { params: { range }, responseType: "blob" });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not download CSV"));
    }
  }

  const summaryCards = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: "Total alerts", value: analytics.summary.total_alerts },
      { label: "Pending review alerts", value: analytics.summary.pending_review_alerts },
      { label: "High risk alerts", value: analytics.summary.high_risk_alerts },
      { label: "Reviewed alerts", value: analytics.summary.reviewed_alerts },
      { label: "Dismissed alerts", value: analytics.summary.dismissed_alerts },
      { label: "Total user reports", value: analytics.summary.total_user_reports },
      { label: "Suspended users", value: analytics.summary.suspended_users },
      { label: "Restricted groups", value: analytics.summary.restricted_groups },
      { label: "Active group restrictions", value: analytics.summary.active_group_restrictions },
      { label: "Suspended groups", value: analytics.summary.suspended_groups },
    ];
  }, [analytics]);

  const filteredRecentReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const next = [...recentReports].sort((a, b) =>
      sort === "oldest"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (!needle) return next;
    return next.filter((report) =>
      [report.reporter_username, report.reported_username, report.group_name, report.reason, report.details, report.message_preview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [recentReports, search, sort]);

  return (
    <AppShell>
      <AdminSurface variant="reports">
      <div className="aurea-page mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-6">
          <Link href="/admin" className="aurea-link text-sm font-medium">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#FCF8F6]">Reports &amp; Analytics</h1>
              <p className="mt-2 text-sm text-[#D8CFF0]">
                Track alert trends, user reports, and moderation activity.
              </p>
            </div>
          </div>

          <Card className="aurea-panel rounded-[28px]">
            <CardContent className="grid gap-4 p-6 lg:grid-cols-[180px_180px_1fr_auto]">
              <label className="grid gap-2 text-sm text-[#D8CFF0]">
                <span>Date range</span>
                <select value={range} onChange={(event) => updateRange(event.target.value)} className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]">
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
                <span>Search</span>
                <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search report activity..." className="rounded-2xl border-white/12 bg-[#140f25] text-[#F8F5FF] placeholder:text-[#AFA2C9]" />
              </label>
              <div className="flex items-end">
                <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => updateQuery({ range: "all", sort: "newest", search: "" })}>
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {(loading
              ? Array.from({ length: 5 }).map((_, index) => ({ label: `skeleton-${index}`, value: " " }))
              : summaryCards).map((card) => (
              <Card key={card.label} className="aurea-panel rounded-[24px]">
                <CardContent className="p-5">
                  {loading ? (
                    <>
                      <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                      <div className="mt-3 h-9 w-20 animate-pulse rounded-2xl bg-white/12" />
                    </>
                  ) : (
                    <>
                      <div className="text-sm text-[#D8CFF0]">{card.label}</div>
                      <div className="mt-3 text-3xl font-semibold text-[#FCF8F6]">{card.value}</div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <Card key={`reports-chart-skeleton-${index}`} className="aurea-panel rounded-[28px]">
                  <CardContent className="p-6">
                    <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-5 grid gap-4">
                      {Array.from({ length: 4 }).map((__, row) => (
                        <div key={`reports-chart-row-${index}-${row}`} className="grid gap-2">
                          <div className="h-4 w-full animate-pulse rounded-full bg-white/8" />
                          <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <BarChartCard title="Alerts by severity" points={analytics?.alerts_by_severity || []} />
                <BarChartCard title="Alerts by status" points={analytics?.alerts_by_status || []} />
                <BarChartCard title="Reports by reason" points={analytics?.reports_by_reason || []} />
                <BarChartCard title="Safety activity over time" points={analytics?.safety_activity_over_time || []} />
                <BarChartCard title="Top flagged groups" points={analytics?.top_flagged_groups || []} />
                <BarChartCard title="Top repeated risk categories" points={analytics?.top_risk_categories || []} />
              </>
            )}
          </div>

          <Card className="aurea-panel rounded-[28px]">
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold text-[#FCF8F6]">CSV downloads</div>
                <div className="mt-2 text-sm text-[#D8CFF0]">
                  Export real alert, report, and moderation summary data.
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]" onClick={() => void downloadCsv("/admin/reports/alerts.csv", "aurea-alerts.csv")}>
                  Download Alerts CSV
                </Button>
                <Button className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]" onClick={() => void downloadCsv("/admin/reports/user-reports.csv", "aurea-user-reports.csv")}>
                  Download User Reports CSV
                </Button>
                <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => void downloadCsv("/admin/reports/summary.csv", "aurea-moderation-summary.csv")}>
                  Download Moderation Summary CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="aurea-panel rounded-[28px]">
            <CardContent className="p-6">
              <div className="text-lg font-semibold text-[#FCF8F6]">Recent report activity</div>
              <div className="mt-5 grid gap-3">
                {filteredRecentReports.length === 0 ? (
                  <div className="text-sm text-[#D8CFF0]">No report activity in this range.</div>
                ) : (
                  filteredRecentReports.slice(0, 10).map((report) => (
                    <div key={report.id} className="aurea-panel-soft rounded-[22px] p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="font-medium text-[#FCF8F6]">
                          <Link href={`/profile/${report.reporter_username}`} className="hover:text-[#F5D547]">
                            @{report.reporter_username}
                          </Link>{" "}
                          reported{" "}
                          <Link href={`/profile/${report.reported_username}`} className="hover:text-[#F5D547]">
                            @{report.reported_username}
                          </Link>
                        </div>
                        <span className="text-sm text-[#D8CFF0]">{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-2 text-sm text-[#D8CFF0]">
                        {report.group_name ? `${report.group_name} · ` : ""}
                        {report.reason}
                      </div>
                      <div className="mt-2 text-sm text-[#F8F5FF]">
                        {report.message_preview || report.details || "No extra details provided."}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </AdminSurface>
    </AppShell>
  );
}
