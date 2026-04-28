"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSurface } from "@/components/admin/admin-surface";
import { ActionModal } from "@/components/ui/action-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { toast } from "sonner";

type GroupMember = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  is_suspended: boolean;
  is_restricted_in_group?: boolean;
  joined_at: string;
};

type AdminGroup = {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
  created_by_username: string;
  is_suspended?: boolean;
  suspended_at?: string | null;
  suspension_reason?: string | null;
  member_count: number;
  members: GroupMember[];
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as { response?: { data?: { detail?: string } }; message?: string };
  return typedError?.response?.data?.detail || typedError?.message || fallback;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AdminGroupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") || "newest";
  const range = searchParams.get("range") || "all";
  const search = searchParams.get("search") || "";

  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyGroupId, setBusyGroupId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState(search);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (!isAdmin()) {
      router.push("/");
      return;
    }
    void loadGroups();
  }, [router, sort, range]);

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

  async function loadGroups() {
    setLoading(true);
    try {
      const response = await api.get("/admin/groups", { params: { sort, range } });
      setGroups(Array.isArray(response.data) ? response.data : []);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not load groups"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleGroupSuspension(group: AdminGroup) {
    setBusyGroupId(group.id);
    setGroups((prev) =>
      prev.map((item) =>
        item.id === group.id
          ? {
              ...item,
              is_suspended: !group.is_suspended,
              suspension_reason: group.is_suspended ? null : group.suspension_reason || "Suspended by admin",
            }
          : item
      )
    );
    try {
      if (group.is_suspended) {
        await api.patch(`/admin/groups/${group.id}/unsuspend`);
        toast.success("Group unsuspended.");
      } else {
        await api.patch(`/admin/groups/${group.id}/suspend`, {
          reason: "Suspended by admin",
        });
        toast.success("Group suspended.");
      }
    } catch (error: unknown) {
      await loadGroups();
      toast.error(getErrorMessage(error, "Could not update group"));
    } finally {
      setBusyGroupId(null);
    }
  }

  async function deleteGroup(groupId: number) {
    setDeletingGroup(true);
    try {
      await api.delete(`/groups/${groupId}`);
      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      setDeleteGroupId(null);
      toast.success("Group deleted.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not delete group"));
    } finally {
      setDeletingGroup(false);
    }
  }

  function updateQuery(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => params.set(key, value));
    router.push(`/admin/groups?${params.toString()}`);
  }

  const filteredGroups = groups.filter((group) =>
    [group.name, group.created_by_username, group.invite_code, group.suspension_reason]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <AppShell>
      <AdminSurface variant="groups">
      <div className="aurea-page mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-6">
          <Link href="/admin" className="aurea-link text-sm font-medium">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid gap-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#FCF8F6]">Admin Groups</h1>
              <p className="mt-2 text-sm text-[#D8CFF0]">
                Review group creation dates, member counts, and who is restricted or suspended inside each group.
              </p>
            </div>

            <Button
              variant="outline"
              className="aurea-button-ghost rounded-2xl"
              onClick={() => void loadGroups()}
            >
              Refresh
            </Button>
          </div>

          <Card className="aurea-panel rounded-[32px]">
            <CardContent className="grid gap-4 p-6 lg:grid-cols-[180px_180px_1fr_auto]">
              <label className="grid gap-2 text-sm text-[#D8CFF0]">
                <span>Date range</span>
                <select value={range} onChange={(event) => updateQuery({ range: event.target.value })} className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]">
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
                <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search group or creator..." className="rounded-2xl border-white/12 bg-[#140f25] text-[#F8F5FF] placeholder:text-[#AFA2C9]" />
              </label>
              <div className="flex items-end">
                <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => updateQuery({ sort: "newest", range: "all", search: "" })}>
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="aurea-panel rounded-[32px]">
            <CardContent className="grid gap-5 p-6">
              {loading ? (
                <div className="grid gap-5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`groups-skeleton-${index}`} className="aurea-panel-soft rounded-[24px] p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="grid gap-3">
                          <div className="h-7 w-44 animate-pulse rounded-full bg-white/10" />
                          <div className="h-4 w-56 animate-pulse rounded-full bg-white/8" />
                          <div className="h-4 w-48 animate-pulse rounded-full bg-white/8" />
                        </div>
                        <div className="flex gap-3">
                          <div className="h-16 w-24 animate-pulse rounded-[20px] bg-white/10" />
                          <div className="h-10 w-28 animate-pulse rounded-2xl bg-white/10" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="aurea-panel-soft rounded-[24px] border border-dashed p-6 text-[#D8CFF0]">
                  No groups have been created yet.
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.id} className="aurea-panel-soft rounded-[24px] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-xl font-semibold text-[#FCF8F6]">{group.name}</div>
                          {group.is_suspended ? (
                            <span className="rounded-full border border-red-400/30 bg-red-500/12 px-3 py-1 text-xs font-semibold text-red-100">
                              Suspended
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 grid gap-1 text-sm text-[#D8CFF0]">
                          <div>Invite code: <span className="font-mono font-medium text-[#FCF8F6]">{group.invite_code}</span></div>
                          <div>Created by: <span className="font-medium text-[#FCF8F6]">{group.created_by_username}</span></div>
                          <div>Created: <span className="font-medium text-[#FCF8F6]">{formatDate(group.created_at)}</span></div>
                          {group.suspension_reason ? <div>Reason: <span className="font-medium text-[#FCF8F6]">{group.suspension_reason}</span></div> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="aurea-panel-soft rounded-[20px] px-4 py-3 text-center">
                          <div className="text-sm text-[#D8CFF0]">Members</div>
                          <div className="text-3xl font-semibold text-[#FCF8F6]">{group.member_count}</div>
                        </div>
                        <Button
                          variant="outline"
                          disabled={busyGroupId === group.id}
                          className={
                            group.is_suspended
                              ? "rounded-2xl border-emerald-400/30 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18"
                              : "rounded-2xl border-red-400/30 bg-red-500/12 text-red-100 hover:bg-red-500/18"
                          }
                          onClick={() => void toggleGroupSuspension(group)}
                        >
                          {busyGroupId === group.id
                            ? "Updating..."
                            : group.is_suspended
                              ? "Unsuspend"
                              : "Suspend"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={deletingGroup}
                          className="rounded-2xl border-red-500/40 bg-red-600/16 text-red-50 hover:bg-red-600/24"
                          onClick={() => setDeleteGroupId(group.id)}
                        >
                          {deletingGroup && deleteGroupId === group.id ? "Deleting..." : "Delete Group"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <div className="text-sm font-semibold uppercase tracking-wide text-[#B8A9D6]">Member list</div>
                      {group.members.length === 0 ? (
                        <div className="text-sm text-[#D8CFF0]">No members found in this group.</div>
                      ) : (
                        group.members.map((member) => (
                          <div key={member.id} className="aurea-panel-soft flex flex-col gap-3 rounded-[20px] p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <Link href={`/profile/${member.username}`} className="font-medium text-[#FCF8F6] hover:text-[#F5D547]">
                                {member.full_name || member.username}
                              </Link>
                              <div className="text-sm text-[#D8CFF0]">
                                @{member.username} · {member.email}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="text-[#D8CFF0]">Joined {formatDate(member.joined_at)}</span>
                              <span className={`rounded-full px-3 py-1 font-medium ${member.is_suspended ? "border border-red-400/30 bg-red-500/12 text-red-100" : "border border-emerald-400/30 bg-emerald-500/12 text-emerald-100"}`}>
                                {member.is_suspended ? "Suspended" : "Active"}
                              </span>
                              {member.is_restricted_in_group ? (
                                <span className="rounded-full border border-[#7c5bb8]/30 bg-[#7c5bb8]/18 px-3 py-1 font-medium text-[#efe6ff]">
                                  Restricted in group
                                </span>
                              ) : null}
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
      </AdminSurface>

      <ActionModal
        open={deleteGroupId !== null}
        title="Delete this group?"
        description="This cannot be undone. The group, its members, and its messages will be removed."
        onClose={() => setDeleteGroupId(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => setDeleteGroupId(null)}>
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-red-600 text-white hover:bg-red-500"
            disabled={deletingGroup || deleteGroupId === null}
            onClick={() => {
              if (deleteGroupId !== null) {
                void deleteGroup(deleteGroupId);
              }
            }}
          >
            {deletingGroup ? "Deleting..." : "Delete Group"}
          </Button>
        </div>
      </ActionModal>
    </AppShell>
  );
}
