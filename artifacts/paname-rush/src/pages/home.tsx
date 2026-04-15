import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePlayer } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showCredits, setShowCredits] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  
  const { player, setPlayer } = useAuth();
  const createPlayer = useCreatePlayer();

  const handlePlay = () => {
    if (player) {
      setLocation("/game-mode");
    } else {
      setShowLogin(true);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const colors = ["#ff0055", "#00f0ff", "#00ffaa", "#ffea00", "#ffaa00", "#aa00ff"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    createPlayer.mutate(
      { data: { username: username.trim(), color: randomColor } },
      {
        onSuccess: (newPlayer) => {
          setPlayer(newPlayer);
          setShowLogin(false);
          setLocation("/game-mode");
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-primary rounded-lg rotate-12 blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-secondary rounded-lg -rotate-12 blur-3xl"></div>
      </div>

      <div className="text-center z-10 flex flex-col items-center gap-12">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-bold pixel-text text-white drop-shadow-[0_0_10px_rgba(255,0,85,0.8)] tracking-tighter">
            PANAME<br/><span className="text-primary">RUSH</span>
          </h1>
          <p className="text-muted-foreground text-xl tracking-widest uppercase">
            La Course Ultime
          </p>
        </div>

        <div className="flex flex-col gap-6 w-full max-w-xs">
          <Button 
            size="lg" 
            className="w-full text-xl h-16 bg-primary hover:bg-primary/90 text-white border-4 border-primary-foreground pixel-text pixel-border shadow-[0_0_15px_rgba(255,0,85,0.5)] hover:shadow-[0_0_25px_rgba(255,0,85,0.8)] transition-all hover:scale-105"
            onClick={handlePlay}
          >
            JOUER
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full text-lg h-14 border-2 border-muted-foreground text-muted-foreground hover:text-white hover:border-white transition-all pixel-text"
            onClick={() => setShowCredits(true)}
          >
            CREDITS
          </Button>
        </div>
      </div>

      <Dialog open={showCredits} onOpenChange={setShowCredits}>
        <DialogContent className="border-4 border-primary bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-center text-primary mb-4">CREDITS</DialogTitle>
            <DialogDescription className="text-center text-lg text-foreground font-mono">
              Cree et concu par Sally alias sallystoire pour le serveur discord.gg/paname avec amour !
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="border-4 border-secondary bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-center text-secondary mb-4">CHOISIS TON PSEUDO</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="sr-only">Pseudo</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Entrez un pseudo..."
                className="h-12 text-lg border-2 border-secondary focus-visible:ring-secondary rounded-none font-mono"
                autoFocus
                disabled={createPlayer.isPending}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-secondary hover:bg-secondary/90 text-white rounded-none pixel-text border-2 border-secondary-foreground"
              disabled={createPlayer.isPending || !username.trim()}
            >
              {createPlayer.isPending ? "CHARGEMENT..." : "VALIDER"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
