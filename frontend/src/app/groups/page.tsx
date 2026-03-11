"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { isAuthed } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Group = {
  id: number;
  name: string;
  invite_code: string;
  bot_enabled?: boolean;
};

export default function GroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState<Group[]>([]);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!isAuthed()) router.push("/login");
  }, [router]);

  async function loadGroups() {
    try {
      const res = await api.get("/groups");
      setGroups(res.data ?? []);
    } catch (e: any) {
      toast.error("Could not load groups");
    }
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createGroup() {
    if (!createName.trim()) return;
    setLoading(true);
    try {
      await api.post("/groups", { name: createName.trim() });
      toast.success("Group created");
      setCreateName("");
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Could not create group");
    } finally {
      setLoading(false);
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      await api.post("/groups/join", { invite_code: joinCode.trim() });
      toast.success("Joined group");
      setJoinCode("");
      await loadGroups();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Could not join group");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied invite code");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 grid gap-6">
        <Card className="rounded-3xl border-black/5 bg-white/70 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-[#0B132B]">Groups</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-black/5 bg-white p-4">
                <div className="font-medium text-[#0B132B]">Create group</div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Group name"
                    className="rounded-2xl"
                  />
                  <Button
                    onClick={createGroup}
                    disabled={loading}
                    className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
                  >
                    Create
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-black/5 bg-white p-4">
                <div className="font-medium text-[#0B132B]">Join group</div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Invite code"
                    className="rounded-2xl"
                  />
                  <Button
                    onClick={joinGroup}
                    disabled={loading}
                    className="rounded-2xl bg-[#5BC0BE] text-[#0B132B] hover:bg-[#6FFFE9]"
                  >
                    Join
                  </Button>
                </div>
                <div className="mt-2 text-xs text-[#3A506B]">
                  “Add members” = send them your invite code.
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="text-sm font-medium text-[#0B132B]">Your groups</div>

              {groups.length === 0 ? (
                <div className="text-sm text-[#3A506B]">
                  No groups yet. Create one or join with a code.
                </div>
              ) : (
                <div className="grid gap-3">
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="flex flex-col gap-2 rounded-3xl border border-black/5 bg-white p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-medium text-[#0B132B]">{g.name}</div>
                        <div className="text-xs text-[#3A506B]">
                          Invite code:{" "}
                          <span className="font-mono text-[#0B132B]">{g.invite_code}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => copy(g.invite_code)}
                        >
                          Copy invite code
                        </Button>

                        <Button asChild className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]">
                          {/* simplest: go to chat page and use group id */}
                          <a href={`/chat?group=${g.id}`}>Open chat</a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}