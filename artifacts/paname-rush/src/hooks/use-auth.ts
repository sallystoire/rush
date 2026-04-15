import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "@workspace/api-client-react";

interface AuthState {
  player: Player | null;
  setPlayer: (player: Player) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      player: null,
      setPlayer: (player) => set({ player }),
      logout: () => set({ player: null }),
    }),
    {
      name: "paname-rush-auth",
    }
  )
);
