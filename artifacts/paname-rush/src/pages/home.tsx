import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useCreatePlayer } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useDiscord } from "@/hooks/use-discord";
import PlayerCharacter from "@/components/PlayerCharacter";

const COLORS = ["#ff0055","#00f0ff","#00ffaa","#ffea00","#ffaa00","#aa00ff"];
function pickColor(){ return COLORS[Math.floor(Math.random()*COLORS.length)]; }

export default function Home() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [error, setError] = useState("");

  const { player, setPlayer } = useAuth();
  const { inside: insideDiscord, user: discordUser, accessToken: discordAccessToken } = useDiscord();
  const createPlayer = useCreatePlayer();
  const syncedTokenRef = useRef<string | null>(null);

  // If already logged in, go to lobby
  useEffect(() => {
    if (player) navigate("/lobby");
  }, [player, navigate]);

  // Discord auto-login
  useEffect(() => {
    if (!insideDiscord || !discordUser) return;
    const desiredName = discordUser.global_name || discordUser.username;
    if (syncedTokenRef.current && syncedTokenRef.current === (discordAccessToken ?? "")) return;
    if (player && player.username === desiredName && player.discordId) return;
    if (autoSyncing || createPlayer.isPending) return;

    syncedTokenRef.current = discordAccessToken ?? "";
    setAutoSyncing(true);
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : undefined;
    createPlayer.mutate(
      { data: { username: desiredName, color: pickColor(), avatarUrl, discordAccessToken: discordAccessToken ?? undefined } },
      {
        onSuccess: (synced) => { setPlayer(synced); setAutoSyncing(false); },
        onError: () => setAutoSyncing(false),
      }
    );
  }, [insideDiscord, discordUser, discordAccessToken, player, autoSyncing, createPlayer, setPlayer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name || name.length < 2) { setError("Pseudo trop court (2 caractères min)"); return; }
    if (name.length > 20) { setError("Pseudo trop long (20 caractères max)"); return; }
    setError("");
    createPlayer.mutate(
      { data: { username: name, color: pickColor() } },
      {
        onSuccess: (p) => { setPlayer(p); },
        onError: (err: any) => {
          const msg = err?.message || "Erreur lors de la création";
          setError(msg.includes("unique") ? "Ce pseudo est déjà pris !" : msg);
        },
      }
    );
  };

  return (
    <div className="home-root">
      {/* Animated background particles */}
      <div className="home-bg" />

      <div className="home-content">
        {/* Left: game preview character */}
        <div className="home-char-side">
          <div className="home-char-float">
            <PlayerCharacter skinColor="tan" gender="male" hairColor="#1a1a1a" size={220} />
          </div>
          <div className="home-char-platform" />
          <div className="home-char-glow" />
        </div>

        {/* Right: login form */}
        <div className="home-form-side">
          <div className="home-logo">
            PANAME<span>LEGEND</span>
          </div>
          <div className="home-tagline">Le Battle Royale de Paris</div>

          {!insideDiscord ? (
            <form onSubmit={handleSubmit} className="home-form">
              <div className="home-input-wrap">
                <input
                  className="home-input"
                  type="text"
                  placeholder="Ton pseudo..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  autoFocus
                  disabled={createPlayer.isPending}
                />
                {error && <div className="home-error">{error}</div>}
              </div>
              <button
                type="submit"
                className="home-play-btn"
                disabled={createPlayer.isPending || !username.trim()}
              >
                {createPlayer.isPending ? "Connexion..." : "▶ JOUER"}
              </button>
            </form>
          ) : (
            <div className="home-discord-status">
              {autoSyncing || createPlayer.isPending ? (
                <div className="home-connecting">Connexion Discord...</div>
              ) : (
                <div className="home-connecting">Chargement...</div>
              )}
            </div>
          )}

          <div className="home-features">
            <div className="home-feature">⚔️ Battle Royale</div>
            <div className="home-feature">🎨 Personnalisation</div>
            <div className="home-feature">🛒 Shop d'accessoires</div>
            <div className="home-feature">🏆 Classement</div>
          </div>
        </div>
      </div>
    </div>
  );
}
