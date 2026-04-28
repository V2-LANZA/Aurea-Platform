"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { buildChatWsUrl } from "@/lib/ws";

type WsState = "connecting" | "open" | "reconnecting" | "closed" | "error";

export function useWsChat(peer: string) {
  const [state, setState] = useState<WsState>(peer ? "connecting" : "closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const disconnectTimer = useRef<number | null>(null);
  const manualCloseRef = useRef(false);

  const url = useMemo(() => buildChatWsUrl(peer), [peer]);

  const connect = useCallback(() => {
    if (!peer) return;

    // Avoid duplicate connections
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    manualCloseRef.current = false;
    if (disconnectTimer.current) {
      window.clearTimeout(disconnectTimer.current);
      disconnectTimer.current = null;
    }
    setState((prev) => (prev === "open" || prev === "reconnecting" ? "reconnecting" : "connecting"));
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setState("open");

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const messageType = data?.message_type ?? data?.type ?? "message";
        const isBot = messageType === "bot" || messageType === "system" || data?.is_bot === true;
        const msg: ChatMessage = {
          id: data?.id ?? null,
          groupId: data?.group_id ?? null,
          userId: data?.user_id ?? null,
          from: isBot ? "__aurea_bot__" : data?.username ?? "unknown",
          displayName: isBot ? data?.full_name ?? "Aurea Safety Bot" : data?.full_name ?? data?.username ?? "unknown",
          text: data?.content ?? "",
          ts: data?.created_at ?? null,
          created_at: data?.created_at ?? null,
          messageType,
          isBot,
        };
        if (messageType === "system") return;
        setMessages((prev) => [...prev, msg]);
      } catch {
        // ignore
      }
    };

    ws.onerror = () => setState("error");

    ws.onclose = () => {
      if (manualCloseRef.current) return;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      setState("reconnecting");
      reconnectTimer.current = window.setTimeout(() => connect(), 1000);
      disconnectTimer.current = window.setTimeout(() => setState("closed"), 2200);
    };
  }, [peer, url]);

  useEffect(() => {
    if (!peer) {
      setMessages([]);
      setState("closed");
      return;
    }
    connect();
    return () => {
      manualCloseRef.current = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      if (disconnectTimer.current) window.clearTimeout(disconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ content: text }));
    return true;
  }, []);

  return { state, messages, setMessages, send };
}
