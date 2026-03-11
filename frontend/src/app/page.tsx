"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { isAuthed, getUsername } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const authed = isAuthed();
  const username = getUsername();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        {/* HERO */}
        <div className="grid gap-8 md:grid-cols-[1.15fr_.85fr] md:items-start">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#0B132B] md:text-5xl">
              Gentle design. <span className="text-[#3A506B]">Real-time safety.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-[#3A506B]">
              Aurea is a safety-first live chat prototype. It demonstrates real-time WebSocket messaging,
              risky-content flagging, and a report → alerts workflow designed for moderation.
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
              >
                <Link href="/chat">Open Chat</Link>
              </Button>

              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/alerts">View Alerts</Link>
              </Button>

              {authed ? (
                <Button
                  asChild
                  className="rounded-2xl bg-[#5BC0BE] text-[#0B132B] hover:bg-[#6FFFE9]"
                >
                  <Link href="/groups">Groups (create / join)</Link>
                </Button>
              ) : (
                <>
                  <Button
                    asChild
                    className="rounded-2xl bg-[#5BC0BE] text-[#0B132B] hover:bg-[#6FFFE9]"
                  >
                    <Link href="/register">Create account</Link>
                  </Button>

                  <Button asChild variant="ghost" className="rounded-2xl">
                    <Link href="/login">Login</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Demo tip */}
            <div className="mt-4 text-sm text-[#3A506B]">
              Tip: create two users (Alice/Bob), create or join the same group, then open chat in two browser windows.
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="rounded-3xl border border-black/5 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div className="text-sm font-medium text-[#0B132B]">Status</div>

            <div className="mt-2 rounded-2xl border border-black/5 bg-white p-4">
              {authed ? (
                <>
                  <div className="text-sm text-[#3A506B]">Signed in as</div>
                  <div className="mt-1 text-lg font-semibold text-[#0B132B]">
                    {username ?? "Authenticated user"}
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Button asChild variant="outline" className="rounded-2xl">
                      <Link href="/groups">Go to Groups</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <Link href="/chat">Go to Chat</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <Link href="/alerts">Go to Alerts</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-[#3A506B]">
                    You’re not logged in. Create an account to test groups and reporting.
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button asChild className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]">
                      <Link href="/register">Register</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <Link href="/login">Login</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 text-xs text-[#3A506B]">
              If something shows “Invalid token” or “WebSocket error”, it usually means backend endpoints or token
              validation needs syncing — we’ll fix those next.
            </div>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Card className="rounded-3xl border-black/5 bg-white/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-[#0B132B]">Live WebSocket Chat</CardTitle>
            </CardHeader>
            <CardContent className="text-[#3A506B]">
              Real-time messages between users with no refresh. Built to demonstrate WebSockets clearly.
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-black/5 bg-white/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-[#0B132B]">Risk Flagging</CardTitle>
            </CardHeader>
            <CardContent className="text-[#3A506B]">
              Potentially risky content is marked in the UI (optional score + reasons for explanation).
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-black/5 bg-white/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-[#0B132B]">Report → Alerts</CardTitle>
            </CardHeader>
            <CardContent className="text-[#3A506B]">
              Users can report flagged messages. Alerts are stored and reviewed on the Alerts screen.
            </CardContent>
          </Card>
        </div>

        {/* HOW TO DEMO */}
        <div className="mt-10">
          <Card className="rounded-3xl border-black/5 bg-white/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-[#0B132B]">Demo flow (2–3 minutes)</CardTitle>
            </CardHeader>
            <CardContent className="text-[#3A506B]">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Create two users (Register) and login.</li>
                <li>Go to Groups → create a group → copy invite code.</li>
                <li>Open another browser window → join group with invite code.</li>
                <li>Open Chat → connect → send messages → see risk flagging.</li>
                <li>Report a flagged message → open Alerts to review.</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}