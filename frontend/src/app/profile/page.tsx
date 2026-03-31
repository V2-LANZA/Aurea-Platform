"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarBadge } from "@/components/avatar-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";
import { toast } from "sonner";

type Me = {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  pronouns?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  role: string;
  is_suspended: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = typedError?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }
  return typedError?.message || fallback;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Me | null>(null);
  const [fullName, setFullName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    void loadProfile();
  }, [router]);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await api.get("/users/me");
      const data = res.data as Me;
      setProfile(data);
      setFullName(data.full_name || "");
      setPronouns(data.pronouns || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load profile"));
    } finally {
      setLoading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await api.patch("/users/me", {
        full_name: fullName.trim() || null,
        pronouns: pronouns.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      setProfile(res.data);
      toast.success("Profile updated");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not save profile"));
    } finally {
      setSaving(false);
    }
  }

  const displayName = fullName.trim() || profile?.username || "User";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-[#FCF8F6]">View profile</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-6">
              <div className="flex items-start gap-4">
                <AvatarBadge name={displayName} avatarUrl={avatarUrl || null} size="lg" />
                <div>
                  <div className="text-2xl font-semibold text-[#FCF8F6]">{displayName}</div>
                  <div className="mt-1 text-sm text-[#B9929F]">
                    @{profile?.username || "username"}
                    {pronouns.trim() ? ` · ${pronouns.trim()}` : ""}
                  </div>
                  <div className="mt-2 text-sm text-[#d2bfd0]">{profile?.email || ""}</div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B9929F]">
                  Bio
                </div>
                <p className="mt-3 text-sm leading-7 text-[#d2bfd0]">
                  {bio.trim() || "No bio added yet."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-[#FCF8F6]">Edit profile</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5">
              {loading ? (
                <div className="text-[#d2bfd0]">Loading profile...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-sm text-[#E2C2C6]">Full name</div>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-[#E2C2C6]">Pronouns</div>
                    <Input
                      value={pronouns}
                      onChange={(e) => setPronouns(e.target.value)}
                      className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-[#E2C2C6]">Profile picture</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onFileChange}
                      className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#d2bfd0]"
                    />
                    <div className="text-xs text-[#8f7d8f]">
                      Choose an image from your computer to update your avatar.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-[#E2C2C6]">Bio</div>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="min-h-32 w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-[#F5D547]/50"
                    />
                  </div>

                  <Button
                    onClick={saveProfile}
                    disabled={saving}
                    className="w-full rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                  >
                    {saving ? "Saving..." : "Save profile"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
