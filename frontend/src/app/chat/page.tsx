"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAureaBotNotice } from "@/components/aurea-bot-notice-provider";
import { AvatarBadge } from "@/components/avatar-badge";
import { AureaInterventionCard } from "@/components/chat/aurea-intervention-card";
import ReportDialog from "@/components/chat/report-dialog";
import { ActionModal } from "@/components/ui/action-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import { api } from "@/lib/api";
import { isAdmin, isAuthed } from "@/lib/auth";
import { openSafetyHelp } from "@/lib/safety-help";
import { buildChatWsUrl } from "@/lib/ws";
import { toast } from "sonner";

type GroupMember = {
  id: number;
  username: string;
  full_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
  is_friend?: boolean;
};

type Group = {
  id: number;
  name: string;
  invite_code: string;
  created_by_id?: number;
  is_suspended?: boolean;
  suspension_reason?: string | null;
  member_count?: number | null;
  member_preview?: GroupMember[];
};

type ChatLine = {
  id?: number | null;
  userId?: number | null;
  username: string;
  fullName?: string | null;
  pronouns?: string | null;
  avatarUrl?: string | null;
  senderIsSuspended?: boolean;
  senderIsAvailable?: boolean;
  text: string;
  createdAt?: string | null;
  type?: string;
  isBot?: boolean;
};

type Me = {
  id: number;
  username: string;
  role?: string;
};

type UserMute = {
  muted_user_id: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  const typedError = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = typedError?.response?.data?.detail;

  if (typeof detail === "string") return detail;
  return typedError?.message || fallback;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toLine(item: Record<string, unknown>): ChatLine {
  const type =
    typeof item.message_type === "string"
      ? item.message_type
      : typeof item.type === "string"
        ? item.type
        : "message";
  const isBot = type === "bot" || type === "system" || item.is_bot === true;
  const username = isBot ? "__aurea_bot__" : String(item.username || "unknown");
  const fullName =
    isBot
      ? typeof item.full_name === "string"
        ? item.full_name
        : "Aurea Safety Bot"
      : typeof item.full_name === "string"
        ? item.full_name
        : null;
  return {
    id: typeof item.id === "number" ? item.id : null,
    userId: typeof item.user_id === "number" ? item.user_id : null,
    username,
    fullName,
    pronouns: typeof item.pronouns === "string" ? item.pronouns : null,
    avatarUrl: typeof item.avatar_url === "string" ? item.avatar_url : null,
    senderIsSuspended: Boolean(item.sender_is_suspended),
    senderIsAvailable: item.sender_is_available !== false,
    text: String(item.content || item.detail || ""),
    createdAt: typeof item.created_at === "string" ? item.created_at : null,
    type,
    isBot,
  };
}

function isHiddenForViewer(line: ChatLine, mutedUserIds: Set<number>) {
  if (!line.userId) return false;
  if (line.type === "bot" || line.type === "system" || line.username === "__aurea_bot__") return false;
  return mutedUserIds.has(line.userId);
}

function normalizeBotText(text: string) {
  return text.replace(/^Aurea (Safety )?Bot:\s*/i, "").trim();
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get("group");

  const [decorReady, setDecorReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    initialGroupId ? Number(initialGroupId) : null
  );
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "reconnecting" | "error">("disconnected");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [message, setMessage] = useState("");
  const [mutedUserIds, setMutedUserIds] = useState<number[]>([]);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [updatingGroupState, setUpdatingGroupState] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [revealedMutedMessageIds, setRevealedMutedMessageIds] = useState<number[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ userId: number | null; messageId?: number | null } | null>(null);
  const [isRestrictedInGroup, setIsRestrictedInGroup] = useState(false);
  const { showNotice } = useAureaBotNotice();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const manualCloseRef = useRef(false);
  const activeGroupRef = useRef<number | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDecorReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthed()) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      try {
        const [meRes, groupsRes] = await Promise.all([api.get("/users/me"), api.get("/groups")]);
        setMe(meRes.data);
        const nextGroups = Array.isArray(groupsRes.data) ? (groupsRes.data as Group[]) : [];
        setGroups(nextGroups);

        if (initialGroupId) {
          const parsed = Number(initialGroupId);
          if (nextGroups.some((group) => group.id === parsed)) {
            setSelectedGroupId(parsed);
          } else {
            setSelectedGroupId(null);
            router.replace("/chat");
          }
        }
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Could not load chat"));
      } finally {
        setGroupsLoaded(true);
      }
    })();
  }, [initialGroupId, router]);

  useEffect(() => {
    activeGroupRef.current = selectedGroupId;
  }, [selectedGroupId]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [lines, mutedUserIds]);

  const mutedUserIdSet = useMemo(() => new Set(mutedUserIds), [mutedUserIds]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );
  const canDeleteSelectedGroup = Boolean(
    selectedGroup &&
      me &&
      (me.role === "admin" || selectedGroup.created_by_id === me.id)
  );

  function clearSocket(preserveStatus = false) {
    shouldReconnectRef.current = false;
    manualCloseRef.current = true;
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (disconnectTimerRef.current) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (!preserveStatus) {
      setStatus("disconnected");
    }
  }

  async function loadMutedUsers(groupId: number) {
    try {
      const response = await api.get(`/groups/${groupId}/mutes`);
      const data = Array.isArray(response.data) ? (response.data as UserMute[]) : [];
      setMutedUserIds(data.map((item) => item.muted_user_id));
    } catch {
      setMutedUserIds([]);
    }
  }

  async function loadGroupMembers(groupId: number) {
    try {
      const response = await api.get(`/groups/${groupId}/members`);
      const data = Array.isArray(response.data) ? (response.data as GroupMember[]) : [];
      setGroupMembers(data);
    } catch {
      setGroupMembers([]);
    }
  }

  async function loadRestrictionStatus(groupId: number, userId: number) {
    try {
      const response = await api.get(`/groups/${groupId}/restrictions/${userId}`);
      setIsRestrictedInGroup(Boolean(response.data?.restricted));
    } catch {
      setIsRestrictedInGroup(false);
    }
  }

  async function loadHistory(groupId: number) {
    setChatLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/messages`);
      const data = Array.isArray(response.data) ? response.data : [];
      setLines(data.map((item) => toLine(item as Record<string, unknown>)));
      await api.post(`/groups/${groupId}/read`);
    } catch (error: unknown) {
      setLines([]);
      toast.error(getErrorMessage(error, "Could not load messages"));
    } finally {
      setChatLoading(false);
    }
  }

  function connect(groupId: number) {
    if (wsRef.current) {
      const currentState = wsRef.current.readyState;
      if (
        activeGroupRef.current === groupId &&
        (currentState === WebSocket.OPEN || currentState === WebSocket.CONNECTING)
      ) {
        return;
      }
    }
    clearSocket(true);
    shouldReconnectRef.current = true;
    manualCloseRef.current = false;
    if (disconnectTimerRef.current) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    setStatus((prev) => (prev === "connected" || prev === "reconnecting" ? "reconnecting" : "connecting"));

    const ws = new WebSocket(buildChatWsUrl(groupId));
    wsRef.current = ws;

    ws.onopen = () => {
      if (disconnectTimerRef.current) {
        window.clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>;
        const line = toLine(payload);
        if (payload.type === "system") {
          const detail = typeof payload.detail === "string" ? payload.detail : line.text;
          if (
            selectedGroupId &&
            me?.id &&
            /(paused while moderators review|restricted from sending messages in this group)/i.test(detail)
          ) {
            void loadRestrictionStatus(selectedGroupId, me.id);
          }
          showNotice({
            message: line.text || "Connection update",
          });
          return;
        }
        setLines((prev) => [...prev, line]);
        void api.post(`/groups/${groupId}/read`).catch(() => undefined);
      } catch {
        toast.error("Received an invalid chat event");
      }
    };

    ws.onclose = (event) => {
      const stillActive = activeGroupRef.current === groupId;
      if (manualCloseRef.current && !stillActive) return;
      if (
        shouldReconnectRef.current &&
        stillActive &&
        event.code !== 4401 &&
        event.code !== 4403
      ) {
        setStatus("reconnecting");
        reconnectTimerRef.current = window.setTimeout(() => connect(groupId), 1200);
        return;
      }
      disconnectTimerRef.current = window.setTimeout(() => {
        setStatus("disconnected");
      }, 2200);
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }

  useEffect(() => {
    if (!groupsLoaded) return;

    if (!selectedGroupId) {
      clearSocket();
      setLines([]);
      setMutedUserIds([]);
      setIsRestrictedInGroup(false);
      return;
    }

    if (!selectedGroup) {
      setStatus("connecting");
      return;
    }

    router.replace(`/chat?group=${selectedGroupId}`);
    void loadHistory(selectedGroupId);
    void loadMutedUsers(selectedGroupId);
    void loadGroupMembers(selectedGroupId);
    connect(selectedGroupId);

    return () => {
      clearSocket(true);
    };
  }, [groupsLoaded, router, selectedGroup, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId || !me?.id || !groupsLoaded) return;
    void loadRestrictionStatus(selectedGroupId, me.id);
  }, [groupsLoaded, me?.id, selectedGroupId]);

  async function unmuteUser(userId: number, username: string) {
    if (!selectedGroupId) return;

    setBusyUserId(userId);
    try {
      await api.delete(`/groups/${selectedGroupId}/mutes/${userId}`);
      setMutedUserIds((prev) => prev.filter((value) => value !== userId));
      showNotice({
        message: `You unmuted @${username} in this group. Their messages will appear normally again.`,
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update mute"));
    } finally {
      setBusyUserId(null);
    }
  }

  async function muteUser(userId: number, username: string) {
    if (!selectedGroupId) return;
    setBusyUserId(userId);
    try {
      await api.post(`/groups/${selectedGroupId}/mutes`, {
        muted_user_id: userId,
      });
      setMutedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      showNotice({
        message: `You muted @${username} in this group. Their messages will stay behind a placeholder.`,
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update mute"));
    } finally {
      setBusyUserId(null);
    }
  }

  async function leaveGroup() {
    if (!selectedGroupId) return;
    setLeavingGroup(true);
    try {
      await api.delete(`/groups/${selectedGroupId}/leave`);
      setGroups((prev) => prev.filter((group) => group.id !== selectedGroupId));
      setSelectedGroupId(null);
      setLeaveConfirmOpen(false);
      showNotice({
        message: "You left this group. You will no longer receive new messages from it.",
      });
      router.push("/groups");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not leave group"));
    } finally {
      setLeavingGroup(false);
    }
  }

  async function deleteGroup() {
    if (!selectedGroupId) return;
    setDeletingGroup(true);
    try {
      await api.delete(`/groups/${selectedGroupId}`);
      setGroups((prev) => prev.filter((group) => group.id !== selectedGroupId));
      setSelectedGroupId(null);
      setDeleteConfirmOpen(false);
      showNotice({
        message: "This group was deleted. It has been removed from your chat list.",
      });
      router.push("/groups");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not delete group"));
    } finally {
      setDeletingGroup(false);
    }
  }

  async function toggleSelectedGroupSuspension() {
    if (!selectedGroupId || !selectedGroup) return;
    setUpdatingGroupState(true);
    setGroups((prev) =>
      prev.map((group) =>
        group.id === selectedGroupId
          ? {
              ...group,
              is_suspended: !selectedGroup.is_suspended,
              suspension_reason: selectedGroup.is_suspended ? null : selectedGroup.suspension_reason || "Suspended by admin",
            }
          : group
      )
    );
    try {
      if (selectedGroup.is_suspended) {
        await api.patch(`/admin/groups/${selectedGroupId}/unsuspend`);
        toast.success("Group unsuspended.");
      } else {
        await api.patch(`/admin/groups/${selectedGroupId}/suspend`, {
          reason: "Suspended by admin",
        });
        toast.success("Group suspended.");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not update group"));
      const response = await api.get("/groups");
      setGroups(Array.isArray(response.data) ? (response.data as Group[]) : []);
    } finally {
      setUpdatingGroupState(false);
    }
  }

  function openReportForLine(line: ChatLine) {
    setReportTarget({ userId: line.userId ?? null, messageId: line.id ?? null });
    setReportOpen(true);
  }

  function sendMessage() {
    if (!selectedGroupId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showNotice({ message: "Aurea Bot: Chat is not connected right now. Please wait a moment and try again." });
      return;
    }
    if (selectedGroup?.is_suspended) {
      showNotice({ message: "Aurea Bot: This group has been suspended by an admin. Messages are disabled." });
      return;
    }
    if (isRestrictedInGroup) {
      showNotice({
        message:
          "Aurea Bot: Your sending access in this group has been paused while moderators review recent messages.",
      });
      return;
    }
    if (!message.trim()) return;

    setSending(true);
    wsRef.current.send(JSON.stringify({ content: message.trim() }));
    setMessage("");
    window.setTimeout(() => setSending(false), 350);
  }

  const latestIntervention = useMemo(() => {
    const botIndex = [...lines]
      .map((line, index) => ({ line, index }))
      .reverse()
      .find(({ line }) => line.type === "bot" || line.username === "__aurea_bot__");
    if (!botIndex) return null;
    const previousLine = [...lines]
      .slice(0, botIndex.index)
      .reverse()
      .find((line) => line.type !== "bot" && line.type !== "system" && line.username !== "__aurea_bot__");
    return {
      line: botIndex.line,
      target: previousLine ?? null,
    };
  }, [lines]);

  const latestInterventionTargetsCurrentUser = Boolean(
    me &&
      latestIntervention?.target?.userId &&
      latestIntervention.target.userId === me.id
  );

  const shouldShowInteractiveBotCard = Boolean(
    latestIntervention && !latestInterventionTargetsCurrentUser
  );

  const primaryInterventionActions = useMemo(() => {
    const target = latestIntervention?.target;
    const actions: { label: string; onClick: () => void }[] = [];
    if (
      target?.userId &&
      target.username &&
      selectedGroupId &&
      (!me || target.userId !== me.id)
    ) {
      actions.push({ label: "Report user", onClick: () => openReportForLine(target) });
      actions.push({ label: "Mute user", onClick: () => setMemberPanelOpen(true) });
    }
    actions.push({ label: "Safety help", onClick: openSafetyHelp });
    return actions.slice(0, 3);
  }, [latestIntervention, me, selectedGroupId]);

  const secondaryInterventionActions = useMemo(() => {
    const actions: { label: string; onClick: () => void }[] = [];
    actions.push({ label: "View members", onClick: () => setMemberPanelOpen(true) });
    actions.push({ label: "Leave chat", onClick: () => setLeaveConfirmOpen(true) });
    actions.push({
      label: "Tell a trusted adult",
      onClick: () =>
        showNotice({
          title: "Tell a trusted adult",
          message:
            "You are not overreacting. Show the conversation to a parent, carer, teacher, moderator, or another trusted adult as soon as you can.",
        }),
    });
    return actions;
  }, [showNotice]);

  return (
    <AppShell>
      <div className="relative overflow-hidden">
        {decorReady ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,8,21,0.78),rgba(14,10,24,0.88))]" />
            <StarsBackground className="z-[1] opacity-70" />
            <ShootingStars className="z-[2] opacity-55" />
            <div className="absolute inset-0 z-[3] bg-[radial-gradient(circle_at_top,rgba(18,13,34,0.18),transparent_28%),radial-gradient(circle_at_50%_18%,rgba(67,45,105,0.12),transparent_24%),linear-gradient(180deg,rgba(8,7,15,0.14),rgba(9,8,17,0.22))]" />
          </div>
        ) : null}

        <div className="aurea-page relative z-10 mx-auto w-full max-w-[1560px] px-4 py-8 sm:px-5 md:px-6">
          <div className="mb-6">
            <Link href="/groups" className="aurea-link text-sm font-medium">
              ← Back to Groups
            </Link>
          </div>

          <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1.52fr)_270px]">
          <aside className="aurea-panel rounded-[32px] p-4">
            <div className="px-3 pb-4 pt-2">
              <div className="text-sm uppercase tracking-[0.22em] text-[#B8A9D6]">Your groups</div>
              <div className="mt-2 text-2xl font-semibold text-[#FCF8F6]">Open a group chat</div>
            </div>

            {groups.length === 0 ? (
              <div className="aurea-panel-soft rounded-[24px] p-6">
                <div className="text-xl font-semibold text-[#FCF8F6]">No groups yet</div>
                <div className="mt-2 text-sm leading-6 text-[#D8CFF0]">
                  Create or join a group first, then come back here to chat.
                </div>
                <div className="mt-4">
                  <Button asChild className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]">
                    <Link href="/groups">Go to Groups</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {groups.map((group) => {
                  const active = group.id === selectedGroupId;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${
                        active
                          ? "border-[#B9929F]/45 bg-white/12 shadow-[0_10px_35px_rgba(0,0,0,0.18)]"
                          : "border-white/10 bg-white/5 hover:bg-white/8"
                      }`}
                      aria-pressed={active}
                    >
                      <div className="text-lg font-semibold text-[#FCF8F6]">{group.name}</div>
                      <div className="mt-1 text-sm text-[#D8CFF0]">
                        {group.member_count || 0} members
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="grid gap-5">
            {!selectedGroup ? (
              <Card className="aurea-panel rounded-[32px]">
                <CardContent className="grid min-h-[540px] place-items-center p-10 text-center">
                  <div className="max-w-xl">
                    <div className="text-3xl font-semibold text-[#FCF8F6]">Select a group to start chatting.</div>
                    <p className="mt-3 text-base leading-8 text-[#D8CFF0]">
                      Your conversations will appear here after you open a group.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="aurea-panel aurea-fade-up rounded-[32px]">
                  <CardContent className="relative flex h-[calc(100vh-12.5rem)] min-h-[760px] min-w-0 flex-col overflow-hidden p-0">
                      <div className="shrink-0 border-b border-white/10 bg-[#120b24]/94 px-5 py-4 backdrop-blur-xl">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-3xl font-semibold text-[#FCF8F6]">{selectedGroup.name}</div>
                            <div className="mt-1 text-sm text-[#D8CFF0]">
                              Invite code: <span className="font-mono text-[#F5D547]">{selectedGroup.invite_code}</span>
                              {selectedGroup.member_count ? ` · ${selectedGroup.member_count} members` : ""}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <div className="aurea-badge-soft rounded-full px-4 py-2 text-sm font-medium">
                              {status === "connected"
                                ? "Connected"
                                : status === "connecting"
                                  ? "Connecting..."
                                  : status === "reconnecting"
                                    ? "Reconnecting..."
                                    : status === "error"
                                      ? "Connection error"
                                      : "Disconnected"}
                            </div>
                            <Button
                              variant="outline"
                              className="aurea-button-ghost rounded-2xl"
                              onClick={() => {
                                if (selectedGroupId) {
                                  void loadHistory(selectedGroupId);
                                  void loadMutedUsers(selectedGroupId);
                                  if (me?.id) {
                                    void loadRestrictionStatus(selectedGroupId, me.id);
                                  }
                                  connect(selectedGroupId);
                                }
                              }}
                            >
                              Refresh Chat
                            </Button>
                          </div>
                        </div>
                      </div>

                      {selectedGroup.is_suspended ? (
                        <div className="border-b border-red-400/20 bg-red-500/12 px-5 py-4 text-sm text-red-100">
                          This group has been suspended by an admin. Messages are disabled.
                          {selectedGroup.suspension_reason ? ` Reason: ${selectedGroup.suspension_reason}` : ""}
                        </div>
                      ) : null}
                      {isRestrictedInGroup ? (
                        <div className="border-b border-[#f5d547]/20 bg-[#f5d547]/10 px-5 py-4 text-sm text-[#f8e8a0]">
                          Aurea Bot: Your sending access in this group has been paused while moderators review recent messages.
                          <div className="mt-1 text-xs text-[#e5d8ff]">
                            You can still view the chat, but you cannot send new messages here until the review is resolved or the pause expires.
                          </div>
                        </div>
                      ) : null}
                      <div
                        ref={messagesRef}
                        className="min-h-0 flex-1 overflow-y-auto px-5 pt-8"
                        style={{ scrollPaddingBottom: "7rem" }}
                      >
                        <div className="space-y-3 pb-8">
                        {chatLoading ? (
                          <div className="grid gap-3">
                            <div className="h-20 animate-pulse rounded-[24px] bg-white/6" />
                            <div className="h-24 animate-pulse rounded-[24px] bg-white/5" />
                            <div className="h-16 animate-pulse rounded-[24px] bg-white/6" />
                          </div>
                        ) : lines.length === 0 ? (
                          <div className="aurea-panel-soft rounded-[24px] border border-dashed p-6 text-sm leading-7 text-[#D8CFF0]">
                            This group has no messages yet.
                          </div>
                        ) : (
                          lines.map((line, index) => {
                            const isMe = Boolean(me && line.userId === me.id);
                            const hidden = isHiddenForViewer(line, mutedUserIdSet);
                            const isBot = line.type === "bot" || line.username === "__aurea_bot__";
                            const isLatestBotCard =
                              isBot && latestIntervention?.line.id === line.id && latestIntervention?.line.createdAt === line.createdAt;
                            const shouldHideBotFromRiskySender =
                              isLatestBotCard && latestInterventionTargetsCurrentUser;

                            if (hidden) {
                              const revealed = Boolean(line.id && revealedMutedMessageIds.includes(line.id));
                              if (revealed) {
                                return (
                                  <div
                                    key={`${line.id ?? index}-revealed`}
                                    className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4"
                                  >
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <Link
                                        href={`/profile/${line.username}?group=${selectedGroupId}`}
                                        className="text-sm font-semibold text-[#E7DAFF] hover:text-[#F5D547]"
                                      >
                                        {line.fullName || line.username}
                                      </Link>
                                      <div className="flex flex-wrap gap-2">
                                        <Button
                                          variant="outline"
                                          className="aurea-button-ghost rounded-2xl"
                                          onClick={() =>
                                            setRevealedMutedMessageIds((prev) => prev.filter((id) => id !== line.id))
                                          }
                                        >
                                          Hide again
                                        </Button>
                                        <Button
                                          variant="outline"
                                          disabled={busyUserId === line.userId}
                                          className="aurea-button-ghost rounded-2xl"
                                          onClick={() => void unmuteUser(line.userId!, line.username)}
                                        >
                                          {busyUserId === line.userId ? "Saving..." : "Unmute"}
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="whitespace-pre-wrap text-[15px] leading-6 text-[#F8F5FF]">
                                      {line.text}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={`${line.id ?? index}-hidden`}
                                  className="aurea-panel-soft rounded-[22px] px-4 py-3 text-sm text-[#D8CFF0]"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <div className="font-medium text-[#F8F5FF]">Muted user</div>
                                      <div>Message from muted user hidden.</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="outline"
                                        className="aurea-button-ghost rounded-2xl"
                                        onClick={() => {
                                          if (line.id) {
                                            setRevealedMutedMessageIds((prev) => [...prev, line.id!]);
                                          }
                                        }}
                                      >
                                        Show message
                                      </Button>
                                      <Button
                                        variant="outline"
                                        disabled={busyUserId === line.userId}
                                        className="aurea-button-ghost rounded-2xl"
                                        onClick={() => void unmuteUser(line.userId!, line.username)}
                                      >
                                        {busyUserId === line.userId ? "Saving..." : "Unmute user"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (shouldHideBotFromRiskySender) {
                              return null;
                            }

                            return (
                              <div
                                key={`${line.id ?? index}-${line.createdAt ?? ""}`}
                                className={`aurea-fade-up rounded-[22px] border px-4 py-3.5 ${
                                  isBot
                                    ? "border-[#F5D547]/18 bg-[#2A1E3E]/84"
                                    : isMe
                                      ? "border-[#B9929F]/26 bg-[#38264C]/88"
                                      : "border-white/10 bg-white/5"
                                }`}
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div className="flex items-center gap-3">
                                    {isMe || isBot ? (
                                      <AvatarBadge
                                        name={line.fullName || line.username}
                                        avatarUrl={line.avatarUrl || null}
                                        size="sm"
                                      />
                                    ) : (
                                      <Link href={`/profile/${line.username}?group=${selectedGroupId}`}>
                                        <AvatarBadge
                                          name={line.fullName || line.username}
                                          avatarUrl={line.avatarUrl || null}
                                          size="sm"
                                        />
                                      </Link>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        {isMe || isBot ? (
                                          <span className="text-left text-sm font-semibold text-[#FCF8F6]">
                                            {isMe ? "You" : line.fullName || line.username}
                                          </span>
                                        ) : (
                                          <Link
                                            href={`/profile/${line.username}?group=${selectedGroupId}`}
                                            className="text-left text-sm font-semibold text-[#E7DAFF] hover:text-[#F5D547]"
                                          >
                                            {line.fullName || line.username}
                                          </Link>
                                        )}
                                        {isBot ? (
                                          <span className="rounded-full border border-[#F5D547]/18 bg-[#F5D547]/10 px-3 py-1 text-xs font-medium text-[#F5D547]">
                                            Safety Bot
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className="text-xs text-[#B8A9D6]">
                                        {isBot ? "@aurea_bot" : `@${line.username}`}
                                        {line.pronouns ? ` · ${line.pronouns}` : ""}
                                        {line.createdAt ? ` · ${formatTime(line.createdAt)}` : ""}
                                      </div>
                                    </div>
                                  </div>

                                </div>

                                <div className="mt-3">
                                  {isBot && isLatestBotCard ? (
                                    shouldShowInteractiveBotCard ? (
                                      <AureaInterventionCard
                                        title="Aurea Bot noticed a safety risk"
                                        message={normalizeBotText(line.text) || "This conversation may be becoming unsafe. You do not have to reply."}
                                        primaryActions={primaryInterventionActions}
                                        secondaryActions={secondaryInterventionActions}
                                      />
                                    ) : (
                                      <div className="rounded-[18px] border border-[#F5D547]/14 bg-[#20162f]/80 px-4 py-3 text-sm leading-6 text-[#E7E0F8]">
                                        {normalizeBotText(line.text)}
                                      </div>
                                    )
                                  ) : isBot ? (
                                    <div className="rounded-[18px] border border-[#F5D547]/14 bg-[#20162f]/80 px-4 py-3 text-sm leading-6 text-[#E7E0F8]">
                                      {normalizeBotText(line.text)}
                                    </div>
                                  ) : (
                                    <div className="whitespace-pre-wrap text-[15px] leading-6.5 text-[#F8F5FF]">
                                      {line.text}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                        </div>
                      </div>

                      <div className="relative shrink-0 border-t border-white/10 bg-[#120b24]/92 px-5 py-4 backdrop-blur-xl">
                        <div className="flex gap-3">
                          <Input
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") sendMessage();
                            }}
                            placeholder={
                              selectedGroup.is_suspended
                                ? "Messages are disabled in this suspended group"
                                : isRestrictedInGroup
                                  ? "Sending paused while moderators review this group"
                                : "Type your message"
                            }
                            disabled={Boolean(selectedGroup.is_suspended) || isRestrictedInGroup}
                            className="rounded-2xl border-white/12 bg-[#140f25] text-[#FCF8F6] placeholder:text-[#B8A9D6]"
                          />
                          <Button
                            className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]"
                            disabled={Boolean(selectedGroup.is_suspended) || isRestrictedInGroup || sending}
                            onClick={sendMessage}
                          >
                            {sending ? "Sending..." : "Send"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
              </>
            )}
          </div>

          {selectedGroup ? (
            <div className="grid gap-5">
              <Card className="aurea-panel aurea-fade-up rounded-[32px]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B8A9D6]">
                        Group preview
                      </div>
                      <div className="mt-2 text-xl font-semibold text-[#FCF8F6]">
                        {selectedGroup.member_count || groupMembers.length} members
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="aurea-button-ghost rounded-2xl"
                      onClick={() => setMemberPanelOpen(true)}
                    >
                      View members
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {(groupMembers.length > 0 ? groupMembers : selectedGroup.member_preview || []).slice(0, 5).map((member) => (
                      <Link
                        key={member.id}
                        href={`/profile/${member.username}?group=${selectedGroupId}`}
                        className="aurea-panel-soft flex items-center gap-3 rounded-[20px] px-4 py-3"
                      >
                        <AvatarBadge
                          name={member.full_name || member.username}
                          avatarUrl={member.avatar_url || null}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-semibold text-[#FCF8F6]">
                            {member.full_name || member.username}
                          </div>
                          <div className="text-xs text-[#B8A9D6]">
                            @{member.username}
                            {member.pronouns ? ` · ${member.pronouns}` : ""}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="aurea-panel aurea-fade-up rounded-[32px]">
                <CardContent className="p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B8A9D6]">
                    Group actions
                  </div>
                  <div className="mt-4 grid gap-3">
                    <Button
                      variant="outline"
                      className="aurea-button-ghost rounded-2xl justify-start"
                      onClick={openSafetyHelp}
                    >
                      Open Safety Help
                    </Button>
                    <Button
                      variant="outline"
                      className="aurea-button-ghost rounded-2xl justify-start"
                      onClick={() => setMemberPanelOpen(true)}
                    >
                      Mute or unmute people
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl justify-start border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/18"
                      onClick={() => setLeaveConfirmOpen(true)}
                    >
                      Leave Group
                    </Button>
                    {canDeleteSelectedGroup ? (
                      <Button
                        variant="outline"
                        className="rounded-2xl justify-start border-red-500/40 bg-red-600/16 text-red-50 hover:bg-red-600/24"
                        onClick={() => setDeleteConfirmOpen(true)}
                      >
                        Delete Group
                      </Button>
                    ) : null}
                    {isAdmin() ? (
                      <>
                        <Button
                          variant="outline"
                          disabled={updatingGroupState}
                          className={`rounded-2xl justify-start ${
                            selectedGroup.is_suspended
                              ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18"
                              : "border-red-400/30 bg-red-500/12 text-red-100 hover:bg-red-500/18"
                          }`}
                          onClick={() => void toggleSelectedGroupSuspension()}
                        >
                          {updatingGroupState
                            ? "Updating..."
                            : selectedGroup.is_suspended
                              ? "Unsuspend"
                              : "Suspend"}
                        </Button>
                        <Button asChild variant="outline" className="aurea-button-ghost rounded-2xl justify-start">
                          <Link href="/admin/moderation">View Moderation</Link>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      <ActionModal
        open={memberPanelOpen}
        title="Mute someone in this group"
        description="Muted messages stay in chat behind a placeholder so you can reveal them if you need to."
        onClose={() => setMemberPanelOpen(false)}
      >
        <div className="grid gap-3">
          {groupMembers.filter((member) => member.id !== me?.id).length === 0 ? (
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-[#D8CFF0]">
              No other members are available in this group.
            </div>
          ) : (
            groupMembers
              .filter((member) => member.id !== me?.id)
              .map((member) => {
                const isMuted = mutedUserIdSet.has(member.id);
                return (
                  <div
                    key={member.id}
                    className="aurea-panel-soft flex items-center justify-between gap-3 rounded-[22px] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBadge
                        name={member.full_name || member.username}
                        avatarUrl={member.avatar_url || null}
                        size="sm"
                      />
                      <div>
                        <div className="text-sm font-semibold text-[#FCF8F6]">
                          {member.full_name || member.username}
                        </div>
                        <div className="text-xs text-[#B8A9D6]">@{member.username}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={busyUserId === member.id}
                      className={`rounded-full ${
                        isMuted
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-[#5c3d86] text-white hover:bg-[#4f3473]"
                      }`}
                      onClick={() =>
                        isMuted
                          ? void unmuteUser(member.id, member.username)
                          : void muteUser(member.id, member.username)
                      }
                    >
                      {busyUserId === member.id ? "Saving..." : isMuted ? "Unmute" : "Mute"}
                    </Button>
                  </div>
                );
              })
          )}
        </div>
      </ActionModal>

      <ActionModal
        open={leaveConfirmOpen}
        title="Leave this group?"
        description="You will stop seeing new messages from this group and it will disappear from your chat list."
        onClose={() => setLeaveConfirmOpen(false)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="aurea-button-ghost rounded-2xl" onClick={() => setLeaveConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-red-600 text-white hover:bg-red-500"
            disabled={leavingGroup}
            onClick={() => void leaveGroup()}
          >
            {leavingGroup ? "Leaving..." : "Leave Group"}
          </Button>
        </div>
      </ActionModal>

      <ActionModal
        open={deleteConfirmOpen}
        title="Delete this group?"
        description="This cannot be undone. The group, its membership, and its chat history will be removed."
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            className="aurea-button-ghost rounded-2xl"
            onClick={() => setDeleteConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-red-600 text-white hover:bg-red-500"
            disabled={deletingGroup}
            onClick={() => void deleteGroup()}
          >
            {deletingGroup ? "Deleting..." : "Delete Group"}
          </Button>
        </div>
      </ActionModal>

      <ReportDialog
        open={reportOpen}
        msg={
          reportTarget
            ? {
                id: reportTarget.messageId ?? null,
                groupId: selectedGroupId ?? null,
                userId: reportTarget.userId ?? null,
                from: reportTarget.userId ? "user" : "__aurea_bot__",
                text: reportTarget.messageId
                  ? lines.find((line) => line.id === reportTarget.messageId)?.text || ""
                  : "",
              }
            : null
        }
        reportedUserId={reportTarget?.userId ?? null}
        groupId={selectedGroupId}
        onClose={() => {
          setReportOpen(false);
          setReportTarget(null);
        }}
      />
    </AppShell>
  );
}
