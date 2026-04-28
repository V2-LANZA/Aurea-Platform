export type ChatMessage = {
  id?: string | number | null;
  groupId?: number | null;
  userId?: number | null;
  from: string;
  displayName?: string | null;
  text: string;
  ts?: string | number | Date | null;
  created_at?: string | null;
  messageType?: string;
  isBot?: boolean;
  isHidden?: boolean;
  mutedUserId?: number | null;
};

export type User = {
  id?: string | number;
  username: string;
};

export type AlertItem = {
  id?: string | number;
  created_at?: string | null;
  message_text?: string | null;
  against_user?: string | null;
  reason?: string | null;
  risk_score?: number | null;
  risk_reasons?: string[] | null;
  message_id?: string | number | null;
};
