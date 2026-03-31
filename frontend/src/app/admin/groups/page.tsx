"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { toast } from "sonner";

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
  created_by_id: number;
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminGroupsPage() {
  const router = useRouter();
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
    loadGroups();
  }, [router]);

  async function loadGroups() {
    setLoading(true);
    try {
      const res = await api.get("/admin/groups");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load groups"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#0B132B]">
                Admin Groups
              </h1>
              <p className="mt-1 text-sm text-[#3A506B]">
                Review every group, how many members are inside it, and exactly who belongs to each one.
              </p>
            </div>

            <Button
              variant="outline"
              className="rounded-2xl border-black/10 bg-white/80 px-5 shadow-sm"
              onClick={loadGroups}
            >
              Refresh
            </Button>
          </div>

          <Card className="rounded-[28px] border border-black/5 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-[#0B132B]">
                Groups and members
              </CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5">
              {loading ? (
                <div className="text-[#3A506B]">Loading groups...</div>
              ) : groups.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-black/10 bg-[#F8FAFC] p-6 text-[#3A506B]">
                  No groups have been created yet.
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xl font-semibold text-[#0B132B]">{group.name}</div>
                        <div className="mt-2 grid gap-1 text-sm text-[#3A506B]">
                          <div>
                            Group ID: <span className="font-medium text-[#0B132B]">{group.id}</span>
                          </div>
                          <div>
                            Invite code:{" "}
                            <span className="font-mono font-medium text-[#0B132B]">
                              {group.invite_code}
                            </span>
                          </div>
                          <div>
                            Created by:{" "}
                            <span className="font-medium text-[#0B132B]">
                              {group.created_by_username}
                            </span>
                          </div>
                          <div>
                            Created:{" "}
                            <span className="font-medium text-[#0B132B]">
                              {formatDate(group.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[20px] bg-[#F8FAFC] px-4 py-3 text-center">
                        <div className="text-sm text-[#3A506B]">Members</div>
                        <div className="text-3xl font-semibold text-[#0B132B]">
                          {group.member_count}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <div className="text-sm font-semibold uppercase tracking-wide text-[#3A506B]">
                        Member list
                      </div>

                      {group.members.length === 0 ? (
                        <div className="text-sm text-[#3A506B]">No members found in this group.</div>
                      ) : (
                        group.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex flex-col gap-2 rounded-[20px] bg-[#F8FAFC] p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <div className="font-medium text-[#0B132B]">
                                {member.full_name || member.username}
                              </div>
                              <div className="text-sm text-[#3A506B]">
                                @{member.username} · {member.email}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-[#3A506B]">
                              <div>
                                Joined{" "}
                                <span className="font-medium text-[#0B132B]">
                                  {formatDate(member.joined_at)}
                                </span>
                              </div>
                              <div
                                className={`rounded-full px-3 py-1 font-medium ${
                                  member.is_suspended
                                    ? "bg-red-100 text-red-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {member.is_suspended ? "Suspended" : "Active"}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
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
