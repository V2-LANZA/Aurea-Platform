"use client";

import { ReactNode } from "react";

export function ActionModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0f0a18]/68 p-4 backdrop-blur-sm">
      <div className="aurea-pop w-full max-w-lg rounded-[30px] border border-white/12 bg-[linear-gradient(145deg,rgba(29,19,49,0.96),rgba(13,9,25,0.98))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.38)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#FCF8F6]">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-7 text-[#D8CFF0]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#D8CFF0] transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
