"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr(null);
    setLoading(true);

    try {
      const res = await api.post(LOGIN_PATH, { username, password });

      const token =
        res.data?.access_token ?? res.data?.token ?? res.data?.jwt ?? null;

      if (!token) {
        setErr("Could not read token from response.");
        return;
      }

      setAuth(token, res.data?.username ?? username, res.data?.role ?? "user");
      router.push("/");
    } catch (e: unknown) {
      setErr(getErrorMessage(e, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page min-h-screen px-6 py-12 text-[#FCF8F6]">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center justify-center">
        <Card className="w-full rounded-[40px] border-white/10 bg-[linear-gradient(180deg,rgba(33,26,41,0.9),rgba(20,14,26,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="text-4xl text-[#FCF8F6]">Login</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
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
              />
            </div>

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

            <Button
              onClick={onSubmit}
              disabled={loading || !username || !password}
              className="w-full rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>

            <Button
              variant="outline"
              className="w-full rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => router.push("/register")}
            >
              Create an account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
