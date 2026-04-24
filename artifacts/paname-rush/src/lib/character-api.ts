import { customFetch } from "@workspace/api-client-react";
import type { Player } from "@workspace/api-client-react";

export interface CharacterData {
  skinColor: string;
  gender: "male" | "female";
  hairColor: string;
  equippedItems: string[];
  ownedItems: string[];
}

export async function updateCharacter(playerId: number, data: Partial<CharacterData>): Promise<Player> {
  return customFetch<Player>(`/api/players/${playerId}/character`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function purchaseItem(playerId: number, itemId: string): Promise<{ success: boolean; message: string; player: Player }> {
  return customFetch<{ success: boolean; message: string; player: Player }>("/api/shop/purchase", {
    method: "POST",
    body: JSON.stringify({ playerId, itemId }),
  });
}
