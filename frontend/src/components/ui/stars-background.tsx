"use client";

import { cn } from "@/lib/utils";

const STAR_POINTS = [
  { left: "6%", top: "12%", size: 1, opacity: 0.12, duration: "5.2s", delay: "0s" },
  { left: "11%", top: "28%", size: 2, opacity: 0.2, duration: "6.4s", delay: "0.8s" },
  { left: "17%", top: "46%", size: 1, opacity: 0.14, duration: "5.8s", delay: "1.1s" },
  { left: "22%", top: "18%", size: 1, opacity: 0.16, duration: "7.2s", delay: "1.7s" },
  { left: "29%", top: "58%", size: 2, opacity: 0.22, duration: "6.8s", delay: "0.3s" },
  { left: "35%", top: "34%", size: 1, opacity: 0.13, duration: "5.9s", delay: "1.2s" },
  { left: "41%", top: "72%", size: 2, opacity: 0.17, duration: "7.1s", delay: "2.1s" },
  { left: "47%", top: "9%", size: 1, opacity: 0.12, duration: "5.4s", delay: "0.5s" },
  { left: "53%", top: "24%", size: 1, opacity: 0.15, duration: "6.6s", delay: "1.4s" },
  { left: "58%", top: "44%", size: 2, opacity: 0.18, duration: "7.3s", delay: "2.5s" },
  { left: "63%", top: "16%", size: 1, opacity: 0.14, duration: "6.1s", delay: "0.9s" },
  { left: "69%", top: "63%", size: 2, opacity: 0.2, duration: "7.7s", delay: "1.8s" },
  { left: "74%", top: "36%", size: 1, opacity: 0.13, duration: "5.6s", delay: "0.2s" },
  { left: "81%", top: "22%", size: 2, opacity: 0.22, duration: "6.9s", delay: "2.2s" },
  { left: "87%", top: "54%", size: 1, opacity: 0.12, duration: "6.2s", delay: "1.6s" },
  { left: "92%", top: "14%", size: 1, opacity: 0.14, duration: "5.7s", delay: "0.6s" },
  { left: "8%", top: "78%", size: 1, opacity: 0.11, duration: "6.5s", delay: "1.9s" },
  { left: "15%", top: "67%", size: 2, opacity: 0.12, duration: "7.4s", delay: "2.6s" },
  { left: "24%", top: "83%", size: 1, opacity: 0.09, duration: "5.5s", delay: "0.7s" },
  { left: "32%", top: "88%", size: 2, opacity: 0.13, duration: "6.7s", delay: "1.5s" },
  { left: "44%", top: "82%", size: 1, opacity: 0.1, duration: "7s", delay: "2.4s" },
  { left: "56%", top: "78%", size: 1, opacity: 0.08, duration: "5.3s", delay: "0.4s" },
  { left: "66%", top: "86%", size: 2, opacity: 0.12, duration: "6.3s", delay: "1.3s" },
  { left: "78%", top: "76%", size: 1, opacity: 0.11, duration: "6.8s", delay: "2s" },
  { left: "89%", top: "84%", size: 2, opacity: 0.14, duration: "7.5s", delay: "2.8s" },
  { left: "13%", top: "4%", size: 1, opacity: 0.13, duration: "5.6s", delay: "0.1s" },
  { left: "27%", top: "6%", size: 1, opacity: 0.14, duration: "6.4s", delay: "1.1s" },
  { left: "39%", top: "3%", size: 2, opacity: 0.17, duration: "7.2s", delay: "2.2s" },
  { left: "52%", top: "6%", size: 1, opacity: 0.12, duration: "5.8s", delay: "0.9s" },
  { left: "71%", top: "5%", size: 1, opacity: 0.15, duration: "6.1s", delay: "1.8s" },
  { left: "84%", top: "7%", size: 2, opacity: 0.2, duration: "7s", delay: "2.7s" },
];

export function StarsBackground({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(92,61,134,0.2),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(245,213,71,0.06),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(79,209,197,0.05),transparent_16%)]" />
      {STAR_POINTS.map((star, index) => (
        <span
          key={`star-${index}`}
          className="absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationName: "aureaStarTwinkle",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
            animationDuration: star.duration,
            animationDelay: star.delay,
            boxShadow:
              index % 6 === 0
                ? "0 0 8px rgba(245,213,71,0.12)"
                : "0 0 6px rgba(255,255,255,0.12)",
          }}
        />
      ))}

      <style>{`
        @keyframes aureaStarTwinkle {
          0%,
          100% {
            opacity: 0.08;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.34;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}
