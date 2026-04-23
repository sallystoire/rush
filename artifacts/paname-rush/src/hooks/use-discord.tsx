import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initDiscordSDK, isInsideDiscord, getDiscordGuildId, getDiscordChannelId } from "@/lib/discord";

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
  guildId: string | null;
  channelId: string | null;
}

const DiscordContext = createContext<DiscordContextValue>({
  ready: false,
  inside: false,
  user: null,
  error: null,
  guildId: null,
  channelId: null,
});

export function DiscordProvider({ children }: { children: ReactNode }) {
  const inside = isInsideDiscord();
  const [ready, setReady] = useState(!inside);
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (!inside) return;
    initDiscordSDK()
      .then((auth) => {
        if (auth) setUser(auth.user);
        setGuildId(getDiscordGuildId());
        setChannelId(getDiscordChannelId());
        setReady(true);
      })
      .catch((err) => {
        console.error("[Discord] Init error:", err);
        setError(String(err));
        setReady(true);
      });
  }, [inside]);

  return (
    <DiscordContext.Provider value={{ ready, inside, user, error, guildId, channelId }}>
      {children}
    </DiscordContext.Provider>
  );
}

export function useDiscord() {
  return useContext(DiscordContext);
}
