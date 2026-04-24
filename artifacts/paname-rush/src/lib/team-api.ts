const base = import.meta.env.BASE_URL ?? "/";

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${base}api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface LobbyState {
  ready: number[];
  countdownStart: number | null;
  inviteTimestamp: number | null;
  gameStartedAt: number | null;
}

export interface TeamDeathState {
  died: boolean;
  playerId?: number;
  timestamp?: number;
}

// ── Lobby ─────────────────────────────────────────────────────

export const getLobby = (teamId: number) =>
  req<LobbyState>(`/teams/${teamId}/lobby`);

export const markReady = (teamId: number, playerId: number) =>
  req<LobbyState>(`/teams/${teamId}/ready`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });

export const cancelReady = (teamId: number, playerId: number) =>
  req<LobbyState>(`/teams/${teamId}/cancel-ready`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });

export const resetLobby = (teamId: number) =>
  req<{ ok: boolean }>(`/teams/${teamId}/reset-lobby`, { method: "POST", body: "{}" });

export const sendInvite = (teamId: number, playerId: number) =>
  req<LobbyState>(`/teams/${teamId}/invite`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });

// ── Team management ───────────────────────────────────────────

export const kickMember = (teamId: number, captainId: number, memberId: number) =>
  req<{ ok: boolean; members: unknown[] }>(`/teams/${teamId}/kick`, {
    method: "POST",
    body: JSON.stringify({ captainId, memberId }),
  });

export const transferOwnership = (teamId: number, captainId: number, newCaptainId: number) =>
  req<unknown>(`/teams/${teamId}/transfer`, {
    method: "POST",
    body: JSON.stringify({ captainId, newCaptainId }),
  });

export const updateTeamSettings = (teamId: number, data: { name?: string; maxMembers?: number; minLevelRequired?: number }) =>
  req<unknown>(`/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// ── Multiplayer death sync ────────────────────────────────────

export const notifyTeamDeath = (teamId: number, playerId: number) =>
  req<{ ok: boolean }>("/game/team-death", {
    method: "POST",
    body: JSON.stringify({ teamId, playerId }),
  });

export const getTeamState = (teamId: number, since: number) =>
  req<TeamDeathState>(`/game/team-state/${teamId}?since=${since}`);
