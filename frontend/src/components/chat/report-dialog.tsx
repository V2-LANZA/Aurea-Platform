"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Props = {
  open: boolean;
  msg: ChatMessage | null;
  onClose: () => void;
};

export default function ReportDialog({ open, msg, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open || !msg) return null;

  // ✅ make TS happy: after the guard, msg is definitely not null
  const m = msg;

  async function submit() {
    setLoading(true);
    try {
      await api.post("/alerts", {
        message_text: m.text,
        against_user: m.from,
        reason: reason || "User reported a risky message",
        message_id: m.id ?? null,
      });
      toast.success("Reported. Alert submitted.");
      setReason("");
      onClose();
    } catch (e) {
      toast.error("Could not submit alert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Report message</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
            {m.text}
          </div>

          <Textarea
            placeholder="Add context (optional)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
