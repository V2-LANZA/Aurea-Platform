"use client";

import type { ChatMessage } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function MessageBubble({
  msg,
  isMe,
  onReport,
}: {
  msg: ChatMessage;
  isMe: boolean;
  onReport?: (m: ChatMessage) => void;
}) {
  const isBot = msg.messageType === "bot" || msg.messageType === "system" || msg.isBot;
  const displayName = isMe ? "You" : isBot ? "Aurea Safety Bot" : msg.displayName || msg.from;
  const handle = isBot ? "@aurea_bot" : `@${msg.from}`;
  const text = isBot ? msg.text.replace(/^Aurea (Safety )?Bot:\s*/i, "").trim() : msg.text;

  return (
    <div className={`rounded-2xl border p-3 ${isMe ? "border-[#7c5bb8]/30 bg-[#38264C]/88 text-[#F8F5FF]" : isBot ? "border-[#F5D547]/20 bg-[#2A1E3E]/88 text-[#F8F5FF]" : "border-white/10 bg-white/6 text-[#F8F5FF]"}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-[#D8CFF0]">{displayName}</div>
          {!isMe ? <div className="text-[11px] text-[#B8A9D6]">{handle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          {isBot && <Badge variant="outline">Safety Bot</Badge>}

          {!isMe && onReport && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-xl"
              onClick={() => onReport(msg)}
            >
              Report
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 whitespace-pre-wrap text-sm">{text}</div>
    </div>
  );
}
