import { Router } from "express";

const discordRouter = Router();

discordRouter.get("/discord/config", (_req, res) => {
  const clientId = process.env["DISCORD_CLIENT_ID"] ?? "";
  res.json({ clientId });
});

discordRouter.post("/discord/token", async (req, res) => {
  const clientId = process.env["DISCORD_CLIENT_ID"];
  const clientSecret = process.env["DISCORD_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "Discord credentials not configured" });
    return;
  }

  const { code } = req.body as { code?: string };

  if (!code) {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    res.status(502).json({ error: "Discord token exchange failed", detail: text });
    return;
  }

  const data = await tokenRes.json() as { access_token: string };
  res.json({ access_token: data.access_token });
});

export default discordRouter;
