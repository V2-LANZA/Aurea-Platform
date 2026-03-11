"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isAuthed } from "@/lib/auth";
import { api } from "@/lib/api";
import { buildChatWsUrl } from "@/lib/ws";
import type { ChatMessage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ Read group from URL: /chat?group=123
  const initialGroup = searchParams.get("group") ?? "2";

  const [groupId, setGroupId] = useState(initialGroup);
  const [status, setStatus] = useState<"closed" | "open">("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  const wsUrl = useMemo(() => buildChatWsUrl(groupId), [groupId]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // ✅ If URL changes (user clicks another group link), update groupId
  useEffect(() => {
    const g = searchParams.get("group");
    if (g && g !== groupId) {
      setGroupId(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthed()) router.push("/login");
  }, [router]);

  // auto disconnect on group change
  useEffect(() => {
    disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  function connect() {
    if (ws && status === "open") return;

    try {
      const sock = new WebSocket(wsUrl);

      sock.onopen = () => {
        setStatus("open");
        setMessages((m) => [
          ...m,
          { from: "system", text: `Connected to ${wsUrl}` },
        ]);
      };

      sock.onclose = () => {
        setStatus("closed");
        setWs(null);
      };

      sock.onerror = () => {
        setMessages((m) => [
          ...m,
          { from: "system", text: "WebSocket error (check backend + URL)" },
        ]);
      };

      sock.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);

          // Accept multiple backend shapes:
          // { from, text, risk_score, risk_reasons }
          // { sender, message, flagged, score, reasons }
          const msg: ChatMessage = {
            id: data.id ?? data.message_id ?? undefined,
            from: data.from ?? data.sender ?? "unknown",
            text: data.text ?? data.message ?? String(ev.data),
            created_at: data.created_at ?? undefined,
            risk: {
              flagged: !!(
                data.flagged ??
                data.risky ??
                (typeof data.risk_score === "number" && data.risk_score > 0)
              ),
              score: data.score ?? data.risk_score ?? undefined,
              reasons: data.reasons ?? data.risk_reasons ?? undefined,
            },
          };

          setMessages((m) => [...m, msg]);
        } catch {
          setMessages((m) => [...m, { from: "server", text: ev.data }]);
        }
      };

      setWs(sock);
    } catch {
      setMessages((m) => [...m, { from: "system", text: "Could not connect" }]);
    }
  }

  function disconnect() {
    try {
      ws?.close();
    } catch {}
    setWs(null);
    setStatus("closed");
  }

  function send() {
    if (!ws || status !== "open") return;
    if (!text.trim()) return;

    ws.send(JSON.stringify({ text: text.trim() }));
    setText("");
  }

  // Optional: allow reporting message -> POST /alerts
  async function reportMessage(msg: ChatMessage) {
    try {
      await api.post("/alerts", {
        group_id: Number(groupId),
        message_text: msg.text,
        against_user: msg.from,
        message_id: msg.id ?? null,
        reason: "User reported a risky message",
      });
      toast.success("Reported. Alert submitted.");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Could not submit alert.");
    }
  }

  return (
    <AppShell>
      <div className="grid gap-6 py-6">
        <Card className="rounded-3xl border-black/5 bg-white/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#0B132B]">Live Chat</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="text-sm text-[#3A506B]">Group ID</div>
                <Input
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-28 rounded-2xl"
                />
              </div>

              <div className="text-sm text-[#3A506B]">
                Status:{" "}
                <span
                  className={
                    status === "open" ? "text-emerald-600" : "text-zinc-500"
                  }
                >
                  {status}
                </span>
              </div>

              {status !== "open" ? (
                <Button
                  onClick={connect}
                  className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
                >
                  Connect
                </Button>
              ) : (
                <Button
                  onClick={disconnect}
                  variant="outline"
                  className="rounded-2xl"
                >
                  Disconnect
                </Button>
              )}
            </div>

            <div className="rounded-3xl border border-black/5 bg-white p-3">
              <div className="h-[420px] overflow-auto space-y-2 p-2">
                {messages.map((m, idx) => (
                  <div key={`${m.id ?? "x"}-${idx}`} className="text-sm">
                    <div className="flex items-start gap-2">
                      <div className="min-w-[80px] font-medium text-[#1C2541]">
                        {m.from}
                      </div>

                      <div className="flex-1">
                        <div className="text-[#0B132B] whitespace-pre-wrap">
                          {m.text}
                        </div>

                        {m.risk?.flagged && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-[#6FFFE9]/30 px-3 py-1 text-xs text-[#0B132B]">
                              flagged
                              {typeof m.risk.score === "number" && (
                                <span className="opacity-80">
                                  score {m.risk.score}
                                </span>
                              )}
                              {m.risk.reasons?.length ? (
                                <span className="opacity-80">
                                  {m.risk.reasons.join(", ")}
                                </span>
                              ) : null}
                            </div>

                            <Button
                              variant="outline"
                              className="h-7 rounded-full px-3 text-xs"
                              onClick={() => reportMessage(m)}
                            >
                              Report
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type message..."
                  className="rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                />
                <Button
                  onClick={send}
                  className="rounded-2xl bg-[#5BC0BE] text-[#0B132B] hover:bg-[#6FFFE9]"
                >
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-black/5 bg-white/60 backdrop-blur">
          <CardContent className="py-4 text-sm text-[#3A506B]">
            If connect fails: your backend WebSocket path might be different.
            Update it in <code className="px-1">src/lib/ws.ts</code>.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}