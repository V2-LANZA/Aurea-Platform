"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { isAuthed } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarBadge } from "@/components/avatar-badge";
import { toast } from "sonner";

type GroupMember = {
  id: number;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
};

type Group = {
  id: number;
  name: string;
  invite_code: string;
  member_count?: number | null;
  member_preview?: GroupMember[];
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
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load groups"));
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function createGroup() {
    if (!createName.trim()) return;
    setLoading(true);

    try {
      const res = await api.post("/groups", { name: createName.trim() });
      const group = res.data;

      toast.success("Group created");
      setCreateName("");
      await loadGroups();

      if (group?.id) {
        router.push(`/chat?group=${group.id}`);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not create group"));
    } finally {
      setLoading(false);
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    setLoading(true);

    try {
      const res = await api.post("/groups/join", {
        invite_code: joinCode.trim(),
      });
      const group = res.data;

      toast.success("Joined group");
      setJoinCode("");
      await loadGroups();

      if (group?.id) {
        router.push(`/chat?group=${group.id}`);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not join group"));
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
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
            <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-3xl text-[#FCF8F6]">
                  Protected groups
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5 text-[#d2bfd0]">
                <p className="text-base leading-8">
                  Create invite-only spaces for young people, moderators, and
                  support communities. Every conversation stays connected to real
                  people, visible members, and live safety monitoring.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                    <div className="text-sm uppercase tracking-[0.22em] text-[#B9929F]">
                      Create
                    </div>
                    <div className="mt-2 text-sm leading-7">
                      Launch a new monitored space in seconds.
                    </div>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                    <div className="text-sm uppercase tracking-[0.22em] text-[#B9929F]">
                      Join
                    </div>
                    <div className="mt-2 text-sm leading-7">
                      Use an invite code to enter an existing community.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <CardContent className="grid gap-4 p-6">
                  <div className="text-2xl font-medium text-[#FCF8F6]">Create group</div>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Group name"
                    className="rounded-2xl border-white/10 bg-white/5 text-white"
                  />
                  <Button
                    onClick={createGroup}
                    disabled={loading}
                    className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                  >
                    Create
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <CardContent className="grid gap-4 p-6">
                  <div className="text-2xl font-medium text-[#FCF8F6]">Join group</div>
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Invite code"
                    className="rounded-2xl border-white/10 bg-white/5 text-white"
                  />
                  <Button
                    onClick={joinGroup}
                    disabled={loading}
                    className="rounded-2xl bg-[#453750] text-white hover:bg-[#5a4665]"
                  >
                    Join
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-[#FCF8F6]">Your groups</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5">
              {groups.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-[#d2bfd0]">
                  No groups yet. Create one or join with an invite code.
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="grid gap-5 rounded-[30px] border border-white/10 bg-white/5 p-6 lg:grid-cols-[1fr_auto]"
                  >
                    <div className="grid gap-4">
                      <div>
                        <div className="text-2xl font-semibold text-[#FCF8F6]">
                          {group.name}
                        </div>
                        <div className="mt-2 text-sm text-[#B9929F]">
                          Invite code:{" "}
                          <span className="font-mono text-[#F5D547]">{group.invite_code}</span>
                          {group.member_count ? ` · ${group.member_count} members` : ""}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B9929F]">
                          Member preview
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {(group.member_preview || []).map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 rounded-full border border-white/10 bg-[#120E16] px-3 py-2"
                            >
                              <AvatarBadge
                                name={member.full_name || member.username}
                                avatarUrl={member.avatar_url || null}
                                size="sm"
                              />
                              <div>
                                <div className="text-sm font-medium text-[#FCF8F6]">
                                  {member.full_name || member.username}
                                </div>
                                <div className="text-xs text-[#B9929F]">
                                  @{member.username}
                                  {member.pronouns ? ` · ${member.pronouns}` : ""}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      <Button
                        variant="outline"
                        className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => copy(group.invite_code)}
                      >
                        Copy invite code
                      </Button>

                      <Button
                        asChild
                        className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                      >
                        <Link href={`/chat?group=${group.id}`}>Open chat</Link>
                      </Button>
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
