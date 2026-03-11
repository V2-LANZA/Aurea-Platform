"use client";
import { useEffect, useState } from "react";
import { getUsername } from "@/lib/auth";

export function useMe() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  return { username };
}
