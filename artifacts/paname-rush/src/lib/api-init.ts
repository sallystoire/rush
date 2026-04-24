import { setExtraHeadersGetter } from "@workspace/api-client-react";
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
}
