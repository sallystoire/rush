import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { purchaseItem } from "@/lib/character-api";
import { SHOP_ITEMS, RARITY_COLORS, CATEGORY_LABELS, type ItemCategory, type ShopItem } from "@/lib/shop-items";
import PlayerCharacter, { type AccessoryItem } from "@/components/PlayerCharacter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShoppingCart, Check } from "lucide-react";

const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  hair: "💇",
  cap: "🎩",
  wings: "🪶",
  glasses: "👓",
};

export default function ShopPage() {
  const [, navigate] = useLocation();
  const { player, setPlayer } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<ItemCategory | "all">("all");
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [buying, setBuying] = useState(false);

  if (!player) { navigate("/"); return null; }

  const ownedIds: string[] = JSON.parse((player as any).ownedItems || "[]");
  const equippedIds: string[] = JSON.parse((player as any).equippedItems || "[]");

  const filtered = filter === "all" ? SHOP_ITEMS : SHOP_ITEMS.filter((i) => i.category === filter);

  const handleBuy = async () => {
    if (!selectedItem || !player) return;
    setBuying(true);
    try {
      const result = await purchaseItem(player.id, selectedItem.id);
      setPlayer(result.player);
      toast({ title: "Acheté !", description: result.message });
      setSelectedItem(null);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible d'acheter.", variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const previewAccessory: AccessoryItem[] = selectedItem
    ? [{ id: selectedItem.id, type: selectedItem.category }]
    : equippedIds.map((id) => ({ id, type: id.split("_")[0] as AccessoryItem["type"] }));

  return (
    <div className="shop-root">
      <nav className="inner-nav">
        <button className="back-btn" onClick={() => navigate("/lobby")}>
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="inner-nav-title">SHOP</div>
        <div className="coins-display">
          <span className="coin-icon">🪙</span>
          <span>{player.coins.toLocaleString()}</span>
        </div>
      </nav>

      <div className="shop-content">
        {/* Left: item grid */}
        <div className="shop-main">
          {/* Category tabs */}
          <div className="category-tabs">
            <button
              className={`cat-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Tous
            </button>
            {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((cat) => (
              <button
                key={cat}
                className={`cat-tab ${filter === cat ? "active" : ""}`}
                onClick={() => setFilter(cat)}
              >
                {CATEGORY_EMOJIS[cat]} {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="shop-grid">
            {filtered.map((item) => {
              const owned = ownedIds.includes(item.id);
              const equipped = equippedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`shop-card ${selectedItem?.id === item.id ? "shop-card-selected" : ""} ${owned ? "shop-card-owned" : ""}`}
                  style={{ borderColor: RARITY_COLORS[item.rarity] }}
                  onClick={() => setSelectedItem(item)}
                >
                  <div
                    className="shop-card-header"
                    style={{ background: `linear-gradient(135deg, ${RARITY_COLORS[item.rarity]}33, #0a1628)` }}
                  >
                    <span className="shop-item-emoji">{CATEGORY_EMOJIS[item.category]}</span>
                    {owned && (
                      <div className="owned-badge">
                        {equipped ? "ÉQUIPÉ" : "POSSÉDÉ"}
                      </div>
                    )}
                  </div>
                  <div className="shop-card-body">
                    <div className="shop-item-name">{item.name}</div>
                    <div className="shop-rarity" style={{ color: RARITY_COLORS[item.rarity] }}>
                      {item.rarity.toUpperCase()}
                    </div>
                    {!owned && (
                      <div className="shop-price">
                        <span className="coin-icon">🪙</span> {item.price.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: preview + purchase */}
        <div className="shop-preview-panel">
          <div className="preview-bg">
            <div className="preview-glow" />
            <PlayerCharacter
              skinColor={(player as any).skinColor || "beige"}
              gender={((player as any).gender as any) || "male"}
              hairColor={(player as any).hairColor || "#3b1f0a"}
              equippedItems={previewAccessory}
              size={220}
            />
            <div className="preview-platform" />
          </div>

          {selectedItem ? (
            <div className="purchase-panel">
              <div className="purchase-item-name">{selectedItem.name}</div>
              <div className="purchase-item-cat">
                {CATEGORY_EMOJIS[selectedItem.category]} {CATEGORY_LABELS[selectedItem.category]}
              </div>
              <div className="purchase-item-desc">{selectedItem.description}</div>
              <div
                className="purchase-rarity-badge"
                style={{ background: RARITY_COLORS[selectedItem.rarity] }}
              >
                {selectedItem.rarity.toUpperCase()}
              </div>

              {ownedIds.includes(selectedItem.id) ? (
                <div className="already-owned">
                  <Check size={16} /> Déjà possédé
                </div>
              ) : (
                <>
                  <div className="purchase-price">
                    🪙 {selectedItem.price.toLocaleString()} coins
                  </div>
                  {player.coins < selectedItem.price && (
                    <div className="insufficient-funds">Pas assez de coins</div>
                  )}
                  <button
                    className="buy-btn"
                    onClick={handleBuy}
                    disabled={buying || player.coins < selectedItem.price}
                  >
                    {buying ? "Achat..." : <><ShoppingCart size={16} /> Acheter</>}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="purchase-hint">← Sélectionne un article pour le prévisualiser</div>
          )}
        </div>
      </div>
    </div>
  );
}
