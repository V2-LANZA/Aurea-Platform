"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type NoticeAction = {
  label: string;
  onClick?: () => void;
};

type NoticeInput = {
  title?: string;
  message: string;
  durationMs?: number;
  actions?: NoticeAction[];
};

type Notice = NoticeInput & {
  id: string;
};

type AureaBotNoticeContextValue = {
  showNotice: (notice: NoticeInput) => void;
  clearNotices: () => void;
};

const AureaBotNoticeContext = createContext<AureaBotNoticeContextValue | null>(null);

export function useAureaBotNotice() {
  const value = useContext(AureaBotNoticeContext);
  if (!value) {
    throw new Error("useAureaBotNotice must be used within AureaBotNoticeProvider");
  }
  return value;
}

export function AureaBotNoticeProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Notice[]>([]);
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismissActive = useCallback(() => {
    setActiveNotice(null);
  }, []);

  const showNotice = useCallback((notice: NoticeInput) => {
    setQueue((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: notice.title || "Aurea Bot",
        message: notice.message,
        durationMs: notice.durationMs ?? 15000,
        actions: notice.actions || [],
      },
    ]);
  }, []);

  const clearNotices = useCallback(() => {
    setQueue([]);
    setActiveNotice(null);
  }, []);

  useEffect(() => {
    if (activeNotice || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActiveNotice(next);
    setQueue(rest);
  }, [activeNotice, queue]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!activeNotice) return;
    timerRef.current = window.setTimeout(() => {
      setActiveNotice(null);
    }, activeNotice.durationMs ?? 15000);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [activeNotice]);

  const value = useMemo(
    () => ({
      showNotice,
      clearNotices,
    }),
    [showNotice, clearNotices]
  );

  return (
    <AureaBotNoticeContext.Provider value={value}>
      {children}
      {activeNotice ? (
        <div className="pointer-events-none fixed bottom-5 left-5 z-[80] w-[min(92vw,430px)]">
          <div className="pointer-events-auto rounded-[30px] border border-white/12 bg-[linear-gradient(145deg,rgba(29,19,49,0.94),rgba(13,9,25,0.96))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F5D547]/25 bg-[#F5D547]/12 text-sm font-semibold text-[#F5D547] shadow-[0_0_24px_rgba(245,213,71,0.18)]">
                AB
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#F5D547]">Assistant Notice</div>
                    <div className="mt-1 text-lg font-semibold text-[#FCF8F6]">{activeNotice.title}</div>
                  </div>
                  <button
                    type="button"
                    onClick={dismissActive}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#D8CFF0] transition hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#E7E0F8]">{activeNotice.message}</p>
                {activeNotice.actions && activeNotice.actions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeNotice.actions.map((action) => (
                      <Button
                        key={action.label}
                        size="sm"
                        className="rounded-full bg-[#5c3d86] text-white hover:bg-[#4f3473]"
                        onClick={() => {
                          action.onClick?.();
                          dismissActive();
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AureaBotNoticeContext.Provider>
  );
}
