"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AlertRow = {
  id: number;
  message_id?: number | null;
  score?: number | null;
  reasons?: string[];
  created_at?: string;
};

export default function AlertsPage() {
  const router = useRouter();
  const [groupId, setGroupId] = useState("2");
  const [items, setItems] = useState<AlertRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed()) router.push("/login");
  }, [router]);

  async function load() {
    setErr(null);
    try {
      const res = await api.get(`/alerts/${groupId}`);
      setItems(res.data ?? []);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? e?.message ?? "Could not load alerts.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell>
      <div className="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Alerts</h1>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>

        <Card className="rounded-3xl border-black/5 bg-white/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Reported / flagged messages</CardTitle>
            <div className="flex items-center gap-2">
              <div className="text-sm opacity-70">Group</div>
              <Input
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-24 rounded-2xl"
              />
              <Button onClick={load} className="rounded-2xl">Load</Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {err && <div className="text-sm text-red-600">{err}</div>}

            {items.length === 0 && !err ? (
              <div className="text-sm opacity-70">No alerts yet.</div>
            ) : (
              items.map((a) => (
                <div key={a.id} className="rounded-2xl border border-black/5 bg-white p-4">
                  <div className="text-sm font-medium">Alert #{a.id}</div>
                  <div className="text-xs opacity-70">{a.created_at ?? ""}</div>
                  <div className="mt-2 text-sm">
                    Score: {a.score ?? "—"} <br />
                    Reasons: {(a.reasons ?? []).join(", ") || "—"}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}