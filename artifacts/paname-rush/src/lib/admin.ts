import { customFetch } from "@workspace/api-client-react";
import type { Player, Team, BoostCode } from "@workspace/api-client-react";

export const ADMIN_DISCORD_ID = "989611084073799731";

export function isAdminPlayer(player: { discordId?: string | null } | null | undefined): boolean {
  return !!player?.discordId && player.discordId === ADMIN_DISCORD_ID;
}

// ── Admin API helpers (raw — these endpoints are not in the OpenAPI spec) ──
type TeamWithMembers = Team & { members: Player[] };

export async function adminListTeams(): Promise<TeamWithMembers[]> {
  return customFetch<TeamWithMembers[]>("/api/admin/teams");
}

export async function adminDeleteTeam(teamId: number): Promise<{ success: boolean }> {
  return customFetch<{ success: boolean }>(`/api/admin/teams/${teamId}`, { method: "DELETE" });
}

export async function adminRenameTeam(teamId: number, name: string): Promise<Team> {
  return customFetch<Team>(`/api/admin/teams/${teamId}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function adminListPlayers(): Promise<Player[]> {
  return customFetch<Player[]>("/api/admin/players");
}

export async function adminBanPlayer(playerId: number): Promise<Player> {
  return customFetch<Player>(`/api/admin/players/${playerId}/ban`, { method: "POST" });
}

export async function adminUnbanPlayer(playerId: number): Promise<Player> {
  return customFetch<Player>(`/api/admin/players/${playerId}/unban`, { method: "POST" });
}

export async function adminListCodes(): Promise<BoostCode[]> {
  return customFetch<BoostCode[]>("/api/admin/codes");
}

export async function adminDeleteCode(codeId: number): Promise<{ success: boolean }> {
  return customFetch<{ success: boolean }>(`/api/admin/codes/${codeId}`, { method: "DELETE" });
}
