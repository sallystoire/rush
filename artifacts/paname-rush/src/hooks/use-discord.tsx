import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initDiscordSDK, isInsideDiscord } from "@/lib/discord";

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string;
  avatar?: string;
}

interface DiscordContextValue {
  ready: boolean;
  inside: boolean;
  user: DiscordUser | null;
  error: string | null;
}

const DiscordContext = createContext<DiscordContextValue>({
  ready: false,
  inside: false,
  user: null,
  error: null,
});

export function DiscordProvider({ children }: { children: ReactNode }) {
  const inside = isInsideDiscord();
  const [ready, setReady] = useState(!inside);
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inside) return;
    initDiscordSDK()
      .then((auth) => {
        if (auth) setUser(auth.user);
        setReady(true);
      })
      .catch((err) => {
        console.error("[Discord] Init error:", err);
        setError(String(err));
        setReady(true);
      });
  }, [inside]);

  return (
    <DiscordContext.Provider value={{ ready, inside, user, error }}>
      {children}
    </DiscordContext.Provider>
  );
}

export function useDiscord() {
  return useContext(DiscordContext);
}
