"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getRole, getUsername, isAdmin, isAuthed } from "@/lib/auth";
import { openSafetyHelp } from "@/lib/safety-help";

const particles = Array.from({ length: 26 }, (_, index) => ({
  left: `${(index * 17) % 100}%`,
  top: `${(index * 23) % 100}%`,
  size: 6 + (index % 4) * 3,
  duration: `${15 + (index % 6) * 4}s`,
  delay: `${(index % 7) * 1.5}s`,
}));

const protectionFlow = [
  {
    title: "Message sent",
    text: "A conversation starts normally inside a protected group.",
    accent: "from-[#5c3d86] to-[#8f6ed2]",
  },
  {
    title: "Risk checked",
    text: "Aurea scans for pressure, threats, and unsafe patterns in real time.",
    accent: "from-[#6b4bb8] to-[#d2a4ff]",
  },
  {
    title: "Bot responds",
    text: "Aurea Bot gives warnings, support, and safer next steps.",
    accent: "from-[#f5d547] to-[#f0b45d]",
  },
  {
    title: "Admin reviews",
    text: "Moderators get clearer alerts and faster decisions when risk rises.",
    accent: "from-[#4fd1c5] to-[#6ee7d8]",
  },
];

const botHighlights = [
  {
    title: "Warns early",
    text: "Flags risky patterns before they grow into bigger problems.",
  },
  {
    title: "Supports users",
    text: "Offers help, reporting, and calm guidance during unsafe moments.",
  },
  {
    title: "Helps moderators",
    text: "Connects real-time signals to alerts and admin review tools.",
  },
];

const carouselSlides = [
  {
    key: "chat",
    title: "Protected group chat",
    text: "Real-time messaging with built-in safety awareness.",
    image: "/images/home/carousel-chat.png",
    accent: "from-[#6d49af]/40 via-[#2b2147]/40 to-[#11141f]/90",
    label: "Live messaging",
  },
  {
    key: "bot",
    title: "Aurea Bot intervention",
    text: "Guidance appears when a conversation may become unsafe.",
    image: "/images/home/carousel-bot.png",
    accent: "from-[#f5d547]/18 via-[#3b2a52]/55 to-[#12111d]/92",
    label: "Bot guidance",
  },
  {
    key: "admin",
    title: "Admin moderation",
    text: "Alerts help moderators review risk with clearer context.",
    image: "/images/home/carousel-admin.png",
    accent: "from-[#4fd1c5]/20 via-[#1e2e45]/55 to-[#11131d]/92",
    label: "Review queue",
  },
];

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function HomeVisual({
  src,
  label,
  title,
  accentClass,
  children,
  className = "",
}: {
  src?: string;
  label: string;
  title: string;
  accentClass: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!src) {
      setImageLoaded(false);
      return;
    }
    let cancelled = false;
    const preview = new window.Image();
    preview.onload = () => {
      if (!cancelled) setImageLoaded(true);
    };
    preview.onerror = () => {
      if (!cancelled) setImageLoaded(false);
    };
    preview.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={`group relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(170deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03)),linear-gradient(150deg,rgba(23,16,39,0.96),rgba(11,10,18,0.98))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_120px_rgba(0,0,0,0.42)] ${className}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} opacity-100`} />
      <div className="absolute inset-x-8 top-0 h-20 rounded-full bg-white/6 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#f5d547]">
              {label}
            </div>
            <div className="mt-2 text-lg font-semibold text-[#fcf8f6]">{title}</div>
          </div>
          <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-[#d9cff1]">
            Preview
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-[#120f1c]/88">
          {src && imageLoaded ? (
            <img
              src={src}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="relative min-h-[250px] p-5">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

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

  const primaryGroupHref = authed ? "/groups" : "/register";
  const primaryGroupLabel = authed ? "Open Protected Groups" : "Open Protected Groups";
  const footerGroupLabel = authed ? "Create or open a group" : "Create or open a group";

  const statusText = useMemo(() => {
    if (!mounted || !authed) return null;
    return `Signed in${username ? ` as ${username}` : ""}${role ? ` · ${role}` : ""}`;
  }, [authed, mounted, role, username]);

  const nextSlide = () => setActiveSlide((value) => (value + 1) % carouselSlides.length);
  const prevSlide = () =>
    setActiveSlide((value) => (value - 1 + carouselSlides.length) % carouselSlides.length);

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

        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-28 px-6 pb-24 pt-10 md:gap-32 md:pb-32 md:pt-14">
          <section className="grid min-h-[80vh] items-center gap-12 xl:grid-cols-[1.02fr_0.98fr]">
            <Reveal className="space-y-8">
              <div className="inline-flex rounded-full border border-[#f5d547]/25 bg-[#f5d547]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f5d547] shadow-[0_0_30px_rgba(245,213,71,0.08)]">
                Premium safety-tech prototype
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-semibold leading-[0.93] tracking-[-0.04em] text-[#fcf8f6] md:text-7xl">
                  Safer group chats, guided by Aurea Bot.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[#ddd5f1] md:text-xl">
                  A youth chat safety prototype that detects risky patterns, supports users, and helps moderators respond faster.
                </p>
              </div>

              {statusText ? (
                <div className="inline-flex rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-[#d8cff0] backdrop-blur-xl">
                  {statusText}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  className="rounded-full bg-[#f5d547] px-7 text-[#0c0910] shadow-[0_10px_30px_rgba(245,213,71,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ecd031] active:scale-[0.98]"
                >
                  <Link href={primaryGroupHref}>{primaryGroupLabel}</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-white/14 bg-white/6 px-7 text-[#fcf8f6] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.98]"
                  onClick={openSafetyHelp}
                >
                  Talk to Aurea Bot
                </Button>
                {mounted && authed && admin ? (
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-[#4fd1c5]/25 bg-[#10333a]/45 px-7 text-[#d5fffa] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#12434a]/60 active:scale-[0.98]"
                  >
                    <Link href="/admin">Open Admin Dashboard</Link>
                  </Button>
                ) : null}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <HomeVisual
                src="/images/home/hero-dashboard-preview.png"
                label="Hero preview"
                title="Aurea in action"
                accentClass="from-[#5f4294]/24 via-[#1b1730]/10 to-[#4fd1c5]/8"
              >
                <div className="grid gap-4">
                  <div className="rounded-[24px] border border-white/10 bg-[#171227]/88 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
                    <div className="text-xs uppercase tracking-[0.24em] text-[#b9a9d6]">Group message</div>
                    <div className="mt-3 rounded-[18px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[#f8f5ff]">
                      “You do not have to send that. Keep it between us.”
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-[#f5d547]/16 bg-[#271e3a]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f5d547]/28 bg-[#f5d547]/14 text-sm font-semibold text-[#f5d547]">
                        AB
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-[#f5d547]">Aurea Bot</div>
                        <div className="mt-1 text-sm text-[#fcf8f6]">
                          This conversation may be becoming unsafe. You do not have to reply.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-[#ff7f8a]/16 bg-[#2a1c29]/90 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-[#ffb6bf]">Admin alert</div>
                        <div className="mt-1 text-sm text-[#fcf8f6]">High risk: secrecy + repeated pressure</div>
                      </div>
                      <div className="rounded-full border border-[#4fd1c5]/24 bg-[#4fd1c5]/10 px-3 py-1 text-xs text-[#aef5ec]">
                        Review now
                      </div>
                    </div>
                  </div>
                </div>
              </HomeVisual>
            </Reveal>
          </section>

          <section className="space-y-10">
            <Reveal className="max-w-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#bdaee1]">
                How Aurea protects
              </div>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[#fcf8f6] md:text-5xl">
                How Aurea protects conversations
              </h2>
            </Reveal>

            <div className="relative grid gap-4 lg:grid-cols-4">
              <div className="pointer-events-none absolute left-[12%] right-[12%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-[#6d49af]/0 via-[#f5d547]/55 to-[#4fd1c5]/0 lg:block" />
              {protectionFlow.map((step, index) => (
                <Reveal key={step.title} delay={index * 90}>
                  <div className="relative h-full rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(31,20,47,0.88),rgba(14,11,24,0.94))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/14 hover:shadow-[0_26px_70px_rgba(0,0,0,0.28)]">
                    <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${step.accent}`} />
                    <div className="mt-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/8 text-sm font-semibold text-[#fcf8f6]">
                      {index + 1}
                    </div>
                    <div className="mt-6 text-2xl font-semibold text-[#fcf8f6]">{step.title}</div>
                    <p className="mt-3 text-sm leading-7 text-[#d9d0ee]">{step.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="grid items-center gap-10 xl:grid-cols-[1.02fr_0.98fr]">
            <Reveal className="space-y-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f5d547]">
                Meet Aurea Bot
              </div>
              <div>
                <h2 className="text-4xl font-semibold tracking-[-0.03em] text-[#fcf8f6] md:text-5xl">
                  Meet Aurea Bot
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-[#ddd5f1]">
                  Aurea Bot gives warnings, support, and clear next steps when a conversation starts to feel unsafe.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {botHighlights.map((card, index) => (
                  <Reveal key={card.title} delay={120 + index * 80}>
                    <div className="h-full rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/8">
                      <div className="text-lg font-semibold text-[#fcf8f6]">{card.title}</div>
                      <p className="mt-2 text-sm leading-7 text-[#d8cff0]">{card.text}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>

            <Reveal delay={140}>
              <HomeVisual
                src="/images/home/aurea-bot-spotlight.png"
                label="Bot spotlight"
                title="Guardian guidance"
                accentClass="from-[#f5d547]/22 via-[#5d4294]/18 to-[#4fd1c5]/12"
                className="min-h-[460px]"
              >
                <div className="flex min-h-[360px] flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div className="max-w-[14rem]">
                      <div className="text-sm uppercase tracking-[0.24em] text-[#f5d547]">Aurea Bot</div>
                      <div className="mt-3 text-2xl font-semibold text-[#fcf8f6]">
                        Calm guidance inside the conversation
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-[#f5d547]/30 blur-2xl" />
                      <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#f5d547]/28 bg-[radial-gradient(circle_at_35%_30%,rgba(245,213,71,0.24),rgba(92,61,134,0.18),rgba(13,9,25,0.95))] text-3xl font-semibold text-[#f5d547] shadow-[0_0_45px_rgba(245,213,71,0.16)]">
                        AB
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[24px] border border-[#f5d547]/16 bg-[#1c152c]/88 p-4 text-sm leading-7 text-[#efe8ff]">
                      “Repeated unsafe messages have been detected. If this continues, your sending access may be paused for review.”
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[#d9cff0]">
                        Warning popup
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[#d9cff0]">
                        Safety support
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[#d9cff0]">
                        Admin signal
                      </div>
                    </div>
                  </div>
                </div>
              </HomeVisual>
            </Reveal>
          </section>

          <section className="space-y-8">
            <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8bded6]">
                  Explore Aurea
                </div>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[#fcf8f6] md:text-5xl">
                  Explore Aurea
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={prevSlide}
                  className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-[#fcf8f6] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.98]"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-[#fcf8f6] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.98]"
                >
                  →
                </button>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,15,33,0.9),rgba(11,10,18,0.96))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                >
                  {carouselSlides.map((slide) => (
                    <div key={slide.key} className="min-w-full px-2">
                      <div className="grid items-center gap-6 rounded-[30px] border border-white/8 bg-white/[0.03] p-5 lg:grid-cols-[1.05fr_0.95fr]">
                        <HomeVisual
                          src={slide.image}
                          label={slide.label}
                          title={slide.title}
                          accentClass={slide.accent}
                          className="h-full"
                        >
                          <div className="flex min-h-[280px] flex-col justify-between">
                            <div className="flex items-center justify-between gap-3">
                              <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-[#d8cff0]">
                                {slide.label}
                              </div>
                              <div className="rounded-full border border-[#f5d547]/20 bg-[#f5d547]/10 px-3 py-1 text-xs text-[#f5d547]">
                                Prototype
                              </div>
                            </div>
                            <div className="grid gap-3">
                              <div className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-[#f8f5ff]">
                                {slide.key === "chat" && "Unread counts, profile actions, and protected group conversations."}
                                {slide.key === "bot" && "Aurea Bot warns early and gives safer next steps without flooding the chat."}
                                {slide.key === "admin" && "Pending review, high risk, restrictions, and notes stay connected in one flow."}
                              </div>
                              <div className="h-28 rounded-[22px] border border-white/10 bg-[linear-gradient(120deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]" />
                            </div>
                          </div>
                        </HomeVisual>

                        <div className="space-y-5 px-2 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#b9aedf]">
                            Slide {carouselSlides.findIndex((item) => item.key === slide.key) + 1}
                          </div>
                          <h3 className="text-3xl font-semibold tracking-[-0.03em] text-[#fcf8f6]">
                            {slide.title}
                          </h3>
                          <p className="max-w-lg text-lg leading-8 text-[#ddd5f1]">{slide.text}</p>
                          <div className="grid gap-3">
                            <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 text-sm leading-7 text-[#d8cff0]">
                              Aurea keeps the product centred on safer conversation flow rather than a passive dashboard.
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {["Dark glass UI", "Bot-centred design", "Safety workflow"].map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-[#f1ebff]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-center gap-3">
                  {carouselSlides.map((slide, index) => (
                    <button
                      key={`dot-${slide.key}`}
                      type="button"
                      aria-label={`Go to ${slide.title}`}
                      onClick={() => setActiveSlide(index)}
                      className={`h-3 rounded-full transition-all duration-300 ${
                        index === activeSlide
                          ? "w-10 bg-[#f5d547] shadow-[0_0_20px_rgba(245,213,71,0.22)]"
                          : "w-3 bg-white/20 hover:bg-white/35"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          </section>

          <section className="pb-4">
            <Reveal>
              <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,18,42,0.94),rgba(11,10,18,0.98))] px-7 py-10 shadow-[0_28px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:px-10 md:py-12">
                <div className="absolute inset-x-[18%] top-0 h-28 rounded-full bg-[#f5d547]/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-[#4fd1c5]/10 blur-3xl" />

                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f5d547]">
                      Final call to action
                    </div>
                    <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[#fcf8f6] md:text-5xl">
                      Build safer conversations with Aurea.
                    </h2>
                    <p className="mt-4 text-lg leading-8 text-[#ddd5f1]">
                      Aurea Bot is ready to support users when a conversation feels unsafe.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      asChild
                      className="rounded-full bg-[#f5d547] px-7 text-[#0c0910] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ecd031] active:scale-[0.98]"
                    >
                      <Link href={primaryGroupHref}>{footerGroupLabel}</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-white/14 bg-white/6 px-7 text-[#fcf8f6] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 active:scale-[0.98]"
                      onClick={openSafetyHelp}
                    >
                      Open Safety Help
                    </Button>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
