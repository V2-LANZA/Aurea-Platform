"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Group = {
  id: number;
  name: string;
  invite_code: string;
};

type AlertItem = {
  id: number;
  group_id: number;
  level: string;
  detail: string;
  created_at: string;
  sender_username: string;
  trigger_text: string;
  matched_reasons?: string | null;
  severity: string;
  status: string;
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
  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }
  return typedError?.message || fallback;
}

function buildTip(detail: string) {
  const text = detail.toLowerCase();

  if (text.includes("photos") || text.includes("nudes") || text.includes("sexual")) {
    return "Do not share personal images online.";
  }
  if (text.includes("location") || text.includes("school")) {
    return "Avoid sharing location or school details.";
  }
  if (text.includes("secrecy")) {
    return "Secrecy from trusted adults can be a warning sign.";
  }
  if (text.includes("meeting")) {
    return "Avoid private meetups with people online.";
  }

  return "Review the conversation carefully.";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AlertsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed()) router.push("/login");
  }, [router]);

  async function loadGroups() {
    try {
      const res = await api.get("/groups");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load groups"));
    }
  }

  async function loadAlerts(groupId?: number) {
    setLoading(true);
    try {
      const path =
        typeof groupId === "number"
          ? `/alerts?group_id=${groupId}`
          : "/alerts";

      const res = await api.get(path);
      setAlerts(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load alerts"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGroups();
      void loadAlerts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (selectedGroupId === "all") void loadAlerts();
      else void loadAlerts(Number(selectedGroupId));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedGroupId]);

  const groupNameMap = useMemo(
    () => Object.fromEntries(groups.map((group) => [group.id, group.name])),
    [groups]
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#B9929F]">
                Monitoring feed
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#FCF8F6]">
                Alerts
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[#d2bfd0]">
                Review the alerts generated across your groups, understand what
                triggered them, and see the message that needs attention.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              >
                <option value="all">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={String(group.id)}>
                    {group.name}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  if (selectedGroupId === "all") void loadAlerts();
                  else void loadAlerts(Number(selectedGroupId));
                }}
              >
                Refresh
              </Button>
            </div>
          </div>

          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-[#FCF8F6]">Alert stream</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5">
              {loading ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-[#d2bfd0]">
                  Loading alerts...
                </div>
              ) : alerts.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-[#d2bfd0]">
                  No alerts found for the selected group.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-[30px] border border-white/10 bg-white/5 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-2xl font-semibold text-[#FCF8F6]">
                          Alert #{alert.id}
                        </div>
                        <div className="mt-2 text-sm text-[#B9929F]">
                          {groupNameMap[alert.group_id] || `Group ${alert.group_id}`} · sender @
                          {alert.sender_username}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-full bg-[#F5D547]/12 px-3 py-1 text-sm font-medium text-[#F5D547]">
                          {alert.severity}
                        </div>
                        <div className="rounded-full bg-[#453750] px-3 py-1 text-sm font-medium text-white">
                          {alert.status}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
                      <div className="rounded-[24px] border border-white/10 bg-[#120E16] p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                          Trigger message
                        </div>
                        <div className="mt-3 text-sm leading-7 text-[#e9dfe6]">
                          {alert.trigger_text || alert.detail}
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="rounded-[24px] border border-white/10 bg-[#120E16] p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                            Why flagged
                          </div>
                          <div className="mt-3 text-sm leading-7 text-[#e9dfe6]">
                            {alert.matched_reasons || alert.detail}
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-white/10 bg-[#120E16] p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                            Tip
                          </div>
                          <div className="mt-3 text-sm leading-7 text-[#e9dfe6]">
                            {buildTip(alert.detail)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-[#8f7d8f]">
                      {formatDate(alert.created_at)}
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
