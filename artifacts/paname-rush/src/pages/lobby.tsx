import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PlayerCharacter, { type AccessoryItem } from "@/components/PlayerCharacter";
import { useAuth } from "@/hooks/use-auth";
import { isAdminPlayer } from "@/lib/admin";
import {
  ShoppingBag, Trophy, Users, Star, Settings, LogOut, Play, Bell, Shield, Sword
} from "lucide-react";

const GAME_MODES = [
  {
    id: "br",
    label: "Battle Royale",
    sublabel: "Solo — Dernier debout",
    tag: "POPULAIRE",
    tagColor: "#ffd700",
    wins: 0,
    rank: "Non classé",
    preview: "#1a4b6e",
  },
  {
    id: "ffa",
    label: "FFA",
    sublabel: "Free For All",
    tag: "CHAOS",
    tagColor: "#ff4444",
    wins: 0,
    rank: "Non classé",
    preview: "#4b1a1a",
  },
  {
    id: "zone",
    label: "Zone Wars",
    sublabel: "Contrôle de zone",
    tag: "NOUVEAU",
    tagColor: "#00e5ff",
    wins: 0,
    rank: "Non classé",
    preview: "#1a4b2e",
  },
];

const NEWS = [
  {
    title: "BATTLE ROYALE",
    body: "Plonge dans l'arène avec 29 adversaires. Sois le dernier debout pour devenir une Paname Legend !",
    color: "#0d47a1",
  },
  {
    title: "Nouveau Shop",
    body: "Des ailes de dragon, couronnes royales et bien plus t'attendent dans le shop de la saison !",
    color: "#4a148c",
  },
];

export default function Lobby() {
  const [, navigate] = useLocation();
  const { player, logout } = useAuth();
  const [selectedMode, setSelectedMode] = useState(0);
  const [showNews, setShowNews] = useState(true);
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!player) { navigate("/"); return; }
  }, [player, navigate]);

  useEffect(() => {
    const id = setInterval(() => setTime((t) => t + 1), 50);
    return () => clearInterval(id);
  }, []);

  if (!player) return null;

  const equippedIds: string[] = JSON.parse((player as any).equippedItems || "[]");
  const equippedItems: AccessoryItem[] = equippedIds.map((id: string) => {
    const type = id.split("_")[0] as AccessoryItem["type"];
    return { id, type };
  });

  const handlePlay = () => {
    navigate("/battle-royale");
  };

  return (
    <div className="lobby-root">
      {/* ===== TOP NAV ===== */}
      <nav className="lobby-nav">
        <div className="lobby-logo">PANAME<span>LEGEND</span></div>
        <div className="lobby-nav-links">
          <button className="nav-btn" onClick={() => navigate("/shop")}>
            <ShoppingBag size={16} /> Shop
          </button>
          <button className="nav-btn nav-btn-active" onClick={() => navigate("/lobby")}>
            <Shield size={16} /> Accueil
          </button>
          <button className="nav-btn" onClick={() => navigate("/locker")}>
            <Star size={16} /> Vestiaire
          </button>
          <button className="nav-btn" onClick={() => navigate("/leaderboard")}>
            <Trophy size={16} /> Classement
          </button>
          {isAdminPlayer(player) && (
            <button className="nav-btn nav-btn-admin" onClick={() => navigate("/admin")}>
              <Settings size={16} /> Admin
            </button>
          )}
        </div>
        <div className="lobby-top-right">
          <div className="coins-display">
            <span className="coin-icon">🪙</span>
            <span>{player.coins.toLocaleString()}</span>
          </div>
          <button className="icon-btn" onClick={() => setShowNews(true)}>
            <Bell size={18} />
          </button>
          <button className="icon-btn" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* ===== MAIN AREA ===== */}
      <div className="lobby-main">
        {/* Left: game mode cards */}
        <div className="lobby-left">
          <div className="section-title">MODE DE JEU</div>
          {GAME_MODES.map((mode, i) => (
            <div
              key={mode.id}
              className={`mode-card ${selectedMode === i ? "mode-card-active" : ""}`}
              onClick={() => setSelectedMode(i)}
            >
              <div className="mode-card-inner" style={{ background: `linear-gradient(135deg, ${mode.preview}dd, #0a1628dd)` }}>
                <div className="mode-tag" style={{ color: mode.tagColor }}>{mode.tag}</div>
                <div className="mode-name">{mode.label}</div>
                <div className="mode-sub">{mode.sublabel}</div>
                <div className="mode-wins">🏆 {mode.wins} victoires · {mode.rank}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Center: character + platform */}
        <div className="lobby-center">
          <div className="char-stage">
            <div
              className="char-glow"
              style={{ boxShadow: `0 0 ${60 + Math.sin(time * 0.1) * 20}px 30px rgba(0,180,255,0.25)` }}
            />
            <div className="char-wrapper" style={{ transform: `translateY(${Math.sin(time * 0.06) * 4}px)` }}>
              <PlayerCharacter
                skinColor={(player as any).skinColor || "beige"}
                gender={((player as any).gender as any) || "male"}
                hairColor={(player as any).hairColor || "#3b1f0a"}
                equippedItems={equippedItems}
                size={260}
              />
            </div>
            <div className="char-platform" />
          </div>

          <button className="play-btn" onClick={handlePlay}>
            <Play size={28} fill="currentColor" />
            JOUER
          </button>
          <div className="play-mode-label">{GAME_MODES[selectedMode].label}</div>
        </div>

        {/* Right: player card + stats */}
        <div className="lobby-right">
          <div className="player-card">
            <div className="player-avatar-wrap">
              <PlayerCharacter
                skinColor={(player as any).skinColor || "beige"}
                gender={((player as any).gender as any) || "male"}
                hairColor={(player as any).hairColor || "#3b1f0a"}
                equippedItems={equippedItems}
                size={80}
              />
            </div>
            <div className="player-info">
              <div className="player-name">{player.username}</div>
              <div className="player-level">Niveau {player.level}</div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-box">
              <Sword size={18} />
              <div className="stat-val">0</div>
              <div className="stat-label">Kills</div>
            </div>
            <div className="stat-box">
              <Trophy size={18} />
              <div className="stat-val">0</div>
              <div className="stat-label">Victoires</div>
            </div>
            <div className="stat-box">
              <Users size={18} />
              <div className="stat-val">30</div>
              <div className="stat-label">En ligne</div>
            </div>
            <div className="stat-box">
              <Star size={18} />
              <div className="stat-val">0%</div>
              <div className="stat-label">Win Rate</div>
            </div>
          </div>

          <button className="customize-btn" onClick={() => navigate("/locker")}>
            ✏️ Personnaliser
          </button>
          <button className="shop-btn" onClick={() => navigate("/shop")}>
            <ShoppingBag size={16} /> Shop
          </button>
        </div>
      </div>

      {/* ===== NEWS MODAL ===== */}
      {showNews && (
        <div className="modal-overlay" onClick={() => setShowNews(false)}>
          <div className="news-modal" onClick={(e) => e.stopPropagation()}>
            <div className="news-header">
              <span>📰 Paname Legend — Actualités</span>
              <button onClick={() => setShowNews(false)}>✕</button>
            </div>
            {NEWS.map((n, i) => (
              <div key={i} className="news-item" style={{ borderLeft: `4px solid ${n.color}` }}>
                <div className="news-img" style={{ background: `linear-gradient(135deg, ${n.color}, #0a1628)` }}>
                  <span style={{ fontSize: 32 }}>{i === 0 ? "⚔️" : "🛒"}</span>
                </div>
                <div className="news-body">
                  <div className="news-title">{n.title}</div>
                  <div className="news-text">{n.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
