"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Action = {
  label: string;
  onClick: () => void;
};

export function AureaInterventionCard({
  title,
  message,
  primaryActions,
  secondaryActions = [],
}: {
  title?: string;
  message: string;
  primaryActions: Action[];
  secondaryActions?: Action[];
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="aurea-pop rounded-[24px] border border-[#F5D547]/22 bg-[linear-gradient(150deg,rgba(245,213,71,0.06),rgba(92,61,134,0.08)),linear-gradient(150deg,rgba(36,17,63,0.96),rgba(16,11,28,0.98))] p-4 shadow-[0_16px_56px_rgba(0,0,0,0.24)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#F5D547]/30 bg-[#F5D547]/12 text-xs font-semibold text-[#F5D547]">
          AB
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.24em] text-[#F5D547]">Aurea Bot</div>
          <div className="mt-1 text-base font-semibold text-[#FCF8F6]">
            {title || "Aurea Bot noticed a safety risk"}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#E7E0F8]">{message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {primaryActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="outline"
                className="rounded-full border-white/12 bg-white/7 text-[#FCF8F6] hover:bg-white/12"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
            {secondaryActions.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full border-[#F5D547]/20 bg-[#F5D547]/10 text-[#FCF8F6] hover:bg-[#F5D547]/16"
                onClick={() => setShowMore((value) => !value)}
              >
                {showMore ? "Fewer options" : "More options"}
              </Button>
            ) : null}
          </div>
          {showMore && secondaryActions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {secondaryActions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/5 text-[#D8CFF0] hover:bg-white/10"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
