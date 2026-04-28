"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSurface } from "@/components/admin/admin-surface";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { toast } from "sonner";

type Dashboard = {
  total_users: number;
  total_groups: number;
  total_messages: number;
  total_alerts: number;
  pending_alerts: number;
  high_risk_alerts: number;
  reviewed_alerts: number;
  pending_reports: number;
  suspended_users: number;
  average_response_time_seconds?: number | null;
};

function formatDuration(seconds?: number | null) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) return "Not available";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as { response?: { data?: { detail?: string } }; message?: string };
  return typedError?.response?.data?.detail || typedError?.message || fallback;
}

export default function AdminPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
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
    void loadDashboard();
  }, [router]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await api.get("/admin/dashboard");
      setDashboard(response.data);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not load admin dashboard"));
    } finally {
      setLoading(false);
    }
  }

  const stats = [
    { label: "Pending Review", value: dashboard?.pending_alerts ?? 0, href: "/admin/moderation?tab=pending_review" },
    { label: "High Risk", value: dashboard?.high_risk_alerts ?? 0, href: "/admin/moderation?tab=high_risk" },
    { label: "Reviewed", value: dashboard?.reviewed_alerts ?? 0, href: "/admin/moderation?tab=reviewed" },
    { label: "Reported Users", value: dashboard?.pending_reports ?? 0, href: "/admin/moderation?tab=reported_users" },
    { label: "Users", value: dashboard?.total_users ?? 0, href: "/admin/users" },
    { label: "Groups", value: dashboard?.total_groups ?? 0, href: "/admin/groups" },
    { label: "Suspended Users", value: dashboard?.suspended_users ?? 0, href: "/admin/users?status=suspended" },
    { label: "Response Time", value: formatDuration(dashboard?.average_response_time_seconds), href: "/admin/moderation" },
  ];

  return (
    <AppShell>
      <AdminSurface variant="dashboard">
      <div className="aurea-page mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div>
            <Link href="/" className="aurea-link text-sm font-medium">
              ← Back to Home
            </Link>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#FCF8F6]">Admin Dashboard</h1>
              <p className="mt-2 text-sm text-[#D8CFF0]">
                Check the moderation queue, reported users, account actions, and system activity from one place.
              </p>
            </div>

            <Button
              variant="outline"
              className="aurea-button-ghost rounded-2xl"
              onClick={() => void loadDashboard()}
            >
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Card key={`dashboard-skeleton-${index}`} className="aurea-panel h-full rounded-[28px]">
                  <CardContent className="p-6">
                    <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-10 w-20 animate-pulse rounded-2xl bg-white/12" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((card) => (
                <Link key={card.label} href={card.href}>
                  <Card className="aurea-panel h-full rounded-[28px] transition hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)),linear-gradient(140deg,rgba(36,17,63,0.95),rgba(18,11,36,0.98))]">
                    <CardContent className="p-6">
                      <div className="text-sm font-medium text-[#D8CFF0]">{card.label}</div>
                      <div className="mt-4 text-4xl font-semibold text-[#FCF8F6]">{card.value}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Link href="/admin/moderation?tab=pending_review">
              <Card className="aurea-panel rounded-[28px] hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)),linear-gradient(140deg,rgba(36,17,63,0.95),rgba(18,11,36,0.98))]">
                <CardContent className="p-6">
                  <div className="text-xl font-semibold text-[#FCF8F6]">Moderation Workflow</div>
                  <p className="mt-3 text-sm leading-7 text-[#D8CFF0]">
                    Review pending alerts, escalate to high risk, and close out reviewed items without duplicate sections.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/users">
              <Card className="aurea-panel rounded-[28px] hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)),linear-gradient(140deg,rgba(36,17,63,0.95),rgba(18,11,36,0.98))]">
                <CardContent className="p-6">
                  <div className="text-xl font-semibold text-[#FCF8F6]">User Management</div>
                  <p className="mt-3 text-sm leading-7 text-[#D8CFF0]">
                    Suspend or unsuspend accounts and review user activity with cleaner sorting and filters.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/groups">
              <Card className="aurea-panel rounded-[28px] hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)),linear-gradient(140deg,rgba(36,17,63,0.95),rgba(18,11,36,0.98))]">
                <CardContent className="p-6">
                  <div className="text-xl font-semibold text-[#FCF8F6]">Groups Overview</div>
                  <p className="mt-3 text-sm leading-7 text-[#D8CFF0]">
                    Inspect active groups, member counts, and group-level restrictions without leaving the admin area.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/reports">
              <Card className="aurea-panel rounded-[28px] hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04)),linear-gradient(140deg,rgba(36,17,63,0.95),rgba(18,11,36,0.98))]">
                <CardContent className="p-6">
                  <div className="text-xl font-semibold text-[#FCF8F6]">Reports &amp; Analytics</div>
                  <p className="mt-3 text-sm leading-7 text-[#D8CFF0]">
                    Track alert trends, user reports, CSV exports, and overall moderation activity.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
      </AdminSurface>
    </AppShell>
  );
}
