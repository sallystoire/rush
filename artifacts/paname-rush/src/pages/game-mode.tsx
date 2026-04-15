import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  useListTeams, 
  useCreateTeam, 
  useJoinTeam, 
  useRedeemCode,
  getListTeamsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Play, Trophy, Key, Users } from "lucide-react";

export default function GameMode() {
  const [, setLocation] = useLocation();
  const { player } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCode, setShowCode] = useState(false);
  
  // Team creation state
  const [teamName, setTeamName] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [minLevel, setMinLevel] = useState(1);

  // Code state
  const [code, setCode] = useState("");

  const { data: teams = [], isLoading: isLoadingTeams } = useListTeams(
    { search: search.trim() ? search : undefined, sortBy: "level" },
    { query: { queryKey: getListTeamsQueryKey({ search: search.trim() ? search : undefined, sortBy: "level" }) } }
  );

  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const redeemCode = useRedeemCode();

  if (!player) {
    setLocation("/");
    return null;
  }

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (player.level < 4) {
      toast({
        title: "Niveau insuffisant",
        description: "Tu dois etre de niveau 4 pour debloquer la creation de team.",
        variant: "destructive"
      });
      return;
    }
    
    if (!teamName.trim()) return;

    createTeam.mutate(
      { 
        data: { 
          name: teamName.trim(), 
          captainId: player.id,
          maxMembers,
          minLevelRequired: minLevel
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setShowCreateTeam(false);
          toast({ title: "Team creee avec succes !" });
        },
        onError: () => {
          toast({ title: "Erreur lors de la creation", variant: "destructive" });
        }
      }
    );
  };

  const handleJoinTeam = (teamId: number, teamMinLevel: number) => {
    if (player.level < teamMinLevel) {
      toast({
        title: "Niveau insuffisant",
        description: `Cette team requiert le niveau ${teamMinLevel}.`,
        variant: "destructive"
      });
      return;
    }

    joinTeam.mutate(
      { teamId, data: { playerId: player.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          toast({ title: "Tu as rejoint la team !" });
        },
        onError: () => {
          toast({ title: "Erreur ou team pleine", variant: "destructive" });
        }
      }
    );
  };

  const handleRedeemCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    redeemCode.mutate(
      { data: { playerId: player.id, code: code.trim() } },
      {
        onSuccess: (res) => {
          setShowCode(false);
          setCode("");
          if (res.success) {
            toast({ title: "Code valide !", description: res.message });
          } else {
            toast({ title: "Code invalide", description: res.message, variant: "destructive" });
          }
        },
        onError: () => {
          toast({ title: "Erreur de code", variant: "destructive" });
        }
      }
    );
  };

  const handleQuickPlay = () => {
    setLocation("/game?mode=solo");
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans flex flex-col md:flex-row gap-8">
      {/* Left Sidebar Menu */}
      <div className="flex flex-col gap-4 w-full md:w-80 shrink-0">
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full justify-start h-14 text-lg pixel-text border-2 hover:bg-muted">
            <ArrowLeft className="mr-2 h-5 w-5" /> RETOUR
          </Button>
        </Link>
        
        <div className="h-px bg-border my-2" />

        <Button 
          className="w-full justify-start h-16 text-lg bg-primary hover:bg-primary/90 text-white pixel-text pixel-border shadow-[0_0_10px_rgba(255,0,85,0.4)]"
          onClick={handleQuickPlay}
        >
          <Play className="mr-3 h-6 w-6" /> PARTIE RAPIDE
        </Button>

        <Button 
          variant="outline"
          className="w-full justify-start h-14 text-lg border-2 border-secondary text-secondary hover:bg-secondary hover:text-white pixel-text"
          onClick={() => {
            if (player.level < 4) {
              toast({
                title: "Niveau insuffisant",
                description: "Tu dois etre de niveau 4 pour debloquer la creation de team.",
                variant: "destructive"
              });
            } else {
              setShowCreateTeam(true);
            }
          }}
        >
          <Plus className="mr-3 h-5 w-5" /> CREER UNE TEAM
        </Button>

        <Link href="/leaderboard" className="w-full">
          <Button variant="outline" className="w-full justify-start h-14 text-lg border-2 border-accent text-accent hover:bg-accent hover:text-background pixel-text">
            <Trophy className="mr-3 h-5 w-5" /> CLASSEMENT
          </Button>
        </Link>

        <Button 
          variant="outline"
          className="w-full justify-start h-14 text-lg border-2 border-muted-foreground text-muted-foreground hover:bg-muted-foreground hover:text-background pixel-text"
          onClick={() => setShowCode(true)}
        >
          <Key className="mr-3 h-5 w-5" /> CODE BOOST
        </Button>

        {/* Player Mini Profile */}
        <div className="mt-auto p-4 border-2 border-border bg-card">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 pixel-border"
              style={{ backgroundColor: player.color }}
            />
            <div>
              <div className="font-bold pixel-text text-sm truncate">{player.username}</div>
              <div className="text-muted-foreground text-sm font-mono mt-1">Niv. {player.level}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Team Search & List */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Input 
              placeholder="Chercher une team..." 
              className="h-14 pl-12 text-lg border-2 bg-card rounded-none font-mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-6 w-6" />
          </div>
        </div>

        <div className="flex-1 bg-card border-4 border-border p-4 overflow-auto">
          <h2 className="pixel-text text-xl mb-6 text-white border-b-2 border-border pb-4">TEAMS DISPONIBLES</h2>
          
          {isLoadingTeams ? (
            <div className="text-center text-muted-foreground font-mono animate-pulse">CHARGEMENT...</div>
          ) : teams.length === 0 ? (
            <div className="text-center text-muted-foreground font-mono">Aucune team trouvee.</div>
          ) : (
            <div className="grid gap-4">
              {teams.map(team => (
                <div key={team.id} className="flex items-center justify-between p-4 border-2 border-border hover:border-primary transition-colors bg-background">
                  <div>
                    <div className="font-bold text-lg pixel-text text-primary mb-2">{team.name}</div>
                    <div className="flex items-center gap-6 font-mono text-sm text-muted-foreground">
                      <span>Niv. Requis: {team.minLevelRequired}</span>
                      <span>Membres: {team.members?.length || 0}/{team.maxMembers}</span>
                      <span>Niv. Moyen: {team.level}</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="border-2 hover:bg-primary hover:text-white hover:border-primary pixel-text"
                    disabled={team.members?.length >= team.maxMembers || player.teamId === team.id}
                    onClick={() => handleJoinTeam(team.id, team.minLevelRequired)}
                  >
                    {player.teamId === team.id ? "REJOINT" : "REJOINDRE"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="border-4 border-primary bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-primary">CREER UNE TEAM</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la team</Label>
              <Input 
                value={teamName} 
                onChange={e => setTeamName(e.target.value)} 
                className="font-mono rounded-none border-2" 
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Membres Max</Label>
                <Input 
                  type="number" 
                  min={2} max={10} 
                  value={maxMembers} 
                  onChange={e => setMaxMembers(Number(e.target.value))} 
                  className="font-mono rounded-none border-2" 
                />
              </div>
              <div className="space-y-2">
                <Label>Niveau Requis</Label>
                <Input 
                  type="number" 
                  min={1} max={100} 
                  value={minLevel} 
                  onChange={e => setMinLevel(Number(e.target.value))} 
                  className="font-mono rounded-none border-2" 
                />
              </div>
            </div>
            <Button type="submit" className="w-full mt-4 pixel-text bg-primary hover:bg-primary/90 text-white rounded-none" disabled={createTeam.isPending}>
              CREER
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCode} onOpenChange={setShowCode}>
        <DialogContent className="border-4 border-accent bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-accent">ENTRER UN CODE</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRedeemCode} className="space-y-4">
            <div className="space-y-2">
              <Label>Code Boost</Label>
              <Input 
                value={code} 
                onChange={e => setCode(e.target.value)} 
                className="font-mono rounded-none border-2 border-accent uppercase" 
                required 
              />
            </div>
            <Button type="submit" className="w-full mt-4 pixel-text bg-accent hover:bg-accent/90 text-background rounded-none" disabled={redeemCode.isPending}>
              VALIDER
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
