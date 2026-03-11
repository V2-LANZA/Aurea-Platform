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
  const flagged = !!msg.risk?.flagged;
  const score = msg.risk?.score;
  const reasons = msg.risk?.reasons ?? [];

  return (
    <div className={`rounded-2xl border border-black/5 p-3 ${isMe ? "bg-white" : "bg-white/70"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs opacity-70">{isMe ? "You" : msg.from}</div>

        <div className="flex items-center gap-2">
          {flagged && <Badge variant="destructive">Flagged</Badge>}

          {typeof score === "number" && (
            <Badge variant="outline">Risk {score}/100</Badge>
          )}

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

      <div className="mt-2 whitespace-pre-wrap text-sm">{msg.text}</div>

      {reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.slice(0, 3).map((r, i) => (
            <Badge key={i} variant="secondary">
              {r}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
