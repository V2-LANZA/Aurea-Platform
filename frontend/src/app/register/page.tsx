"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const REGISTER_PATH = "/auth/register";
const LOGIN_PATH = "/auth/login";

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

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminSetupKey, setAdminSetupKey] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr(null);

    if (!username.trim() || !email.trim() || !dateOfBirth || !password.trim()) {
      setErr("Please fill in username, email, date of birth, and password.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await api.post(REGISTER_PATH, {
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        date_of_birth: dateOfBirth,
        full_name: fullName.trim() || null,
        password,
        admin_setup_key: adminSetupKey.trim() || null,
      });

      const loginRes = await api.post(LOGIN_PATH, {
        username: username.trim().toLowerCase(),
        password,
      });

      const token =
        loginRes.data?.access_token ?? loginRes.data?.token ?? loginRes.data?.jwt ?? null;

      if (!token) {
        setErr("Account created, but login could not be completed automatically.");
        return;
      }

      setAuth(token, loginRes.data?.username ?? username.trim(), loginRes.data?.role ?? "user");
      router.push("/");
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page min-h-screen px-6 py-12 text-[#FCF8F6]">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center justify-center">
        <Card className="w-full rounded-[40px] border-white/10 bg-[linear-gradient(180deg,rgba(33,26,41,0.9),rgba(20,14,26,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="text-4xl text-[#FCF8F6]">Create account</CardTitle>
          </CardHeader>

          <CardContent className="grid gap-5">
            {err && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm text-[#E2C2C6]">Username</div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                placeholder="Choose a unique username"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-[#E2C2C6]">Email</div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm text-[#E2C2C6]">Date of birth</div>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-[#E2C2C6]">Full name</div>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm text-[#E2C2C6]">Password</div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm text-[#E2C2C6]">Confirm password</div>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-[#E2C2C6]">Admin setup key (optional)</div>
              <Input
                type="password"
                value={adminSetupKey}
                onChange={(e) => setAdminSetupKey(e.target.value)}
                className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-[#8f7d8f]"
              />
            </div>

            <Button
              onClick={onSubmit}
              disabled={loading}
              className="w-full rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
            >
              {loading ? "Creating..." : "Create account"}
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => router.push("/login")}
            >
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
