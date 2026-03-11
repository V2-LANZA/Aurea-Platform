"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ChatMessage, User } from "@/lib/types";
import ChatSidebar from "./chat-sidebar";
import ChatWindow from "./chat-window";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export default function ChatLayout() {
  const params = useParams<{ username?: string }>();
  const router = useRouter();
  const peer = params?.username ? String(params.username) : null;

  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<User[]>("/users");
        setUsers(res.data);
      } catch {
        toast.error("Could not load users (check backend + CORS).");
      }
    })();
  }, []);

  useEffect(() => {
    if (!peer) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    (async () => {
      try {
        const res = await api.get<ChatMessage[]>("/messages", { params: { with: peer } });
        setHistory(res.data);
      } catch {
        toast.error("Could not load message history.");
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [peer]);

  const title = useMemo(() => (peer ? `Chat with ${peer}` : "Select a user"), [peer]);

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-4 lg:col-span-3">
        <ChatSidebar
          users={users}
          selected={peer}
          onSelect={(u) => router.push(`/chat/${u}`)}
        />
      </div>

      <div className="col-span-8 lg:col-span-9">
        <Card className="h-[75vh] p-0 overflow-hidden mystic-glow bg-white/75 backdrop-blur">
          <ChatWindow
            title={title}
            peer={peer}
            initialMessages={history}
            loadingHistory={loadingHistory}
          />
        </Card>
      </div>
    </div>
  );
}
