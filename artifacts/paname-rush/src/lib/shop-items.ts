export type ItemCategory = "hair" | "cap" | "wings" | "glasses";

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "hair_spiky", name: "Cheveux piquants", category: "hair", price: 600, description: "Style rebelle avec des pointes", rarity: "common" },
  { id: "hair_afro", name: "Afro", category: "hair", price: 900, description: "Un afro imposant et stylé", rarity: "uncommon" },
  { id: "hair_long", name: "Cheveux longs", category: "hair", price: 800, description: "Cheveux longs qui tombent sur les épaules", rarity: "uncommon" },
  { id: "hair_bun", name: "Chignon", category: "hair", price: 700, description: "Un chignon élégant", rarity: "common" },
  { id: "hair_curly", name: "Boucles naturelles", category: "hair", price: 1000, description: "Des boucles volumineuses", rarity: "rare" },

  { id: "cap_baseball", name: "Casquette baseball", category: "cap", price: 500, description: "Casquette rouge classique", rarity: "common" },
  { id: "cap_crown", name: "Couronne royale", category: "cap", price: 2500, description: "Pour les vrais champions", rarity: "legendary" },
  { id: "cap_cowboy", name: "Chapeau de cowboy", category: "cap", price: 800, description: "Style western", rarity: "uncommon" },
  { id: "cap_beanie", name: "Bonnet violet", category: "cap", price: 600, description: "Bonnet coloré", rarity: "common" },

  { id: "wings_angel", name: "Ailes d'ange", category: "wings", price: 1800, description: "Ailes blanches célestes", rarity: "epic" },
  { id: "wings_butterfly", name: "Ailes papillon", category: "wings", price: 1500, description: "Ailes colorées de papillon", rarity: "rare" },
  { id: "wings_dragon", name: "Ailes de dragon", category: "wings", price: 2200, description: "Ailes de feu rouge", rarity: "epic" },

  { id: "glasses_round", name: "Lunettes rondes", category: "glasses", price: 400, description: "Style intellectuel", rarity: "common" },
  { id: "glasses_sunglasses", name: "Lunettes de soleil", category: "glasses", price: 700, description: "Trop cool pour toi", rarity: "uncommon" },
];

export const RARITY_COLORS: Record<ShopItem["rarity"], string> = {
  common: "#b0bec5",
  uncommon: "#66bb6a",
  rare: "#2196f3",
  epic: "#9c27b0",
  legendary: "#ff9800",
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  hair: "Cheveux",
  cap: "Couvre-chefs",
  wings: "Ailes",
  glasses: "Lunettes",
};

export function getItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
