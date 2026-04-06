"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarBadge } from "@/components/avatar-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getUsername, isAuthed } from "@/lib/auth";
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
  const username = params?.username;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await api.get(`/users/by-username/${username}`);
      setProfile(res.data);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load profile"));
    } finally {
      setLoading(false);
    }
  }, [username]);

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

  async function toggleFriend() {
    if (!profile) return;
    try {
      const res = profile.is_friend
        ? await api.delete(`/users/friends/${profile.id}`)
        : await api.post(`/users/friends/${profile.id}`);
      setProfile(res.data);
      toast.success(profile.is_friend ? "Friend removed" : "Friend added");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not update friend"));
    }
  }

  const displayName =
    profile?.is_available === false
      ? "Unavailable user"
      : profile?.full_name || profile?.username || "User";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
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
                      </div>
                    </div>
                  </div>

                  <Button
                    disabled={profile.is_available === false}
                    onClick={toggleFriend}
                    className={`rounded-2xl ${
                      profile.is_friend
                        ? "bg-white/10 text-white hover:bg-white/15"
                        : "bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                    }`}
                  >
                    {profile.is_friend ? "Remove friend" : "Add friend"}
                  </Button>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                    Bio
                  </div>
                  <div className="mt-4 text-sm leading-7 text-[#d2bfd0]">
                    {profile.bio || "No bio added yet."}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
