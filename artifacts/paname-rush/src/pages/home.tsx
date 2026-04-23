import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreatePlayer } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useDiscord } from "@/hooks/use-discord";
import logoImg from "@assets/IMG_6456_1776978506999.png";
import jouerImg from "@assets/IMG_6457_1776978546497.jpeg";
import creditsImg from "@assets/IMG_6457_1776978551196.jpeg";

const COLORS = ["#ff0055", "#00f0ff", "#00ffaa", "#ffea00", "#ffaa00", "#aa00ff"];

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [showCredits, setShowCredits] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [autoSyncing, setAutoSyncing] = useState(false);

  const { player, setPlayer } = useAuth();
  const { inside: insideDiscord, user: discordUser } = useDiscord();
  const createPlayer = useCreatePlayer();

  useEffect(() => {
    if (!insideDiscord || !discordUser) return;
    const desiredName = discordUser.global_name || discordUser.username;
    if (player && player.username === desiredName) return;
    if (autoSyncing || createPlayer.isPending) return;

    setAutoSyncing(true);
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : undefined;

    createPlayer.mutate(
      { data: { username: desiredName, color: pickColor(), avatarUrl } },
      {
        onSuccess: (synced) => {
          setPlayer(synced);
          setAutoSyncing(false);
        },
        onError: () => setAutoSyncing(false),
      }
    );
  }, [insideDiscord, discordUser, player, autoSyncing, createPlayer, setPlayer]);

  const handlePlay = () => {
    if (player) {
      setLocation("/game-mode");
      return;
    }
    if (insideDiscord) return;
    setShowLogin(true);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    createPlayer.mutate(
      { data: { username: username.trim(), color: pickColor() } },
      {
        onSuccess: (newPlayer) => {
          setPlayer(newPlayer);
          setShowLogin(false);
          setLocation("/game-mode");
        },
      }
    );
  };

  const playDisabled = insideDiscord && !player && (autoSyncing || createPlayer.isPending);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, #4d6b1f 0%, #1f2b0a 55%, #0a0f04 100%)",
      }}
    >
      {/* Splash decorations to match the graffiti style */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, #84cc16 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -right-20 w-[500px] h-[500px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-25"
          style={{ background: "radial-gradient(circle, #facc15 0%, transparent 70%)" }}
        />
      </div>

      <div className="text-center z-10 flex flex-col items-center gap-8 px-6">
        {/* Logo image instead of text */}
        <img
          src={logoImg}
          alt="Paname Rush"
          className="w-[80vw] max-w-[520px] drop-shadow-[0_0_25px_rgba(132,204,22,0.5)] animate-[float_3s_ease-in-out_infinite]"
        />

        {insideDiscord && player && (
          <p className="text-sm text-lime-300 pixel-text">
            Connecté en tant que {player.username}
          </p>
        )}

        <div className="flex flex-col gap-4 w-full max-w-sm items-center">
          <button
            type="button"
            onClick={handlePlay}
            disabled={playDisabled}
            className="transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
            aria-label="Jouer"
          >
            <img src={jouerImg} alt="Jouer" className="w-72 drop-shadow-[0_5px_15px_rgba(0,0,0,0.6)]" />
          </button>
          <button
            type="button"
            onClick={() => setShowCredits(true)}
            className="transition-transform hover:scale-110 active:scale-95 focus:outline-none"
            aria-label="Crédits"
          >
            <img src={creditsImg} alt="Crédits" className="w-56 drop-shadow-[0_5px_15px_rgba(0,0,0,0.6)]" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <Dialog open={showCredits} onOpenChange={setShowCredits}>
        <DialogContent className="border-4 border-orange-500 bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-center text-orange-400 mb-4">
              CRÉDITS
            </DialogTitle>
            <p className="text-center text-lg text-foreground font-mono px-2">
              Créé et conçu par Sally alias <span className="text-lime-400">sallystoire</span> pour le serveur{" "}
              <span className="text-orange-400">discord.gg/paname</span> avec amour !
            </p>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {!insideDiscord && (
        <Dialog open={showLogin} onOpenChange={setShowLogin}>
          <DialogContent className="border-4 border-lime-500 bg-background/95 backdrop-blur rounded-none">
            <DialogHeader>
              <DialogTitle className="pixel-text text-xl text-center text-lime-400 mb-4">
                CHOISIS TON PSEUDO
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="sr-only">
                  Pseudo
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Entrez un pseudo..."
                  className="h-12 text-lg border-2 border-lime-500 focus-visible:ring-lime-500 rounded-none font-mono"
                  autoFocus
                  disabled={createPlayer.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-12 bg-lime-500 hover:bg-lime-600 text-white rounded-none pixel-text border-2 border-lime-700"
                disabled={createPlayer.isPending || !username.trim()}
              >
                {createPlayer.isPending ? "CHARGEMENT..." : "VALIDER"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
