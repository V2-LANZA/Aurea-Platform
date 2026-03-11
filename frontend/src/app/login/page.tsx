"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LOGIN_PATH = "/auth/login"; // <- change if your docs show different

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

      setAuth(token, username);
      router.push("/chat");
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        "Login failed";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md rounded-3xl border-black/5 bg-white/85 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-[#0B132B]">Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm text-[#3A506B]">Username</div>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-2xl"
              placeholder="alice"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-[#3A506B]">Password</div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-2xl"
              placeholder="••••••••"
            />
          </div>

          <Button
            onClick={onSubmit}
            disabled={loading || !username || !password}
            className="w-full rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>

          <Button
            variant="outline"
            className="w-full rounded-2xl"
            onClick={() => router.push("/register")}
          >
            Create an account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
