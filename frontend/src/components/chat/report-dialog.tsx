"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAureaBotNotice } from "@/components/aurea-bot-notice-provider";
import type { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const REPORT_REASONS = [
  "Unsafe or inappropriate message",
  "Asking for personal information",
  "Asking for photos",
  "Asking to keep secrets",
  "Bullying or harassment",
  "Other",
] as const;

type Props = {
  open: boolean;
  msg: ChatMessage | null;
  reportedUserId?: number | null;
  groupId?: number | null;
  onClose: () => void;
};

export default function ReportDialog({
  open,
  msg,
  reportedUserId,
  groupId,
  onClose,
}: Props) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>(
    REPORT_REASONS[0]
  );
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const { showNotice } = useAureaBotNotice();

  useEffect(() => {
    if (!open) {
      setReason(REPORT_REASONS[0]);
      setDetails("");
      setLoading(false);
    }
  }, [open]);

  if (!open || !reportedUserId || !groupId) return null;
  const activeMessage = msg;

  async function submit() {
    setLoading(true);
    try {
      await api.post("/reports", {
        reported_user_id: reportedUserId,
        group_id: groupId,
        message_id: activeMessage?.id ?? null,
        reason,
        details: details.trim() || null,
      });
      showNotice({
        message: "Report submitted. Our moderation tools have logged this and the review workflow has been updated.",
      });
      onClose();
    } catch (error: unknown) {
      const typedError = error as { response?: { data?: { detail?: string } } };
      toast.error(typedError?.response?.data?.detail || "Could not submit report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#140f1c]/60 p-4 backdrop-blur-sm">
      <Card className="aurea-panel w-full max-w-xl rounded-[28px] shadow-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-[#FCF8F6]">Report User</CardTitle>
          <p className="text-sm text-[#D8CFF0]">
            If this message feels unsafe, choose the best reason and add anything helpful for the moderation team.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeMessage ? (
            <div className="aurea-panel-soft rounded-2xl p-4 text-sm leading-6 text-[#F8F5FF]">
              {activeMessage.text}
            </div>
          ) : (
            <div className="aurea-panel-soft rounded-2xl p-4 text-sm leading-6 text-[#D8CFF0]">
              You are reporting this user from their profile. Add the reason and any helpful details for moderators.
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium text-[#F8F5FF]">Reason</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {REPORT_REASONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReason(option)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    reason === option
                      ? "border-[#5c3d86] bg-[#5c3d86] text-white"
                      : "border-white/12 bg-white/6 text-[#F8F5FF] hover:bg-white/10"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#F8F5FF]">Add more details</label>
            <Textarea
              placeholder="Optional details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-28 rounded-2xl border-white/12 bg-white/8 text-[#FCF8F6] placeholder:text-[#B8A9D6]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="aurea-button-ghost rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={loading}
              className="rounded-2xl bg-[#5c3d86] text-white hover:bg-[#4f3473]"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
