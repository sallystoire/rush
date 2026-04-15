import { DiscordSDK } from "@discord/embedded-app-sdk";

export const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

export function isInsideDiscord(): boolean {
  return (
    DISCORD_CLIENT_ID != null &&
    DISCORD_CLIENT_ID !== "" &&
    (window.location.search.includes("frame_id=") ||
      (!!window.parent && window.parent !== window))
  );
}

let _sdk: DiscordSDK | null = null;
let _auth: {
  access_token: string;
  user: { id: string; username: string; global_name?: string; avatar?: string };
} | null = null;

export async function initDiscordSDK() {
  if (!DISCORD_CLIENT_ID) {
    console.warn("[Discord] VITE_DISCORD_CLIENT_ID not set — running without Discord");
    return null;
  }

  if (_auth) return _auth;

  const sdk = new DiscordSDK(DISCORD_CLIENT_ID);
  _sdk = sdk;

  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const tokenRes = await fetch(`${baseUrl}api/discord/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!tokenRes.ok) {
    throw new Error("[Discord] Failed to exchange token");
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const result = await sdk.commands.authenticate({ access_token });

  _auth = {
    access_token: result.access_token,
    user: {
      id: result.user.id,
      username: result.user.username,
      global_name: result.user.global_name ?? undefined,
      avatar: result.user.avatar ?? undefined,
    },
  };

  return _auth;
}

export function getDiscordSDK() {
  return _sdk;
}

export function getDiscordAuth() {
  return _auth;
}
