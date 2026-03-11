"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ChatUserPage() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = params?.username;

  useEffect(() => {
    // If later you add a backend endpoint that creates/returns a DM group for username,
    // you can redirect automatically to /chat and set groupId.
  }, []);

  return (
    <AppShell>
      <div className="py-6">
        <Card className="rounded-3xl border-black/5 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-[#0B132B]">Chat with {username}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[#3A506B]">
            <div>
              This prototype currently connects using a <b>Group ID</b>.
              If you want “chat by username”, we can add a backend route that creates/returns a group for this user.
            </div>

            <div className="flex gap-2">
              <Button
                className="rounded-2xl bg-[#0B132B] text-white hover:bg-[#1C2541]"
                onClick={() => router.push("/chat")}
              >
                Go to Chat (Group ID)
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => router.push("/")}
              >
                Back home
              </Button>
            </div>

            <div className="text-xs opacity-80">
              If you tell me your backend DM/group endpoints, I’ll turn this into a real 1-to-1 page.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
