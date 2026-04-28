"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAureaBotNotice } from "@/components/aurea-bot-notice-provider";
import ReportDialog from "@/components/chat/report-dialog";
import { AvatarBadge } from "@/components/avatar-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getUsername, isAuthed } from "@/lib/auth";
import { getFriendState } from "@/lib/friends";
import { toast } from "sonner";

type PublicProfile = {
  id: number;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  role: string;
  is_suspended: boolean;
  is_available: boolean;
  is_friend: boolean;
  friend_state?: string | null;
  friend_request_id?: number | null;
};

type Group = {
  id: number;
  name: string;
  invite_code: string;
};

type UserMute = {
  muted_user_id: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = typedError?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return typedError?.message || fallback;
}

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const searchParams = useSearchParams();
  const username = params?.username;
  const initialGroupId = searchParams.get("group");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    initialGroupId ? Number(initialGroupId) : null
  );
  const [mutedUserIds, setMutedUserIds] = useState<number[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const { showNotice } = useAureaBotNotice();

  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const [profileRes, groupsRes] = await Promise.all([
        api.get(`/users/by-username/${username}`),
        api.get("/groups"),
      ]);
      const nextProfile = profileRes.data as PublicProfile;
      const nextGroups = Array.isArray(groupsRes.data) ? (groupsRes.data as Group[]) : [];
      setProfile(nextProfile);
      setGroups(nextGroups);

      const parsed = initialGroupId ? Number(initialGroupId) : null;
      if (parsed && nextGroups.some((group) => group.id === parsed)) {
        setSelectedGroupId(parsed);
      } else if (!parsed && nextGroups.length > 0) {
        setSelectedGroupId(nextGroups[0].id);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load profile"));
    } finally {
      setLoading(false);
    }
  }, [initialGroupId, username]);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (username && username === getUsername()) {
      router.push("/profile");
      return;
    }
    void loadProfile();
  }, [loadProfile, router, username]);

  useEffect(() => {
    if (!selectedGroupId) {
      setMutedUserIds([]);
      return;
    }
    void (async () => {
      try {
        const response = await api.get(`/groups/${selectedGroupId}/mutes`);
        const data = Array.isArray(response.data) ? (response.data as UserMute[]) : [];
        setMutedUserIds(data.map((item) => item.muted_user_id));
      } catch {
        setMutedUserIds([]);
      }
    })();
  }, [selectedGroupId]);

  const isMutedInSelectedGroup = useMemo(() => {
    if (!profile) return false;
    return mutedUserIds.includes(profile.id);
  }, [mutedUserIds, profile]);

  async function toggleFriend() {
    if (!profile) return;
    setBusyAction("friend");
    try {
      const friendState = getFriendState(profile);
      if (friendState === "friends") {
        await api.delete(`/users/friends/${profile.id}`);
        setProfile((prev) =>
          prev ? { ...prev, is_friend: false, friend_state: "none", friend_request_id: null } : prev
        );
        showNotice({ message: `You removed @${profile.username} from your friends list.` });
      } else if (friendState === "incoming_pending" && profile.friend_request_id) {
        await api.patch(`/users/friend-requests/${profile.friend_request_id}`, { action: "accepted" });
        setProfile((prev) =>
          prev ? { ...prev, is_friend: true, friend_state: "friends", friend_request_id: null } : prev
        );
        showNotice({ message: `You are now friends with @${profile.username}.` });
      } else if (friendState === "outgoing_pending") {
        showNotice({ message: `Your friend request to @${profile.username} is still pending.` });
      } else {
        setProfile((prev) =>
          prev ? { ...prev, friend_state: "outgoing_pending" } : prev
        );
        await api.post(`/users/friends/${profile.id}`);
        showNotice({ message: `Friend request sent to @${profile.username}.` });
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update friend"));
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleMute() {
    if (!profile || !selectedGroupId) return;
    setBusyAction("mute");
    try {
      if (isMutedInSelectedGroup) {
        await api.delete(`/groups/${selectedGroupId}/mutes/${profile.id}`);
        setMutedUserIds((prev) => prev.filter((id) => id !== profile.id));
        showNotice({
          message: `You unmuted @${profile.username} in this group. Their messages will appear normally again.`,
        });
      } else {
        await api.post(`/groups/${selectedGroupId}/mutes`, {
          muted_user_id: profile.id,
        });
        setMutedUserIds((prev) => [...prev, profile.id]);
        showNotice({
          message: `You muted @${profile.username} in this group. Their messages will stay hidden behind a placeholder. You can unmute them anytime.`,
          actions: [
            {
              label: "Unmute",
              onClick: () => {
                void api.delete(`/groups/${selectedGroupId}/mutes/${profile.id}`).then(() => {
                  setMutedUserIds((prev) => prev.filter((id) => id !== profile.id));
                });
              },
            },
          ],
        });
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update mute"));
    } finally {
      setBusyAction(null);
    }
  }

  const displayName =
    profile?.is_available === false
      ? "Unavailable user"
      : profile?.full_name || profile?.username || "User";
  const friendState = getFriendState(profile);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="aurea-link text-sm font-medium"
          >
            ← Back
          </button>
        </div>

        <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-[#FCF8F6]">Profile</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-6">
            {loading ? (
              <div className="text-[#d2bfd0]">Loading profile...</div>
            ) : !profile ? (
              <div className="text-[#d2bfd0]">Profile not found.</div>
            ) : (
              <>
                <div className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-white/5 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <AvatarBadge
                      name={displayName}
                      avatarUrl={profile.avatar_url || null}
                      size="lg"
                    />
                    <div>
                      <div className="text-3xl font-semibold text-[#FCF8F6]">{displayName}</div>
                      <div className="mt-2 text-sm text-[#B9929F]">
                        @{profile.username}
                        {profile.is_available === false
                          ? " · unavailable"
                          : profile.pronouns
                            ? ` · ${profile.pronouns}`
                            : ""}
                        {profile.role ? ` · ${profile.role}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={
                        profile.is_available === false ||
                        busyAction === "friend" ||
                        friendState === "outgoing_pending"
                      }
                      onClick={toggleFriend}
                      className={`rounded-2xl ${
                        friendState === "friends" || friendState === "outgoing_pending"
                          ? "bg-white/10 text-white hover:bg-white/15"
                          : "bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                      }`}
                    >
                      {friendState === "friends"
                        ? "Friends"
                        : friendState === "outgoing_pending"
                          ? "Pending"
                          : friendState === "incoming_pending"
                            ? "Accept"
                            : "Add Friend"}
                    </Button>
                    {friendState === "incoming_pending" && profile.friend_request_id ? (
                      <Button
                        variant="outline"
                        disabled={busyAction === "friend"}
                        className="aurea-button-ghost rounded-2xl"
                        onClick={async () => {
                          setBusyAction("friend");
                          try {
                            await api.patch(`/users/friend-requests/${profile.friend_request_id}`, { action: "declined" });
                            setProfile((prev) =>
                              prev ? { ...prev, friend_state: "none", friend_request_id: null } : prev
                            );
                            showNotice({ message: `You declined @${profile.username}'s friend request.` });
                          } catch (e: unknown) {
                            toast.error(getErrorMessage(e, "Could not update friend"));
                          } finally {
                            setBusyAction(null);
                          }
                        }}
                      >
                        Decline
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                      Bio
                    </div>
                    <div className="mt-4 text-sm leading-7 text-[#d2bfd0]">
                      {profile.bio || "No bio added yet."}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                      Actions
                    </div>
                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2 text-sm text-[#D8CFF0]">
                        <span>Group context</span>
                        <select
                          value={selectedGroupId ?? ""}
                          onChange={(event) => setSelectedGroupId(event.target.value ? Number(event.target.value) : null)}
                          className="rounded-2xl border border-white/12 bg-[#140f25] px-4 py-3 text-[#F8F5FF]"
                        >
                          <option value="">Select a group</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Button
                        onClick={() => setReportOpen(true)}
                        disabled={!selectedGroupId}
                        className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]"
                      >
                        Report User
                      </Button>
                      <Button
                        variant="outline"
                        onClick={toggleMute}
                        disabled={!selectedGroupId || busyAction === "mute"}
                        className="aurea-button-ghost rounded-2xl"
                      >
                        {isMutedInSelectedGroup ? "Unmute User" : "Mute User"}
                      </Button>
                      {!selectedGroupId ? (
                        <div className="text-sm leading-6 text-[#B8A9D6]">
                          Choose one of your groups to use report or mute actions for this user.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ReportDialog
        open={reportOpen}
        msg={null}
        reportedUserId={profile?.id ?? null}
        groupId={selectedGroupId}
        onClose={() => setReportOpen(false)}
      />
    </AppShell>
  );
}
