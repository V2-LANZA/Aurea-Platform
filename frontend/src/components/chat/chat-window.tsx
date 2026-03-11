"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/hooks/use-me";
import { useWsChat } from "@/hooks/use-ws-chat";
import type { ChatMessage } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MessageBubble from "./message-bubble";
import ReportDialog from "./report-dialog";

export default function ChatWindow({
  title,
  peer,
  initialMessages,
  loadingHistory,
}: {
  title: string;
  peer: string | null;
  initialMessages: ChatMessage[];
  loadingHistory: boolean;
}) {
  const { username } = useMe();
  const { state, messages, setMessages, send } = useWsChat(peer ?? "");
  const [text, setText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<ChatMessage | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialMessages ?? []);
  }, [initialMessages, setMessages, peer]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canChat = !!peer;

  const statusBadge = useMemo(() => {
    const map: Record<string, { label: string; variant: any }> = {
      open: { label: "Live", variant: "default" },
      connecting: { label: "Connecting", variant: "secondary" },
      closed: { label: "Offline", variant: "outline" },
      error: { label: "Error", variant: "destructive" },
    };
    const v = map[state] ?? map.connecting;
    return <Badge variant={v.variant}>{v.label}</Badge>;
  }, [state]);

  function onSend() {
    const t = text.trim();
    if (!t || !canChat) return;
    const ok = send(t);
    if (ok) setText("");
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white/60 backdrop-blur p-4 flex items-center justify-between">
        <div className="font-medium">{title}</div>
        {peer && statusBadge}
      </div>

      <ScrollArea className="flex-1 p-4">
        {loadingHistory && (
          <div className="text-sm text-muted-foreground">Loading history…</div>
        )}

        <div className="space-y-3">
          {messages.map((m, idx) => (
            <MessageBubble
              key={`${m.ts}-${idx}`}
              msg={m}
              isMe={m.from === username}
              onReport={(msg) => {
                setReportMsg(msg);
                setReportOpen(true);
              }}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t bg-white/60 backdrop-blur p-3 flex gap-2">
        <Input
          disabled={!canChat}
          placeholder={canChat ? "Type a message…" : "Select a user first"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
        />
        <Button className="mystic-glow" disabled={!canChat} onClick={onSend}>
          Send
        </Button>
      </div>

      <ReportDialog
        open={reportOpen}
        msg={reportMsg}
        onClose={() => {
          setReportOpen(false);
          setReportMsg(null);
        }}
      />
    </div>
  );
}
