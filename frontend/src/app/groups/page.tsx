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

type Person = {
  id: number;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_suspended?: boolean;
  is_available?: boolean;
  is_friend?: boolean;
};

type Group = {
  id: number;
  name: string;
  invite_code: string;
  member_count?: number | null;
  member_preview?: Person[];
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

function displayName(person: Person) {
  return person.is_available === false
    ? "Unavailable user"
    : person.full_name || person.username;
}

function metaLabel(person: Person) {
  if (person.is_available === false) return `@${person.username} · unavailable`;
  return `@${person.username}${person.pronouns ? ` · ${person.pronouns}` : ""}`;
}

export default function GroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Person[]>([]);
  const [directory, setDirectory] = useState<Person[]>([]);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    if (!isAuthed()) router.push("/login");
  }, [router]);

  async function loadCommunity() {
    try {
      const [groupsRes, friendsRes, directoryRes] = await Promise.all([
        api.get("/groups"),
        api.get("/users/friends"),
        api.get("/users/directory"),
      ]);

      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : []);
      setDirectory(Array.isArray(directoryRes.data) ? directoryRes.data : []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load community data"));
    }
  }

  useEffect(() => {
    void loadCommunity();
  }, []);

  async function createGroup() {
    if (!createName.trim()) return;
    setLoading(true);

    try {
      const res = await api.post("/groups", { name: createName.trim() });
      const group = res.data;

      toast.success("Group created");
      setCreateName("");
      await loadCommunity();

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
      await loadCommunity();

      if (group?.id) {
        router.push(`/chat?group=${group.id}`);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not join group"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleFriend(user: Person) {
    try {
      if (user.is_friend) {
        await api.delete(`/users/friends/${user.id}`);
        toast.success("Friend removed");
      } else {
        await api.post(`/users/friends/${user.id}`);
        toast.success("Friend added");
      }
      await loadCommunity();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update friend"));
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
                <CardTitle className="text-3xl text-[#FCF8F6]">Friends</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 text-[#d2bfd0]">
                {friends.length === 0 ? (
                  <div className="rounded-[26px] border border-white/10 bg-white/5 p-5 text-sm leading-7">
                    No friends added yet. Browse the people section below and
                    connect with users you trust.
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-3 rounded-[26px] border border-white/10 bg-white/5 p-4"
                    >
                      <Link
                        href={`/profile/${friend.username}`}
                        className="flex items-center gap-3"
                      >
                        <AvatarBadge
                          name={displayName(friend)}
                          avatarUrl={friend.avatar_url || null}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-medium text-[#FCF8F6]">
                            {displayName(friend)}
                          </div>
                          <div className="text-xs text-[#B9929F]">{metaLabel(friend)}</div>
                        </div>
                      </Link>

                      <Button
                        variant="outline"
                        onClick={() => toggleFriend(friend)}
                        className="rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
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
                            <Link
                              key={member.id}
                              href={`/profile/${member.username}`}
                              className="flex items-center gap-3 rounded-full border border-white/10 bg-[#120E16] px-3 py-2"
                            >
                              <AvatarBadge
                                name={displayName(member)}
                                avatarUrl={member.avatar_url || null}
                                size="sm"
                              />
                              <div>
                                <div className="text-sm font-medium text-[#FCF8F6]">
                                  {displayName(member)}
                                </div>
                                <div className="text-xs text-[#B9929F]">
                                  {metaLabel(member)}
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

          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-[#FCF8F6]">People</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              {directory.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-[#d2bfd0]">
                  No other users are available yet.
                </div>
              ) : (
                directory.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <Link
                      href={`/profile/${person.username}`}
                      className="flex items-center gap-4"
                    >
                      <AvatarBadge
                        name={displayName(person)}
                        avatarUrl={person.avatar_url || null}
                        size="md"
                      />
                      <div>
                        <div className="text-lg font-semibold text-[#FCF8F6]">
                          {displayName(person)}
                        </div>
                        <div className="mt-1 text-sm text-[#B9929F]">{metaLabel(person)}</div>
                        <div className="mt-2 text-sm text-[#d2bfd0]">
                          {person.bio || "No bio yet."}
                        </div>
                      </div>
                    </Link>

                    <Button
                      disabled={person.is_available === false}
                      onClick={() => toggleFriend(person)}
                      className={`rounded-2xl ${
                        person.is_friend
                          ? "bg-white/10 text-white hover:bg-white/15"
                          : "bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                      }`}
                    >
                      {person.is_friend ? "Remove friend" : "Add friend"}
                    </Button>
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
