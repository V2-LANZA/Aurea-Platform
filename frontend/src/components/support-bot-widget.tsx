"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onOpenSafetyHelp } from "@/lib/safety-help";

type BotMessage = { who: string; text: string };
type QuickAction = { id: string; label: string; value: string };

const MAIN_OPTIONS: QuickAction[] = [
  { id: "main-report", label: "Report someone", value: "report" },
  { id: "main-unsafe", label: "I feel unsafe now", value: "unsafe" },
  { id: "main-warning-signs", label: "Check warning signs", value: "warning-signs" },
  { id: "main-privacy", label: "Privacy or photo request", value: "privacy" },
];

const MENU_OPTIONS: Record<string, QuickAction[]> = {
  main: MAIN_OPTIONS,
  report: [
    { id: "report-direct", label: "Report someone", value: "report" },
    { id: "report-signs", label: "Safety warning signs", value: "warning-signs" },
    { id: "report-restart", label: "Restart help", value: "main" },
  ],
  unsafe: [
    { id: "unsafe-emergency", label: "Emergency advice", value: "emergency-advice" },
    { id: "unsafe-trusted-adult", label: "Tell a trusted adult", value: "trusted-adult" },
    { id: "unsafe-back-main", label: "Back to main menu", value: "main" },
  ],
  "warning-signs": [
    { id: "warning-location", label: "Asking for location", value: "warning-location" },
    { id: "warning-photos", label: "Asking for photos", value: "warning-photos" },
    { id: "warning-secrets", label: "Asking to keep secrets", value: "warning-secrets" },
    { id: "warning-meet", label: "Wants to meet", value: "warning-meet" },
    { id: "warning-bullying", label: "Bullying/threats", value: "warning-bullying" },
    { id: "warning-back-main", label: "Back to main menu", value: "main" },
  ],
  privacy: [
    { id: "privacy-location", label: "Asking for location", value: "warning-location" },
    { id: "privacy-photos", label: "Asking for photos", value: "warning-photos" },
    { id: "privacy-back-main", label: "Back to main menu", value: "main" },
  ],
  grooming: [
    { id: "grooming-location", label: "Someone asked for my location", value: "warning-location" },
    { id: "grooming-photos", label: "Someone asked for private photos", value: "warning-photos" },
    { id: "grooming-secret", label: "Someone asked me to keep a secret", value: "warning-secrets" },
    { id: "grooming-restart", label: "Restart help", value: "main" },
  ],
  "self-harm": [
    { id: "self-harm-immediate", label: "I am in immediate danger", value: "emergency-advice" },
    { id: "self-harm-trusted-adult", label: "Talk to a trusted adult", value: "trusted-adult" },
    { id: "self-harm-restart", label: "Restart help", value: "main" },
  ],
  emergency: [
    { id: "emergency-call", label: "Call emergency help", value: "emergency-advice" },
    { id: "emergency-report", label: "Report someone", value: "report" },
    { id: "emergency-restart", label: "Restart help", value: "main" },
  ],
  location: [
    { id: "location-report", label: "Report someone", value: "report" },
    { id: "location-privacy", label: "Privacy or photo request", value: "privacy" },
    { id: "location-restart", label: "Restart help", value: "main" },
  ],
  photos: [
    { id: "photos-report", label: "Report someone", value: "report" },
    { id: "photos-trusted-adult", label: "Talk to trusted adult", value: "trusted-adult" },
    { id: "photos-restart", label: "Restart help", value: "main" },
  ],
  secrecy: [
    { id: "secrecy-signs", label: "Check warning signs", value: "warning-signs" },
    { id: "secrecy-report", label: "Report someone", value: "report" },
    { id: "secrecy-restart", label: "Restart help", value: "main" },
  ],
  bullying: [
    { id: "bullying-report", label: "Report someone", value: "report" },
    { id: "bullying-mute", label: "Mute someone", value: "mute-someone" },
    { id: "bullying-restart", label: "Restart help", value: "main" },
  ],
  fallback: [
    { id: "fallback-report", label: "Report someone", value: "report" },
    { id: "fallback-emergency", label: "Emergency help", value: "unsafe" },
    { id: "fallback-warning-signs", label: "Check warning signs", value: "warning-signs" },
    { id: "fallback-privacy", label: "Privacy or photo request", value: "privacy" },
    { id: "fallback-restart", label: "Restart help", value: "main" },
  ],
};

function initialMessages(): BotMessage[] {
  return [{ who: "Aurea Safety Help", text: "Hi, I’m Aurea Safety Help. What do you need help with?" }];
}

function getReply(key: string): { text: string; menu: string } {
  switch (key) {
    case "report":
      return {
        text: "You can report someone from their profile or from the safety options. Try to keep the chat history and avoid replying alone if the message feels unsafe.",
        menu: "report",
      };
    case "report-include":
      return {
        text: "Include what happened, why it felt unsafe, and any details that could help a moderator understand the context.",
        menu: "report",
      };
    case "unsafe":
      return {
        text: "If you are in immediate danger, contact emergency services now or speak to a trusted adult immediately.",
        menu: "unsafe",
      };
    case "emergency-advice":
      return {
        text: "Move to a safer place if you can and contact emergency services now. In the UK, call 999 or 112 if you are in immediate danger.",
        menu: "emergency",
      };
    case "trusted-adult":
      return {
        text: "Tell a trusted adult, teacher, parent, carer, or moderator what happened and show them the chat if you can.",
        menu: "self-harm",
      };
    case "warning-signs":
      return {
        text: "Which warning sign are you worried about?",
        menu: "warning-signs",
      };
    case "privacy":
      return {
        text: "What kind of request are you worried about?",
        menu: "privacy",
      };
    case "warning-location":
      return {
        text: "Do not share your address, school, or live location. Save the messages and report the user if it felt unsafe.",
        menu: "location",
      };
    case "warning-photos":
      return {
        text: "Do not send private images if you feel unsure, pressured, or uncomfortable. You can stop replying, report the user, mute them, or speak to a trusted adult.",
        menu: "photos",
      };
    case "warning-secrets":
      return {
        text: "Be careful if someone asks you to hide a conversation. Safe people should not pressure you to keep risky chats secret.",
        menu: "secrecy",
      };
    case "warning-meet":
      return {
        text: "Do not agree to meet alone. Keep the messages and tell a trusted adult or moderator right away.",
        menu: "warning-signs",
      };
    case "warning-bullying":
      return {
        text: "You do not need to keep replying. Save the messages, report the behaviour, and tell a trusted adult or moderator.",
        menu: "warning-signs",
      };
    case "mute-someone":
      return {
        text: "You can mute someone from their profile or from the group safety options so their messages are hidden behind a placeholder.",
        menu: "bullying",
      };
    case "self-harm":
      return {
        text: "I’m really sorry you’re feeling this way. You are not in trouble. If you might hurt yourself now, call emergency services immediately or tell someone nearby. In the UK, you can call 999 or 112 for emergency help. You can also call Samaritans on 116 123, or Childline on 0800 1111 if you are under 19.",
        menu: "self-harm",
      };
    case "emergency":
      return {
        text: "If you are in immediate danger, call emergency services now. In the UK, call 999 or 112. Move to a safer place if you can and tell a trusted adult or moderator.",
        menu: "emergency",
      };
    case "location":
      return {
        text: "Be careful with personal information. Do not share your address, school, live location, phone number, or other details that can identify where you are.",
        menu: "location",
      };
    case "secrecy":
      return {
        text: "Be careful if someone asks you to hide a conversation. Safe people should not pressure you to keep risky chats secret.",
        menu: "secrecy",
      };
    case "bullying":
      return {
        text: "You do not have to reply to hurtful or threatening messages. You can mute the person, report them, leave the group, or ask a trusted adult or moderator for help.",
        menu: "bullying",
      };
    case "grooming":
      return {
        text: "Warning signs can include secrecy, pressure to move to another app, asking for private photos, asking for your location, or trying to meet alone.",
        menu: "grooming",
      };
    case "photos":
      return {
        text: "Do not send private images if you feel unsure, pressured, or uncomfortable. You can stop replying, report the user, mute them, or speak to a trusted adult.",
        menu: "photos",
      };
    case "fallback":
      return {
        text: "I’m not fully sure what you mean, but I can help with reporting someone, emergency help, grooming warning signs, photo/location pressure, or muting someone.",
        menu: "fallback",
      };
    case "main":
      return {
        text: "Hi, I’m Aurea Safety Help. What do you need help with?",
        menu: "main",
      };
    default:
      return getReply("fallback");
  }
}

function getReplyFromText(text: string): { text: string; menu: string } {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return getReply("fallback");
  if (/^(help|help:)$/.test(normalized)) return getReply("fallback");

  if (
    /(suicide|kill myself|want to die|hurt myself|self harm|self-harm|end my life|do not want to live|don't want to live|want to disappear|i want to disappear)/.test(
      normalized,
    )
  ) {
    return getReply("self-harm");
  }
  if (
    /(danger|emergency|unsafe now|scared|help now|someone is threatening me|i am in danger|i'm in danger)/.test(
      normalized,
    )
  ) {
    return getReply("emergency");
  }
  if (
    /(report|report someone|report user|someone is bothering me|someone is harassing me|someone is threatening me)/.test(
      normalized,
    )
  ) {
    return getReply("report");
  }
  if (
    /(grooming|warning signs|older person|secrecy|private chat|move app|meet alone)/.test(
      normalized,
    )
  ) {
    return getReply("grooming");
  }
  if (
    /(photo|photos|pics|pictures|nudes|private image|send image)/.test(normalized)
  ) {
    return getReply("photos");
  }
  if (
    /(address|location|live location|school|where do you live|postcode|phone number|age)/.test(
      normalized,
    )
  ) {
    return getReply("location");
  }
  if (
    /(secret|don't tell|dont tell|keep this between us|hide this|parents|mum|dad)/.test(
      normalized,
    )
  ) {
    return getReply("secrecy");
  }
  if (
    /(bullying|bully|harassment|insulting|hate|racism|rude|threatening)/.test(
      normalized,
    )
  ) {
    return getReply("bullying");
  }
  return getReply("fallback");
}

export function SupportBotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<BotMessage[]>(initialMessages);
  const [menu, setMenu] = useState("main");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, menu]);

  useEffect(() => onOpenSafetyHelp(() => setOpen(true)), []);

  function pushConversation(userText: string | null, replyText: string, nextMenu: string) {
    setMessages((prev) => [
      ...prev,
      ...(userText ? [{ who: "You", text: userText }] : []),
      { who: "Aurea Safety Help", text: replyText },
    ]);
    setMenu(nextMenu);
    setInput("");
  }

  function handleAction(value: string, label?: string) {
    const next = getReply(value);
    pushConversation(label ?? null, next.text, next.menu);
  }

  function handleSend() {
    const value = input.trim();
    if (!value) return;
    const next = getReplyFromText(value);
    pushConversation(value, next.text, next.menu);
  }

  function resetConversation() {
    setMessages(initialMessages());
    setMenu("main");
    setInput("");
  }

  const visibleOptions = MENU_OPTIONS[menu] || MENU_OPTIONS.main;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[min(92vw,380px)] rounded-[28px] border border-white/10 bg-[#120E16]/95 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-[#F5D547]">Safety help</div>
              <div className="mt-1 text-lg font-semibold text-[#FCF8F6]">Aurea Safety Help</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetConversation}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#d2bfd0]"
              >
                Restart help
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#d2bfd0]"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex max-h-[70vh] flex-col">
            <div ref={scrollRef} className="grid gap-3 overflow-y-auto px-4 py-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.who}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.who === "You"
                      ? "ml-8 bg-[#453750] text-[#FCF8F6]"
                      : "mr-8 bg-white/5 text-[#e8def8]"
                  }`}
                >
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-[#B8A9D6]">
                    {message.who}
                  </div>
                  <div className="whitespace-pre-wrap">{message.text}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              <div className="mb-3 flex flex-wrap gap-2">
                {visibleOptions.slice(0, 6).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleAction(option.value, option.label)}
                    className="rounded-full border border-[#F5D547]/20 bg-[#F5D547]/10 px-3 py-2 text-xs text-[#FCF8F6] transition hover:bg-[#F5D547]/18"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask for safety help"
                  className="rounded-2xl border-white/10 bg-[#140f25] text-white placeholder:text-[#AFA2C9]"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSend();
                  }}
                />
                <Button
                  onClick={handleSend}
                  className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full bg-[#F5D547] px-5 text-[#0C0910] shadow-[0_0_30px_rgba(245,213,71,0.3)] hover:bg-[#edd031]"
      >
        Safety Help
      </Button>
    </div>
  );
}
