export type FriendState = "none" | "outgoing_pending" | "incoming_pending" | "friends";

export type FriendStateShape = {
  is_friend?: boolean;
  friend_state?: string | null;
  friend_request_id?: number | null;
};

export function getFriendState(value: FriendStateShape | null | undefined): FriendState {
  if (!value) return "none";
  if (value.is_friend || value.friend_state === "friends") return "friends";
  if (value.friend_state === "outgoing_pending") return "outgoing_pending";
  if (value.friend_state === "incoming_pending") return "incoming_pending";
  return "none";
}
