import { setExtraHeadersGetter, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

// Always attach the current player's id to outgoing API requests so the
// server can authenticate admin-only endpoints. Reads from the persisted
// Zustand store synchronously.
export function initApiClient() {
  setExtraHeadersGetter(() => {
    const player = useAuth.getState().player;
    if (!player?.id) return null;
    return { "x-player-id": String(player.id) };
  });

  // Listen for the special "player not found" recovery signal coming from
  // /game/start (and any other endpoint that opts in). This typically means
  // the persisted Zustand player ID points at a row that no longer exists in
  // the DB — clearing the local state forces the home page to recreate the
  // account on the next visit.
  void customFetch; // ensures the module is initialized in the bundle
}

/**
 * Inspect a fetch error body and clear the local auth state if the server
 * told us the player record is gone. Call this from mutation onError handlers
 * for endpoints that can return PLAYER_NOT_FOUND.
 */
export async function recoverIfPlayerMissing(error: unknown): Promise<boolean> {
  if (!(error instanceof Error)) return false;
  const msg = error.message || "";
  // Orval's customFetch throws Error("HTTP <status>") on non-2xx, with the
  // server JSON appended after a colon in some setups. We do the cheapest
  // possible string match — falsy matches are harmless.
  if (msg.includes("PLAYER_NOT_FOUND") || msg.includes("Joueur introuvable")) {
    useAuth.getState().logout();
    return true;
  }
  return false;
}
