"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { isAuthed } from "@/lib/auth";
import { buildChatWsUrl } from "@/lib/ws";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarBadge } from "@/components/avatar-badge";
import { toast } from "sonner";

type GroupMember = {
  id: number;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
};

type Group = {
  id: number;
  name: string;
  invite_code: string;
  member_count?: number | null;
  member_preview?: GroupMember[];
};

type HistoryMessage = {
  id: number;
  group_id: number;
  user_id?: number | null;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
  content: string;
  created_at: string;
};

type ChatLine = {
  id?: number | null;
  who: string;
  fullName?: string | null;
  pronouns?: string | null;
  avatarUrl?: string | null;
  text: string;
  createdAt?: string | null;
  type?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = typedError?.response?.data?.detail;

  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === "object" && item !== null && "msg" in item
          ? String(item.msg)
          : JSON.stringify(item)
      )
      .join(", ");
  }
  if (detail && typeof detail === "object" && "msg" in detail) {
    return String(detail.msg);
  }

  return typedError?.message || fallback;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get("group");

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    initialGroupId ? Number(initialGroupId) : null
  );
  const [status, setStatus] = useState("closed");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [message, setMessage] = useState("");

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
    }
  }, [router]);

  const loadGroups = useEffectEvent(async () => {
    try {
      const res = await api.get("/groups");
      const data = Array.isArray(res.data) ? (res.data as Group[]) : [];
      setGroups(data);

      if (!selectedGroupId && data.length > 0) {
        setSelectedGroupId(data[0].id);
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load groups"));
    }
  });

  const loadHistory = useEffectEvent(async (groupId: number) => {
    try {
      const res = await api.get(`/groups/${groupId}/messages`);
      const data = Array.isArray(res.data) ? (res.data as HistoryMessage[]) : [];

      setLines(
        data.map((item) => ({
          id: item.id,
          who: item.username,
          fullName: item.full_name,
          pronouns: item.pronouns,
          avatarUrl: item.avatar_url,
          text: item.content,
          createdAt: item.created_at,
          type: "message",
        }))
      );
    } catch (e: unknown) {
      setLines([]);
      toast.error(getErrorMessage(e, "Could not load messages"));
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGroups();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function disconnect() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("closed");
  }

  const connect = useEffectEvent((groupId: number) => {
    disconnect();

    const url = buildChatWsUrl(groupId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    setStatus("connecting");

    ws.onopen = () => setStatus("open");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data?.type === "system") {
          setLines((prev) => [
            ...prev,
            {
              who: "System",
              text: data?.detail || "Connected",
              type: "system",
            },
          ]);
          return;
        }

        setLines((prev) => [
          ...prev,
          {
            id: data?.id,
            who: data?.username || "message",
            fullName: data?.full_name || null,
            pronouns: data?.pronouns || null,
            avatarUrl: data?.avatar_url || null,
            text: data?.content || "",
            createdAt: data?.created_at || null,
            type: data?.type || "message",
          },
        ]);
      } catch {
        setLines((prev) => [
          ...prev,
          { who: "System", text: String(event.data), type: "system" },
        ]);
      }
    };

    ws.onclose = () => setStatus("closed");

    ws.onerror = () => {
      setStatus("error");
      toast.error("WebSocket error");
    };
  });

  useEffect(() => {
    if (!selectedGroupId) return;

    const timer = window.setTimeout(() => {
      router.replace(`/chat?group=${selectedGroupId}`);
      void loadHistory(selectedGroupId);
      connect(selectedGroupId);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      disconnect();
    };
  }, [router, selectedGroupId]);

  function sendMessage() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("Chat is not connected");
      return;
    }

    if (!message.trim()) return;

    wsRef.current.send(
      JSON.stringify({
        content: message.trim(),
      })
    );

    setMessage("");
  }

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-3xl text-[#FCF8F6]">Live chat</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-6">
              {groups.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <div className="text-xl font-semibold text-[#FCF8F6]">No groups yet</div>
                  <div className="mt-2 text-[#d2bfd0]">
                    Create or join a group first, then come back to chat.
                  </div>
                  <div className="mt-4">
                    <Button
                      asChild
                      className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                    >
                      <Link href="/groups">Go to groups</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <div className="text-sm uppercase tracking-[0.22em] text-[#B9929F]">
                      Active room
                    </div>

                    <select
                      value={selectedGroupId ?? ""}
                      onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                      className="rounded-2xl border border-white/10 bg-[#120E16] px-4 py-3 text-white"
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>

                    {selectedGroup && (
                      <>
                        <div className="text-sm text-[#d2bfd0]">
                          Invite code:{" "}
                          <span className="font-mono text-[#F5D547]">
                            {selectedGroup.invite_code}
                          </span>
                        </div>
                        <div className="text-sm text-[#d2bfd0]">
                          Status: <span className="text-[#FCF8F6]">{status}</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {(selectedGroup.member_preview || []).map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 rounded-full border border-white/10 bg-[#1a1420] px-3 py-2"
                            >
                              <AvatarBadge
                                name={member.full_name || member.username}
                                avatarUrl={member.avatar_url || null}
                                size="sm"
                              />
                              <div className="text-xs text-[#d2bfd0]">
                                <div className="font-medium text-[#FCF8F6]">
                                  {member.full_name || member.username}
                                </div>
                                <div>
                                  @{member.username}
                                  {member.pronouns ? ` · ${member.pronouns}` : ""}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[36px] border-white/10 bg-white/6 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CardContent className="grid gap-4 p-6">
              <div className="min-h-[520px] rounded-[30px] border border-white/10 bg-[#120E16] p-5">
                <div className="grid gap-4">
                  {lines.length === 0 ? (
                    <div className="text-sm text-[#d2bfd0]">
                      No messages yet. Start the conversation.
                    </div>
                  ) : (
                    lines.map((line, index) => {
                      const isBot = line.type === "bot";
                      const isSystem = line.type === "system";
                      const displayName = line.fullName || line.who;

                      if (isSystem) {
                        return (
                          <div
                            key={`${line.id ?? "system"}-${index}`}
                            className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-[#B9929F]"
                          >
                            {line.text}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${line.id ?? "line"}-${index}`}
                          className="flex gap-4 rounded-[26px] border border-white/8 bg-white/5 p-4"
                        >
                          <AvatarBadge
                            name={displayName}
                            avatarUrl={line.avatarUrl || null}
                            size="md"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div
                                className={`font-semibold ${
                                  isBot ? "text-[#F5D547]" : "text-[#FCF8F6]"
                                }`}
                              >
                                {displayName}
                              </div>
                              <div className="text-xs text-[#B9929F]">
                                @{line.who}
                                {line.pronouns ? ` · ${line.pronouns}` : ""}
                              </div>
                              {line.createdAt && (
                                <div className="text-xs text-[#8f7d8f]">
                                  {formatTime(line.createdAt)}
                                </div>
                              )}
                            </div>
                            <div className="mt-2 break-words text-sm leading-7 text-[#e7dfe5]">
                              {line.text}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder='Type message... (try "/help")'
                  className="rounded-2xl border-white/10 bg-white/5 text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                />
                <Button
                  onClick={sendMessage}
                  className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                >
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
