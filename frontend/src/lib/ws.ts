import { getToken } from "./auth";

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE || "ws://127.0.0.1:8000";

export function buildChatWsUrl(groupId: string | number) {
  const token = getToken();
  const base = WS_BASE.replace(/^http/, "ws");
  const url = new URL(`${base}/ws/chat/${groupId}`);

  if (token) {
    url.searchParams.set("token", token);
  }

  return url.toString();
}