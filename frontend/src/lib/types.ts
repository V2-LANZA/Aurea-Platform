// src/lib/types.ts

export type RiskInfo = {
    flagged?: boolean;
    score?: number;
    reasons?: string[];
  };
  
  export type ChatMessage = {
    // used by ReportDialog + UI
    id?: string | number | null;
  
    // used by UI everywhere
    from: string;
    text: string;
  
    // some parts of your UI use msg.ts
    // some places might use created_at
    ts?: string | number | Date | null;
    created_at?: string | null;
  
    // risk flagging
    risk?: RiskInfo | null;
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
  
    // optional scoring fields if your backend returns them
    risk_score?: number | null;
    risk_reasons?: string[] | null;
  
    // sometimes you store message_id
    message_id?: string | number | null;
  };
  