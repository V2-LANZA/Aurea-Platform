"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRole, getUsername, isAdmin, isAuthed } from "@/lib/auth";

const particles = Array.from({ length: 26 }, (_, index) => ({
  left: `${(index * 17) % 100}%`,
  top: `${(index * 23) % 100}%`,
  size: 6 + (index % 4) * 3,
  duration: `${15 + (index % 6) * 4}s`,
  delay: `${(index % 7) * 1.5}s`,
}));

const benefitCards = [
  {
    title: "Why Use Aurea",
    text:
      "Aurea helps identify grooming patterns while a conversation is still unfolding, so safeguarding teams can act with context instead of reacting too late.",
  },
  {
    title: "Why Child Safety Matters",
    text:
      "Children and teens often encounter manipulation through ordinary language, trust-building, secrecy, and requests for personal details. Early signal detection matters because harm usually starts quietly.",
  },
  {
    title: "Bot Layer Coming Next",
    text:
      "We are building an assistant that can intervene inside the chat, reinforce safer boundaries, and support moderators with real-time context during risky exchanges.",
  },
];

const carouselSlides = [
  {
    title: "Real-time detection",
    text: "Spot manipulative language patterns and escalate risk before a conversation turns dangerous.",
    image: "/slide-detection.svg",
  },
  {
    title: "Moderation workflows",
    text: "Give teams clearer alert context, review actions, and better visibility into ongoing incidents.",
    image: "/slide-moderation.svg",
  },
  {
    title: "Bot-assisted support",
    text: "Prepare for guided, in-chat safety prompts that can respond the moment harmful behaviour appears.",
    image: "/slide-bot.svg",
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setAuthed(isAuthed());
      setAdmin(isAdmin());
      setUsername(getUsername());
      setRole(getRole());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCarouselIndex((current) => (current + 1) % carouselSlides.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <AppShell>
      <div className="aurea-home relative overflow-hidden">
        <div className="aurea-particle-layer" aria-hidden="true">
          {particles.map((particle, index) => (
            <span
              key={`particle-${index}`}
              className="aurea-particle"
              style={{
                left: particle.left,
                top: particle.top,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDuration: particle.duration,
                animationDelay: particle.delay,
              }}
            />
          ))}
        </div>

        <div className="aurea-orb aurea-orb-left" aria-hidden="true" />
        <div className="aurea-orb aurea-orb-right" aria-hidden="true" />
        <div className="aurea-grid" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-7xl px-6">
          <section className="py-16 md:py-20">
            <div className="grid w-full gap-10">
              <div className="space-y-8">
                <div className="inline-flex rounded-full border border-[#F5D547]/30 bg-[#F5D547]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#F5D547]">
                  Real-time child safety intelligence
                </div>

                <div className="space-y-6">
                  <h1 className="max-w-4xl text-5xl font-semibold leading-[0.94] tracking-tight text-[#FCF8F6] md:text-7xl">
                    Aurea: Real time detection and alerting of online grooming
                    in youth chat.
                  </h1>

                  <p className="max-w-2xl text-lg leading-8 text-[#d3bfcd] md:text-xl">
                    A more immersive safeguarding platform for youth-facing chat:
                    designed to detect harmful conversational patterns, surface
                    alert context, and support the next generation of bot-assisted
                    intervention.
                  </p>
                </div>

                {mounted && authed && (
                  <div className="max-w-2xl rounded-[32px] border border-[#B9929F]/24 bg-white/6 px-5 py-4 text-sm text-[#E2C2C6] backdrop-blur-xl">
                    Welcome back{username ? `, ${username}` : ""}. You are signed
                    in as{" "}
                    <span className="font-semibold text-[#FCF8F6]">
                      {role || "user"}
                    </span>
                    .
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {mounted && authed ? (
                    <>
                      <Button
                        asChild
                        className="rounded-full bg-[#F5D547] px-7 text-[#0C0910] hover:bg-[#edd031]"
                      >
                        <Link href="/groups">Explore Protected Groups</Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        className="rounded-full border-white/15 bg-white/5 px-7 text-[#FCF8F6] hover:bg-white/10"
                      >
                        <Link href="/alerts">See Live Alerts</Link>
                      </Button>

                      {admin && (
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-full border-[#B9929F]/30 bg-[#453750]/65 px-7 text-[#FCF8F6] hover:bg-[#5a4665]"
                        >
                          <Link href="/admin">Open Admin Dashboard</Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        asChild
                        className="rounded-full bg-[#F5D547] px-7 text-[#0C0910] hover:bg-[#edd031]"
                      >
                        <Link href="/register">Create Account</Link>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        className="rounded-full border-white/15 bg-white/5 px-7 text-[#FCF8F6] hover:bg-white/10"
                      >
                        <Link href="/login">Sign In</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="py-12 md:py-16">
            <div className="grid w-full gap-8 xl:grid-cols-[.95fr_1.05fr]">
              <div className="space-y-6">
                <div className="text-xs font-semibold uppercase tracking-[0.32em] text-[#B9929F]">
                  Vision and mission
                </div>
                <h2 className="max-w-xl text-4xl font-semibold leading-tight text-[#FCF8F6] md:text-5xl">
                  Building youth chat spaces that are elegant, monitored, and safe by design.
                </h2>
                <p className="max-w-xl text-lg leading-8 text-[#cdb7c9]">
                  Aurea is designed to feel calm and premium while solving a hard
                  safeguarding problem. The system supports earlier detection,
                  clearer escalation, and a more compassionate response model.
                </p>
              </div>

              <div className="grid gap-6">
                <div className="aurea-story-card">
                  <div className="aurea-story-eyebrow">Vision</div>
                  <h3 className="aurea-story-title">
                    A future where child safety tools are embedded into digital conversation, not bolted on after harm appears.
                  </h3>
                  <p className="aurea-story-copy">
                    Young people deserve online environments that protect them in
                    real time, with systems that can recognize grooming cues
                    before they become entrenched patterns of manipulation.
                  </p>
                </div>

                <div className="aurea-story-card">
                  <div className="aurea-story-eyebrow">Mission</div>
                  <h3 className="aurea-story-title">
                    Detect suspicious conversational behaviour, alert moderators, and support action while the exchange is still active.
                  </h3>
                  <p className="aurea-story-copy">
                    Aurea combines live detection, alert routing, review flows,
                    and the upcoming bot layer to create a more complete safety
                    response around youth chat.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="py-12 md:py-16">
            <div className="grid w-full items-start gap-6 xl:grid-cols-[.95fr_1.05fr]">
              <div className="grid gap-6">
                {benefitCards.map((card) => (
                  <Card
                    key={card.title}
                    className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                  >
                    <CardHeader>
                      <CardTitle className="text-2xl text-[#FCF8F6]">
                        {card.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-base leading-8 text-[#d2bfd0]">
                      {card.text}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="aurea-carousel-shell">
                <div className="aurea-carousel-frame">
                  {carouselSlides.map((slide, index) => (
                    <div
                      key={slide.title}
                      className={`aurea-carousel-slide ${
                        index === carouselIndex ? "aurea-carousel-slide-active" : ""
                      }`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10">
                        <Image
                          src={slide.image}
                          alt={slide.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1280px) 100vw, 50vw"
                        />
                      </div>
                      <div className="mt-5 space-y-2">
                        <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#F5D547]">
                          Why Use Aurea
                        </div>
                        <div className="text-2xl font-semibold text-[#FCF8F6]">
                          {slide.title}
                        </div>
                        <p className="max-w-xl text-base leading-8 text-[#d2bfd0]">
                          {slide.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="flex gap-2">
                    {carouselSlides.map((slide, index) => (
                      <button
                        key={slide.title}
                        type="button"
                        aria-label={`Show ${slide.title}`}
                        onClick={() => setCarouselIndex(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          index === carouselIndex
                            ? "w-10 bg-[#F5D547]"
                            : "w-2.5 bg-white/25 hover:bg-white/45"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="text-sm text-[#bfaebb]">
                    Slide {carouselIndex + 1} / {carouselSlides.length}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="py-12 md:py-16">
            <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_.9fr]">
              <div className="aurea-immersive-card">
                <div className="aurea-story-eyebrow">Why early detection matters</div>
                <h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-[#FCF8F6] md:text-5xl">
                  Grooming usually looks ordinary before it looks dangerous.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[#d5c3d3]">
                  It can start with friendliness, then requests for privacy,
                  personal details, or emotional dependence. That is why waiting
                  for obvious evidence is rarely enough. Aurea focuses on
                  identifying those subtle shifts sooner.
                </p>
              </div>

              <div className="grid gap-5">
                <div className="aurea-side-card">
                  <div className="aurea-side-title">Detection</div>
                  <p className="aurea-side-copy">
                    Real-time cues for secrecy, explicit asks, location probing,
                    isolation language, and manipulative escalation.
                  </p>
                </div>
                <div className="aurea-side-card">
                  <div className="aurea-side-title">Moderation</div>
                  <p className="aurea-side-copy">
                    Structured alerts, review workflows, escalation paths, and
                    user controls for fast intervention.
                  </p>
                </div>
                <div className="aurea-side-card">
                  <div className="aurea-side-title">Bot Response</div>
                  <p className="aurea-side-copy">
                    The upcoming bot will provide in-chat guidance and support a
                    more immediate protective response around the user.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
