"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import type { User } from "@/lib/types";

export default function ChatSidebar({
  users,
  selected,
  onSelect,
}: {
  users: User[];
  selected: string | null;
  onSelect: (username: string) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => u.username.toLowerCase().includes(s));
  }, [q, users]);

  return (
    <Card className="h-[75vh] mystic-glow bg-white/75 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-base">Users</CardTitle>
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </CardHeader>
      <CardContent className="space-y-1">
        {filtered.map((u) => {
          const active = selected === u.username;
          return (
            <button
              key={u.id}
              onClick={() => onSelect(u.username)}
              className={[
                "w-full text-left rounded-2xl px-3 py-2 text-sm transition",
                active ? "bg-accent font-medium" : "hover:bg-accent/60",
              ].join(" ")}
            >
              {u.username}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
