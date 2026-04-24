import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SHOP_ITEMS = [
  { id: "hair_spiky", name: "Cheveux piquants", category: "hair", price: 600, rarity: "common" },
  { id: "hair_afro", name: "Afro", category: "hair", price: 900, rarity: "uncommon" },
  { id: "hair_long", name: "Cheveux longs", category: "hair", price: 800, rarity: "uncommon" },
  { id: "hair_bun", name: "Chignon", category: "hair", price: 700, rarity: "common" },
  { id: "hair_curly", name: "Boucles naturelles", category: "hair", price: 1000, rarity: "rare" },
  { id: "cap_baseball", name: "Casquette baseball", category: "cap", price: 500, rarity: "common" },
  { id: "cap_crown", name: "Couronne royale", category: "cap", price: 2500, rarity: "legendary" },
  { id: "cap_cowboy", name: "Chapeau de cowboy", category: "cap", price: 800, rarity: "uncommon" },
  { id: "cap_beanie", name: "Bonnet violet", category: "cap", price: 600, rarity: "common" },
  { id: "wings_angel", name: "Ailes d'ange", category: "wings", price: 1800, rarity: "epic" },
  { id: "wings_butterfly", name: "Ailes papillon", category: "wings", price: 1500, rarity: "rare" },
  { id: "wings_dragon", name: "Ailes de dragon", category: "wings", price: 2200, rarity: "epic" },
  { id: "glasses_round", name: "Lunettes rondes", category: "glasses", price: 400, rarity: "common" },
  { id: "glasses_sunglasses", name: "Lunettes de soleil", category: "glasses", price: 700, rarity: "uncommon" },
];

router.get("/shop/items", (_req, res) => {
  res.json(SHOP_ITEMS);
});

router.post("/shop/purchase", async (req, res) => {
  const { playerId, itemId } = req.body as { playerId: number; itemId: string };

  if (!playerId || !itemId) {
    res.status(400).json({ error: "playerId and itemId required" });
    return;
  }

  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ownedItems: string[] = JSON.parse(player.ownedItems || "[]");

  if (ownedItems.includes(itemId)) {
    res.status(400).json({ error: "Item already owned" });
    return;
  }

  if (player.coins < item.price) {
    res.status(400).json({ error: "Not enough coins" });
    return;
  }

  const newOwned = [...ownedItems, itemId];
  const [updated] = await db.update(playersTable)
    .set({ coins: player.coins - item.price, ownedItems: JSON.stringify(newOwned) })
    .where(eq(playersTable.id, playerId))
    .returning();

  res.json({ success: true, message: `${item.name} acheté !`, player: updated });
});

export default router;
