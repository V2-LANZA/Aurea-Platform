"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage } from "@/lib/types";
import { buildChatWsUrl } from "@/lib/ws";

type WsState = "connecting" | "open" | "closed" | "error";

export function useWsChat(peer: string) {
  const [state, setState] = useState<WsState>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const url = useMemo(() => buildChatWsUrl(peer), [peer]);

  const connect = useCallback(() => {
    if (!peer) return;

    // Avoid duplicate connections
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setState("open");

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        const msg: ChatMessage = data?.payload ?? data;
        setMessages((prev) => [...prev, msg]);
      } catch {
        // ignore
      }
    };

    ws.onerror = () => setState("error");

    ws.onclose = () => {
      setState("closed");
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = window.setTimeout(() => connect(), 1000);
    };
  }, [peer, url]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "message", text }));
    return true;
  }, []);

  return { state, messages, setMessages, send };
}
