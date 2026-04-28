"use client";

import { cn } from "@/lib/utils";

const SHOOTING_PATHS = [
  { top: "8%", left: "88%", delay: "0s", duration: "13s", length: 220, opacity: 0.46 },
  { top: "18%", left: "102%", delay: "3.5s", duration: "15s", length: 240, opacity: 0.38 },
  { top: "28%", left: "94%", delay: "7.2s", duration: "14s", length: 210, opacity: 0.34 },
  { top: "42%", left: "108%", delay: "11.5s", duration: "16s", length: 260, opacity: 0.32 },
  { top: "56%", left: "96%", delay: "15.8s", duration: "15.5s", length: 230, opacity: 0.3 },
];

export function ShootingStars({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {SHOOTING_PATHS.map((star, index) => (
        <div
          key={`shooting-star-${index}`}
          className="absolute"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.length}px`,
            height: "1px",
            animationName: "aureaShootingStar",
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationDelay: star.delay,
            animationDuration: star.duration,
            transform: "rotate(138deg)",
            opacity: star.opacity,
          }}
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(245,213,71,0.56) 8%, rgba(207,186,255,0.22) 30%, rgba(255,255,255,0) 100%)",
              boxShadow: "0 0 10px rgba(245,213,71,0.08)",
            }}
          />
          <span
            className="absolute left-0 top-1/2 h-[1.5px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "rgba(255,255,255,0.88)",
              boxShadow: "0 0 8px rgba(255,255,255,0.22), 0 0 14px rgba(245,213,71,0.1)",
            }}
          />
        </div>
      ))}

      <style>{`
        @keyframes aureaShootingStar {
          0% {
            transform: translate3d(0, 0, 0) rotate(138deg);
            opacity: 0;
          }
          8% {
            opacity: 0.22;
          }
          20% {
            opacity: 0.48;
          }
          68% {
            opacity: 0.16;
          }
          100% {
            transform: translate3d(-180vw, 120vh, 0) rotate(138deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
