import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PlayerCharacter, { SKIN_PRESETS, type AccessoryItem } from "@/components/PlayerCharacter";
import { useAuth } from "@/hooks/use-auth";
import { updateCharacter } from "@/lib/character-api";
import { getItemById, CATEGORY_LABELS, type ItemCategory } from "@/lib/shop-items";
import { ArrowLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HAIR_COLORS = [
  "#3b1f0a", "#1a1a1a", "#f5c842", "#e63946", "#2d6a4f",
  "#5c4033", "#ffffff", "#ff6b9d", "#7b2fff", "#00b4d8",
];

const SLOT_CATEGORIES: { type: ItemCategory; label: string; emoji: string }[] = [
  { type: "hair", label: "Cheveux", emoji: "💇" },
  { type: "cap", label: "Couvre-chef", emoji: "🎩" },
  { type: "wings", label: "Ailes", emoji: "🪶" },
  { type: "glasses", label: "Lunettes", emoji: "👓" },
];

export default function Locker() {
  const [, navigate] = useLocation();
  const { player, setPlayer } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [skinColor, setSkinColor] = useState("beige");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [hairColor, setHairColor] = useState("#3b1f0a");
  const [equippedMap, setEquippedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!player) { navigate("/"); return; }
    setSkinColor((player as any).skinColor || "beige");
    setGender(((player as any).gender as any) || "male");
    setHairColor((player as any).hairColor || "#3b1f0a");
    const ids: string[] = JSON.parse((player as any).equippedItems || "[]");
    const map: Record<string, string> = {};
    ids.forEach((id: string) => { map[id.split("_")[0]] = id; });
    setEquippedMap(map);
  }, [player, navigate]);

  if (!player) return null;

  const ownedIds: string[] = JSON.parse((player as any).ownedItems || "[]");
  const equippedItems: AccessoryItem[] = Object.values(equippedMap).map((id) => ({
    id,
    type: id.split("_")[0] as AccessoryItem["type"],
  }));

  const handleEquipToggle = (itemId: string) => {
    const type = itemId.split("_")[0];
    setEquippedMap((prev) => {
      if (prev[type] === itemId) {
        const next = { ...prev };
        delete next[type];
        return next;
      }
      return { ...prev, [type]: itemId };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const equipped = Object.values(equippedMap);
      const updated = await updateCharacter(player.id, {
        skinColor,
        gender,
        hairColor,
        equippedItems: equipped,
      });
      setPlayer(updated);
      toast({ title: "Sauvegardé !", description: "Ton look a été mis à jour." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="locker-root">
      <nav className="inner-nav">
        <button className="back-btn" onClick={() => navigate("/lobby")}>
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="inner-nav-title">VESTIAIRE</div>
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Sauvegarde..." : <><Check size={16} /> Sauvegarder</>}
        </button>
      </nav>

      <div className="locker-content">
        {/* Left: character preview */}
        <div className="locker-preview">
          <div className="preview-bg">
            <div className="preview-glow" />
            <PlayerCharacter
              skinColor={skinColor}
              gender={gender}
              hairColor={hairColor}
              equippedItems={equippedItems}
              size={280}
            />
            <div className="preview-platform" />
          </div>
          <div className="preview-label">{player.username}</div>
        </div>

        {/* Right: customization panels */}
        <div className="locker-options">
          {/* Gender */}
          <div className="option-section">
            <div className="option-title">GENRE</div>
            <div className="gender-row">
              <button
                className={`gender-btn ${gender === "male" ? "active" : ""}`}
                onClick={() => setGender("male")}
              >
                👨 Homme
              </button>
              <button
                className={`gender-btn ${gender === "female" ? "active" : ""}`}
                onClick={() => setGender("female")}
              >
                👩 Femme
              </button>
            </div>
          </div>

          {/* Skin color */}
          <div className="option-section">
            <div className="option-title">COULEUR DE PEAU</div>
            <div className="color-row">
              {Object.entries(SKIN_PRESETS).map(([key, hex]) => (
                <button
                  key={key}
                  className={`skin-dot ${skinColor === key ? "active" : ""}`}
                  style={{ background: hex }}
                  onClick={() => setSkinColor(key)}
                  title={key}
                />
              ))}
            </div>
          </div>

          {/* Hair color */}
          <div className="option-section">
            <div className="option-title">COULEUR DE CHEVEUX</div>
            <div className="color-row">
              {HAIR_COLORS.map((c) => (
                <button
                  key={c}
                  className={`skin-dot ${hairColor === c ? "active" : ""}`}
                  style={{ background: c, border: c === "#ffffff" ? "2px solid #555" : undefined }}
                  onClick={() => setHairColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Accessories slots */}
          {SLOT_CATEGORIES.map(({ type, label, emoji }) => {
            const categoryItems = ownedIds
              .filter((id) => id.startsWith(type + "_"))
              .map((id) => getItemById(id))
              .filter(Boolean);

            return (
              <div key={type} className="option-section">
                <div className="option-title">{emoji} {label.toUpperCase()}</div>
                {categoryItems.length === 0 ? (
                  <div className="no-items-hint">
                    Tu n'as pas encore d'articles dans cette catégorie.{" "}
                    <span className="hint-link" onClick={() => navigate("/shop")}>
                      Voir le Shop →
                    </span>
                  </div>
                ) : (
                  <div className="item-row">
                    {categoryItems.map((item) => (
                      <button
                        key={item!.id}
                        className={`item-slot ${equippedMap[type] === item!.id ? "item-equipped" : ""}`}
                        onClick={() => handleEquipToggle(item!.id)}
                        title={item!.name}
                      >
                        <span className="item-slot-name">{item!.name}</span>
                        {equippedMap[type] === item!.id && <Check size={12} className="item-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
