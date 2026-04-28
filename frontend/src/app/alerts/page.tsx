"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminSurface } from "@/components/admin/admin-surface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdmin, isAuthed } from "@/lib/auth";
import { openSafetyHelp } from "@/lib/safety-help";

const helpCards = [
  {
    title: "I feel unsafe now",
    body: "Move toward a trusted adult or safe public place now. If there is immediate danger, contact emergency services.",
  },
  {
    title: "Someone asked for my location",
    body: "Do not share your address, school, or live location. Save the messages and report the user from chat.",
  },
  {
    title: "Someone asked for photos",
    body: "Do not send private images. Keep the chat history and report the user.",
  },
  {
    title: "Someone asked me to keep a secret",
    body: "Secrecy requests are a warning sign. Tell a trusted adult or moderator and do not handle it alone.",
  },
  {
    title: "Someone wants to meet up",
    body: "Do not agree to meet alone. Keep the messages and tell a trusted adult or moderator right away.",
  },
  {
    title: "Someone is bullying me",
    body: "Stop engaging if you can, keep the chat history, report the behaviour, and tell a trusted adult or moderator.",
  },
];

const checklist = [
  "Do not share your address, school, or live location",
  "Do not send private images",
  "Do not meet alone",
  "Tell a trusted adult or moderator",
  "Report the user",
];

export default function AlertsPage() {
  const router = useRouter();
  const [openCard, setOpenCard] = useState<number | null>(0);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
      return;
    }
    if (isAdmin()) {
      router.replace("/admin/moderation");
    }
  }, [router]);

  return (
    <AppShell>
      <AdminSurface variant="alerts">
      <div className="aurea-page mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[#B8A9D6]">
              Safety centre
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#FCF8F6]">
              How can we help you stay safe?
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[#D8CFF0]">
              Tap a card for quick guidance, then report the user from chat if something feels unsafe, private, threatening, or sexual.
            </p>
          </div>

          <Card className="rounded-[32px] border border-red-400/20 bg-[linear-gradient(145deg,rgba(101,24,42,0.28),rgba(18,11,36,0.92))] shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-[#F5D547]">Emergency</div>
                <div className="mt-2 text-2xl font-semibold text-[#FCF8F6]">If you are in immediate danger, contact emergency services or a trusted adult now.</div>
              </div>
              <Button
                className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                onClick={openSafetyHelp}
              >
                Open Safety Help
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {helpCards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setOpenCard((current) => (current === index ? null : index))}
                className="aurea-panel rounded-[28px] p-6 text-left transition hover:bg-white/10"
              >
                <div className="text-lg font-semibold text-[#FCF8F6]">{card.title}</div>
                <div className="mt-3 text-sm text-[#D8CFF0]">
                  {openCard === index ? card.body : "Tap for quick advice"}
                </div>
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
            <Card className="aurea-panel rounded-[32px]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#FCF8F6]">Safety checklist</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {checklist.map((item) => (
                  <div key={item} className="aurea-panel-soft rounded-[24px] px-5 py-4 text-sm leading-7 text-[#F8F5FF]">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="aurea-panel rounded-[32px]">
              <CardHeader>
                <CardTitle className="text-2xl text-[#FCF8F6]">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="aurea-panel-soft rounded-[24px] px-5 py-4 text-sm leading-7 text-[#D8CFF0]">
                  If someone sends you a message that feels unsafe, private, threatening, sexual, or makes you uncomfortable, you can report them from the chat. Click the user’s name or the message options, then choose Report User.
                </div>
                <Button asChild className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]">
                  <Link href="/chat">Report a user from chat</Link>
                </Button>
                <Button asChild variant="outline" className="aurea-button-ghost rounded-2xl">
                  <Link href="/groups">Back to groups</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </AdminSurface>
    </AppShell>
  );
}
