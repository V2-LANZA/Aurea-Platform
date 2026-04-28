"use client";

import type { ReactNode } from "react";

type AdminSurfaceVariant = "dashboard" | "moderation" | "reports" | "users" | "groups" | "alerts";

const SURFACE_MAP: Record<
  AdminSurfaceVariant,
  {
    base: string;
    blobs: { className: string; background: string; animationDuration: string }[];
  }
> = {
  dashboard: {
    base:
      "radial-gradient(circle_at_16%_18%,rgba(111,71,156,0.34),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(245,213,71,0.2),transparent_24%),radial-gradient(circle_at_50%_82%,rgba(188,146,255,0.16),transparent_28%),linear-gradient(180deg,rgba(25,13,42,0.9),rgba(10,8,18,0.97))",
    blobs: [
      { className: "left-[-7rem] top-8 h-[24rem] w-[24rem]", background: "rgba(159,110,230,0.28)", animationDuration: "24s" },
      { className: "right-[-6rem] top-24 h-[26rem] w-[26rem]", background: "rgba(245,213,71,0.2)", animationDuration: "30s" },
      { className: "bottom-[-10rem] left-[26%] h-[30rem] w-[30rem]", background: "rgba(111,71,156,0.22)", animationDuration: "34s" },
    ],
  },
  moderation: {
    base:
      "radial-gradient(circle_at_18%_18%,rgba(38,103,126,0.26),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(79,209,197,0.22),transparent_22%),radial-gradient(circle_at_68%_72%,rgba(128,104,205,0.16),transparent_30%),linear-gradient(180deg,rgba(8,18,35,0.92),rgba(8,11,22,0.98))",
    blobs: [
      { className: "left-[-8rem] top-8 h-[25rem] w-[25rem]", background: "rgba(53,138,163,0.26)", animationDuration: "22s" },
      { className: "right-[-5rem] top-28 h-[24rem] w-[24rem]", background: "rgba(79,209,197,0.24)", animationDuration: "28s" },
      { className: "bottom-[-10rem] left-[22%] h-[30rem] w-[30rem]", background: "rgba(54,87,150,0.18)", animationDuration: "34s" },
      { className: "bottom-[-9rem] right-[8%] h-[22rem] w-[22rem]", background: "rgba(141,108,224,0.14)", animationDuration: "38s" },
    ],
  },
  reports: {
    base:
      "radial-gradient(circle_at_18%_18%,rgba(101,55,84,0.26),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(79,209,197,0.2),transparent_22%),radial-gradient(circle_at_62%_78%,rgba(245,213,71,0.16),transparent_26%),linear-gradient(180deg,rgba(28,14,24,0.92),rgba(9,12,22,0.98))",
    blobs: [
      { className: "left-[-7rem] top-12 h-[24rem] w-[24rem]", background: "rgba(111,53,96,0.22)", animationDuration: "23s" },
      { className: "right-[-5rem] top-24 h-[26rem] w-[26rem]", background: "rgba(79,209,197,0.24)", animationDuration: "29s" },
      { className: "bottom-[-9rem] left-[34%] h-[28rem] w-[28rem]", background: "rgba(245,213,71,0.18)", animationDuration: "33s" },
      { className: "top-[42%] right-[24%] h-[18rem] w-[18rem]", background: "rgba(66,155,165,0.12)", animationDuration: "37s" },
    ],
  },
  users: {
    base:
      "radial-gradient(circle_at_18%_16%,rgba(67,117,145,0.22),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(176,149,237,0.18),transparent_24%),linear-gradient(180deg,rgba(14,18,34,0.92),rgba(11,10,19,0.98))",
    blobs: [
      { className: "left-[-8rem] top-14 h-[23rem] w-[23rem]", background: "rgba(74,152,170,0.22)", animationDuration: "24s" },
      { className: "right-[-7rem] top-32 h-[25rem] w-[25rem]", background: "rgba(176,149,237,0.2)", animationDuration: "31s" },
      { className: "bottom-[-8rem] left-[34%] h-[25rem] w-[25rem]", background: "rgba(92,83,163,0.18)", animationDuration: "35s" },
    ],
  },
  groups: {
    base:
      "radial-gradient(circle_at_18%_16%,rgba(99,42,68,0.24),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(245,213,71,0.18),transparent_22%),radial-gradient(circle_at_72%_72%,rgba(79,209,197,0.16),transparent_24%),linear-gradient(180deg,rgba(30,13,26,0.92),rgba(11,10,19,0.98))",
    blobs: [
      { className: "left-[-7rem] top-18 h-[24rem] w-[24rem]", background: "rgba(117,49,80,0.22)", animationDuration: "25s" },
      { className: "right-[-5rem] top-26 h-[25rem] w-[25rem]", background: "rgba(245,213,71,0.2)", animationDuration: "29s" },
      { className: "bottom-[-9rem] left-[28%] h-[27rem] w-[27rem]", background: "rgba(79,209,197,0.18)", animationDuration: "35s" },
    ],
  },
  alerts: {
    base:
      "radial-gradient(circle_at_18%_14%,rgba(110,30,52,0.28),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(245,213,71,0.16),transparent_22%),radial-gradient(circle_at_74%_70%,rgba(79,209,197,0.1),transparent_26%),linear-gradient(180deg,rgba(33,8,18,0.94),rgba(12,8,15,0.99))",
    blobs: [
      { className: "left-[-7rem] top-12 h-[24rem] w-[24rem]", background: "rgba(154,36,70,0.22)", animationDuration: "23s" },
      { className: "right-[-5rem] top-24 h-[24rem] w-[24rem]", background: "rgba(245,213,71,0.18)", animationDuration: "29s" },
      { className: "bottom-[-8rem] left-[30%] h-[26rem] w-[26rem]", background: "rgba(204,92,92,0.16)", animationDuration: "33s" },
      { className: "bottom-[-9rem] right-[10%] h-[20rem] w-[20rem]", background: "rgba(79,209,197,0.1)", animationDuration: "37s" },
    ],
  },
};

export function AdminSurface({
  variant,
  children,
}: {
  variant: AdminSurfaceVariant;
  children: ReactNode;
}) {
  const theme = SURFACE_MAP[variant];

  return (
    <div className={`admin-page-transition admin-theme-${variant} relative overflow-hidden rounded-[38px]`}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: theme.base }}
        aria-hidden="true"
      />
      {theme.blobs.map((blob, index) => (
        <div
          key={`${variant}-blob-${index}`}
          className={`admin-ambient-blob pointer-events-none absolute rounded-full ${blob.className}`}
          style={{ background: blob.background, animationDuration: blob.animationDuration }}
          aria-hidden="true"
        />
      ))}
      <div className="admin-content-shell admin-content-enter relative z-10">
        {children}
      </div>
    </div>
  );
}
