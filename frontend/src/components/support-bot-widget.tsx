"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function buildReply(message: string) {
  const text = message.toLowerCase();

  if (/(danger|emergency|help now|unsafe right now|threat)/.test(text)) {
    return "If you are in immediate danger, call your local emergency number now. In the UK call 999, in the US call 911, and move toward a trusted adult, teacher, parent, or another safe public space right away.";
  }

  if (/(report|flag|someone is creepy|groom|predator|unsafe user)/.test(text)) {
    return "You can report a user by opening Alerts or asking an admin to review the message. Save screenshots, keep the chat history, avoid replying alone, and tell a trusted adult or moderator what happened.";
  }

  if (/(block|mute|stop talking)/.test(text)) {
    return "The safest next step is to stop engaging, keep evidence, and report the account. If the behavior feels threatening or sexual, escalate it to an admin immediately.";
  }

  if (/(phone|hotline|number|helpline)/.test(text)) {
    return "If this is urgent, use your local emergency number. For child protection support, contact a trusted adult, school safeguarding lead, or your local child protection helpline. I can also help you decide whether something should be reported.";
  }

  if (/(friend|trust|is this normal|secret)/.test(text)) {
    return "Be cautious if someone asks for secrecy, private photos, your location, or wants to move the conversation away from the group. Those are warning signs worth reporting.";
  }

  return "I can help with urgent safety steps, reporting a user, warning signs of grooming, or where to get help. Try asking: 'how do I report someone?' or 'what number do I call if I am in danger?'";
}

const quickPrompts = [
  "What number do I call if I am in danger?",
  "How do I report a user?",
  "What are grooming warning signs?",
];

export function SupportBotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ who: string; text: string }[]>([
    {
      who: "Aurea Support",
      text: "Need quick safety help? I can answer urgent platform questions and point you toward the right next step.",
    },
  ]);

  const promptButtons = useMemo(() => quickPrompts, []);

  function send(text: string) {
    const value = text.trim();
    if (!value) return;

    setMessages((prev) => [
      ...prev,
      { who: "You", text: value },
      { who: "Aurea Support", text: buildReply(value) },
    ]);
    setInput("");
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[360px] rounded-[28px] border border-white/10 bg-[#120E16]/95 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-[#F5D547]">
                Quick support
              </div>
              <div className="mt-1 text-lg font-semibold text-[#FCF8F6]">
                Aurea Support Bot
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#d2bfd0]"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.who}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.who === "You"
                    ? "bg-[#453750] text-[#FCF8F6]"
                    : "bg-white/5 text-[#d8c8d8]"
                }`}
              >
                <div className="mb-1 text-xs uppercase tracking-[0.18em] text-[#B9929F]">
                  {message.who}
                </div>
                {message.text}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {promptButtons.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => send(prompt)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#e8dde9] transition hover:bg-white/10"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for quick help"
              className="rounded-2xl border-white/10 bg-white/5 text-white"
              onKeyDown={(event) => {
                if (event.key === "Enter") send(input);
              }}
            />
            <Button
              onClick={() => send(input)}
              className="rounded-2xl bg-[#F5D547] text-[#0C0910] hover:bg-[#edd031]"
            >
              Send
            </Button>
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
