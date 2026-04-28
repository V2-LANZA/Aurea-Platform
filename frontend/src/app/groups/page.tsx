"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isAuthed } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionModal } from "@/components/ui/action-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AvatarBadge } from "@/components/avatar-badge";
import { getFriendState } from "@/lib/friends";
import { toast } from "sonner";

type Person = {
  id: number;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
  is_friend?: boolean;
  friend_state?: string | null;
  friend_request_id?: number | null;
  is_suspended?: boolean;
};

type FriendRequest = {
  id: number;
  status: string;
  requester: Person;
  receiver: Person;
  created_at: string;
};

type FriendSummary = {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  friends: Person[];
};

type Group = {
  id: number;
  name: string;
  invite_code: string;
  created_by_id?: number;
  is_suspended?: boolean;
  suspension_reason?: string | null;
  member_count?: number | null;
  member_preview?: Person[];
};

type Me = {
  id: number;
  role?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as { response?: { data?: { detail?: string } }; message?: string };
  return typedError?.response?.data?.detail || typedError?.message || fallback;
}

export default function GroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [friendSummary, setFriendSummary] = useState<FriendSummary>({
    incoming: [],
    outgoing: [],
    friends: [],
  });
  const [directory, setDirectory] = useState<Person[]>([]);
  const [busyFriendUserId, setBusyFriendUserId] = useState<number | null>(null);
  const [leaveGroupId, setLeaveGroupId] = useState<number | null>(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  useEffect(() => {
    if (!isAuthed()) router.push("/login");
  }, [router]);

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadDirectory(friendQuery);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [friendQuery]);

  async function loadPage() {
    try {
      const [groupsRes, friendsRes, meRes] = await Promise.all([
        api.get("/groups"),
        api.get("/users/friends/summary"),
        api.get("/users/me"),
      ]);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      setFriendSummary(
        friendsRes.data || { incoming: [], outgoing: [], friends: [] }
      );
      setMe(meRes.data || null);
      await loadDirectory(friendQuery);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not load groups"));
    }
  }

  async function loadDirectory(query = "") {
    try {
      const response = await api.get("/users/directory", { params: { query } });
      setDirectory(Array.isArray(response.data) ? response.data : []);
    } catch {
      setDirectory([]);
    }
  }

  async function createGroup() {
    if (!createName.trim()) return;
    setLoading(true);
    try {
      const response = await api.post("/groups", { name: createName.trim() });
      const group = response.data;
      toast.success("Group created.");
      setCreateName("");
      await loadPage();
      if (group?.id) router.push(`/chat?group=${group.id}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not create group"));
    } finally {
      setLoading(false);
    }
  }

  async function joinGroup() {
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      const response = await api.post("/groups/join", { invite_code: joinCode.trim() });
      const group = response.data;
      toast.success("Joined group.");
      setJoinCode("");
      await loadPage();
      if (group?.id) router.push(`/chat?group=${group.id}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not join group"));
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied.");
    } catch {
      toast.error("Could not copy invite code.");
    }
  }

  async function sendFriendRequest(userId: number) {
    setBusyFriendUserId(userId);
    setDirectory((prev) =>
      prev.map((person) =>
        person.id === userId ? { ...person, friend_state: "outgoing_pending" } : person
      )
    );
    try {
      await api.post("/users/friend-requests", { user_id: userId });
      toast.success("Friend request sent.");
    } catch (error: unknown) {
      await loadPage();
      toast.error(getErrorMessage(error, "Could not send friend request"));
    } finally {
      setBusyFriendUserId(null);
    }
  }

  async function respondToRequest(requestId: number, action: "accepted" | "declined") {
    try {
      await api.patch(`/users/friend-requests/${requestId}`, { action });
      toast.success(action === "accepted" ? "Friend request accepted." : "Friend request declined.");
      await loadPage();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update friend request"));
    }
  }

  async function removeFriend(userId: number) {
    try {
      await api.delete(`/users/friends/${userId}`);
      toast.success("Friend removed.");
      await loadPage();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not remove friend"));
    }
  }

  async function leaveGroup(groupId: number) {
    setLeavingGroup(true);
    try {
      await api.delete(`/groups/${groupId}/leave`);
      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      setLeaveGroupId(null);
      toast.success("You left the group.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not leave group"));
    } finally {
      setLeavingGroup(false);
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

  return (
    <AppShell>
      <div className="aurea-page mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8">
          <div>
            <button type="button" onClick={() => router.back()} className="aurea-link text-sm font-medium">
              ← Back
            </button>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#B8A9D6]">Groups</div>
            <h1 className="aurea-heading mt-3 text-4xl font-semibold tracking-tight">Your groups</h1>
            <p className="aurea-copy mt-2 max-w-3xl text-sm leading-7">
              Create a new group, join with an invite code, keep up with friends, and jump straight back into chat.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="aurea-panel rounded-[32px]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#FCF8F6]">Create Group</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Group name"
                  className="rounded-2xl border-white/12 bg-[#140f25] text-[#FCF8F6] placeholder:text-[#B8A9D6]"
                />
                <Button className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]" disabled={loading} onClick={createGroup}>
                  Create Group
                </Button>
              </CardContent>
            </Card>

            <Card className="aurea-panel rounded-[32px]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#FCF8F6]">Join Group with Invite Code</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="Invite code"
                  className="rounded-2xl border-white/12 bg-[#140f25] text-[#FCF8F6] placeholder:text-[#B8A9D6]"
                />
                <Button className="rounded-2xl bg-[#6a46a4] text-white hover:bg-[#59398a]" disabled={loading} onClick={joinGroup}>
                  Join Group
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="aurea-panel rounded-[32px]">
            <CardHeader>
              <CardTitle className="text-2xl text-[#FCF8F6]">Your Groups</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              {groups.length === 0 ? (
                <div className="aurea-panel-soft rounded-[24px] border border-dashed p-6 text-[#D8CFF0]">
                  No groups yet. Create one or join with an invite code.
                </div>
              ) : (
                groups.map((group) => (
                  (() => {
                    const canDeleteGroup = Boolean(
                      me && (me.role === "admin" || group.created_by_id === me.id)
                    );
                    return (
                  <div key={group.id} className="aurea-panel-soft grid gap-5 rounded-[24px] p-6 lg:grid-cols-[1fr_auto]">
                    <div className="grid gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-2xl font-semibold text-[#FCF8F6]">{group.name}</div>
                          {group.is_suspended ? (
                            <span className="rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100">
                              Suspended
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm text-[#D8CFF0]">
                          Invite code: <span className="font-mono text-[#F5D547]">{group.invite_code}</span>
                          {group.member_count ? ` · ${group.member_count} members` : ""}
                        </div>
                        {group.is_suspended && group.suspension_reason ? (
                          <div className="mt-2 text-sm text-[#F3D4D7]">{group.suspension_reason}</div>
                        ) : null}
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#B8A9D6]">
                          Members
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {(group.member_preview || []).map((member) => (
                            <Link
                              key={member.id}
                              href={`/profile/${member.username}`}
                              className="flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-3 py-2"
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
                                <div className="text-xs text-[#B8A9D6]">
                                  @{member.username}
                                  {member.pronouns ? ` · ${member.pronouns}` : ""}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      <Button
                        variant="outline"
                        className="aurea-button-ghost rounded-2xl"
                        onClick={() => void copyInviteCode(group.invite_code)}
                      >
                        Copy Invite Code
                      </Button>
                      <Button asChild className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]">
                        <Link href={`/chat?group=${group.id}`}>Open Chat</Link>
                      </Button>
                      {canDeleteGroup ? (
                        <Button
                          variant="outline"
                          className="rounded-2xl border-red-500/40 bg-red-600/16 text-red-50 hover:bg-red-600/24"
                          onClick={() => setDeleteGroupId(group.id)}
                        >
                          Delete Group
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="rounded-2xl border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/18"
                          onClick={() => setLeaveGroupId(group.id)}
                        >
                          Leave Group
                        </Button>
                      )}
                    </div>
                  </div>
                    );
                  })()
                ))
              )}
            </CardContent>
          </Card>

          <Card className="aurea-panel rounded-[32px]">
            <CardHeader>
              <CardTitle className="text-2xl text-[#FCF8F6]">Friends</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                <div className="grid gap-3">
                  <div className="text-sm font-medium text-[#D8CFF0]">Search users by username</div>
                  <div className="flex gap-3">
                    <Input
                      value={friendQuery}
                      onChange={(event) => setFriendQuery(event.target.value)}
                      placeholder="Search users"
                      className="rounded-2xl border-white/12 bg-[#140f25] text-[#FCF8F6] placeholder:text-[#B8A9D6]"
                    />
                  </div>
                  <div className="grid gap-3">
                    {directory.length === 0 ? (
                      <div className="aurea-panel-soft rounded-[22px] p-4 text-sm text-[#D8CFF0]">
                        No users matched your search.
                      </div>
                    ) : (
                      directory.map((person) => (
                        <div key={person.id} className="aurea-panel-soft flex items-center justify-between gap-3 rounded-[22px] p-4">
                          <Link href={`/profile/${person.username}`} className="flex items-center gap-3">
                            <AvatarBadge
                              name={person.full_name || person.username}
                              avatarUrl={person.avatar_url || null}
                              size="sm"
                            />
                            <div>
                              <div className="font-medium text-[#FCF8F6]">{person.full_name || person.username}</div>
                              <div className="text-sm text-[#D8CFF0]">@{person.username}</div>
                            </div>
                          </Link>
                          {getFriendState(person) === "friends" ? (
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                              Friends
                            </span>
                          ) : getFriendState(person) === "outgoing_pending" ? (
                            <span className="rounded-full border border-[#F5D547]/18 bg-[#F5D547]/10 px-3 py-1 text-xs font-semibold text-[#F5D547]">
                              Pending
                            </span>
                          ) : getFriendState(person) === "incoming_pending" && person.friend_request_id ? (
                            <div className="flex gap-2">
                              <Button
                                className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]"
                                onClick={() => void respondToRequest(person.friend_request_id!, "accepted")}
                              >
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                className="aurea-button-ghost rounded-2xl"
                                onClick={() => void respondToRequest(person.friend_request_id!, "declined")}
                              >
                                Decline
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              disabled={busyFriendUserId === person.id}
                              className="rounded-2xl border-white/12 bg-white/8 text-[#FCF8F6] hover:bg-white/12"
                              onClick={() => void sendFriendRequest(person.id)}
                            >
                              {busyFriendUserId === person.id ? "Sending..." : "Add Friend"}
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="aurea-panel-soft rounded-[24px] p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B8A9D6]">Incoming requests</div>
                    <div className="mt-4 grid gap-3">
                      {friendSummary.incoming.length === 0 ? (
                        <div className="text-sm text-[#D8CFF0]">No incoming requests right now.</div>
                      ) : (
                        friendSummary.incoming.map((request) => (
                          <div key={request.id} className="rounded-[20px] border border-white/10 bg-white/6 p-4">
                            <Link href={`/profile/${request.requester.username}`} className="block">
                              <div className="font-medium text-[#FCF8F6]">
                                {request.requester.full_name || request.requester.username}
                              </div>
                              <div className="text-sm text-[#D8CFF0]">@{request.requester.username}</div>
                            </Link>
                            <div className="mt-3 flex gap-2">
                              <Button className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]" onClick={() => void respondToRequest(request.id, "accepted")}>
                                Accept
                              </Button>
                              <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => void respondToRequest(request.id, "declined")}>
                                Decline
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="aurea-panel-soft rounded-[24px] p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B8A9D6]">Outgoing requests</div>
                    <div className="mt-4 grid gap-3">
                      {friendSummary.outgoing.length === 0 ? (
                        <div className="text-sm text-[#D8CFF0]">No outgoing requests right now.</div>
                      ) : (
                        friendSummary.outgoing.map((request) => (
                          <div key={request.id} className="rounded-[20px] border border-white/10 bg-white/6 p-4">
                            <Link href={`/profile/${request.receiver.username}`} className="block">
                              <div className="font-medium text-[#FCF8F6]">
                                {request.receiver.full_name || request.receiver.username}
                              </div>
                              <div className="text-sm text-[#D8CFF0]">
                                @{request.receiver.username} · {request.status}
                              </div>
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="aurea-panel-soft rounded-[24px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B8A9D6]">Friends list</div>
                  <div className="text-sm text-[#D8CFF0]">{friendSummary.friends.length} friends</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {friendSummary.friends.length === 0 ? (
                    <div className="text-sm text-[#D8CFF0]">No friends yet. Search for users to add.</div>
                  ) : (
                    friendSummary.friends.map((friend) => (
                      <div key={friend.id} className="rounded-[20px] border border-white/10 bg-white/6 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Link href={`/profile/${friend.username}`} className="flex items-center gap-3">
                            <AvatarBadge
                              name={friend.full_name || friend.username}
                              avatarUrl={friend.avatar_url || null}
                              size="sm"
                            />
                            <div>
                              <div className="font-medium text-[#FCF8F6]">{friend.full_name || friend.username}</div>
                              <div className="text-sm text-[#D8CFF0]">@{friend.username}</div>
                            </div>
                          </Link>
                          <Button variant="outline" className="rounded-2xl border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20" onClick={() => void removeFriend(friend.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ActionModal
        open={leaveGroupId !== null}
        title="Leave this group?"
        description="You will stop seeing new messages from this group and it will disappear from your groups list."
        onClose={() => setLeaveGroupId(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => setLeaveGroupId(null)}>
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-red-600 text-white hover:bg-red-500"
            disabled={leavingGroup}
            onClick={() => {
              if (leaveGroupId) void leaveGroup(leaveGroupId);
            }}
          >
            {leavingGroup ? "Leaving..." : "Leave Group"}
          </Button>
        </div>
      </ActionModal>

      <ActionModal
        open={deleteGroupId !== null}
        title="Delete this group?"
        description="This cannot be undone. The group and its conversation history will be removed."
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
