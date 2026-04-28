"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as { response?: { data?: { detail?: string } }; message?: string };
  return typedError?.response?.data?.detail || typedError?.message || fallback;
}

export default function ForgotPasswordPage() {
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setMessage(null);
    setDevLink(null);
    try {
      const response = await api.post("/auth/forgot-password", { identity });
      setMessage(response.data?.message || "If an account matches that email or username, a reset link has been prepared.");
      if (response.data?.reset_url) {
        setDevLink(String(response.data.reset_url));
      }
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Could not start reset flow"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page min-h-screen px-6 py-12 text-[#FCF8F6]">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center justify-center">
        <Card className="w-full rounded-[40px] border-white/10 bg-[linear-gradient(180deg,rgba(33,26,41,0.9),rgba(20,14,26,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="text-4xl text-[#FCF8F6]">Forgot password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="text-sm leading-7 text-[#D8CFF0]">
              Enter your username or email. If the account exists, Aurea will prepare a reset link.
            </div>
            <div className="space-y-2">
              <div className="text-sm text-[#E2C2C6]">Username or email</div>
              <Input
                value={identity}
                onChange={(event) => setIdentity(event.target.value)}
                className="rounded-2xl border-white/10 bg-[#140f25] text-white placeholder:text-[#8f7d8f]"
                placeholder="you@example.com"
              />
            </div>
            <Button onClick={onSubmit} disabled={loading || !identity.trim()} className="w-full rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]">
              {loading ? "Preparing reset..." : "Send reset link"}
            </Button>
            {message ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#F8F5FF]">
                {message}
                {devLink ? (
                  <div className="mt-2">
                    <Link href={devLink} className="text-[#F5D547] hover:text-[#ffe47a]">
                      Open development reset link
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Link href="/login" className="block text-sm text-[#D8CFF0] hover:text-white">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
