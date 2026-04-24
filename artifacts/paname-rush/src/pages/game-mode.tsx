import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useListTeams,
  useCreateTeam,
  useJoinTeam,
  useLeaveTeam,
  useGetTeam,
  useRedeemCode,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Play, Trophy, Key, Users, Settings,
  Crown, LogOut, UserMinus, ArrowRightLeft, Send, CheckCircle
} from "lucide-react";
import {
  getLobby, markReady, cancelReady, sendInvite,
  kickMember, transferOwnership, updateTeamSettings,
  type LobbyState,
} from "@/lib/team-api";

const COUNTDOWN_SECONDS = 10;

export default function GameMode() {
  const [, setLocation] = useLocation();
  const { player, setPlayer } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── View state ───────────────────────────────────────────────
  const [view, setView] = useState<"browse" | "myteam">(player?.teamId ? "myteam" : "browse");
  const [search, setSearch] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Team creation form ────────────────────────────────────────
  const [teamName, setTeamName] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);
  const [minLevel, setMinLevel] = useState(1);

  // ── Settings form ─────────────────────────────────────────────
  const [settingName, setSettingName] = useState("");
  const [settingMaxMembers, setSettingMaxMembers] = useState(4);
  const [settingMinLevel, setSettingMinLevel] = useState(1);

  // ── Code form ─────────────────────────────────────────────────
  const [code, setCode] = useState("");

  // ── Lobby state ───────────────────────────────────────────────
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameStartedRef = useRef(false);

  // ── API hooks ─────────────────────────────────────────────────
  const { data: teams = [], isLoading: isLoadingTeams } = useListTeams(
    { search: search.trim() ? search : undefined, sortBy: "level" },
    { query: { queryKey: getListTeamsQueryKey({ search: search.trim() ? search : undefined, sortBy: "level" }) } }
  );

  const teamId = player?.teamId ?? null;
  const { data: myTeam, refetch: refetchTeam } = useGetTeam(
    teamId!,
    { query: { enabled: !!teamId, queryKey: getGetTeamQueryKey(teamId!) } }
  );

  const createTeam = useCreateTeam();
  const joinTeam = useJoinTeam();
  const leaveTeam = useLeaveTeam();
  const redeemCode = useRedeemCode();

  const isCaptain = myTeam ? myTeam.captainId === player?.id : false;

  // ── Sync settings form when team loads ───────────────────────
  useEffect(() => {
    if (myTeam) {
      setSettingName(myTeam.name);
      setSettingMaxMembers(myTeam.maxMembers);
      setSettingMinLevel(myTeam.minLevelRequired);
    }
  }, [myTeam]);

  // ── Switch view when teamId changes ─────────────────────────
  useEffect(() => {
    if (player?.teamId) setView("myteam");
    else setView("browse");
  }, [player?.teamId]);

  // ── Lobby polling ─────────────────────────────────────────────
  const pollLobby = useCallback(async () => {
    if (!teamId || gameStartedRef.current) return;
    try {
      const state = await getLobby(teamId);
      setLobby(state);

      // Countdown logic — only show countdown until the server confirms the game has started
      if (state.countdownStart !== null && state.gameStartedAt === null) {
        const elapsed = (Date.now() - state.countdownStart) / 1000;
        const remaining = Math.max(0, COUNTDOWN_SECONDS - elapsed);
        setCountdown(Math.ceil(remaining));
      } else {
        setCountdown(null);
      }

      // Game start signal — driven by the server so every member transitions together
      if (state.gameStartedAt !== null && !gameStartedRef.current) {
        gameStartedRef.current = true;
        setGameStarted(true);
        setLocation(`/game?mode=team&teamId=${teamId}`);
      }

      // Invite notification
      if (state.inviteTimestamp && !isReady) {
        const age = Date.now() - state.inviteTimestamp;
        if (age < 5000) {
          toast({
            title: "📢 Invitation à jouer !",
            description: "Un membre de ta team veut jouer. Clique sur PRÊT !",
          });
        }
      }
    } catch {
      // silently ignore poll errors
    }
  }, [teamId, isReady, setLocation, toast]);

  useEffect(() => {
    if (!teamId) { setLobby(null); return; }
    pollLobby();
    pollRef.current = setInterval(pollLobby, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [teamId, pollLobby]);

  if (!player) {
    setLocation("/");
    return null;
  }

  // ── Handlers ─────────────────────────────────────────────────

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (player.level < 4) {
      toast({ title: "Niveau insuffisant", description: "Tu dois être de niveau 4.", variant: "destructive" });
      return;
    }
    if (player.teamId) {
      toast({ title: "Déjà dans une team", description: "Quitte ta team actuelle d'abord.", variant: "destructive" });
      return;
    }
    if (!teamName.trim()) return;

    createTeam.mutate(
      { data: { name: teamName.trim(), captainId: player.id, maxMembers, minLevelRequired: minLevel } },
      {
        onSuccess: (team) => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setShowCreateTeam(false);
          setTeamName("");
          setPlayer({ ...player, teamId: team.id });
          toast({ title: "Team créée !" });
        },
        onError: (err) => {
          toast({ title: "Erreur", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleJoinTeam = (tid: number, teamMinLevel: number) => {
    if (player.teamId) {
      toast({ title: "Déjà dans une team", description: "Quitte ta team actuelle d'abord.", variant: "destructive" });
      return;
    }
    if (player.level < teamMinLevel) {
      toast({ title: "Niveau insuffisant", description: `Niveau ${teamMinLevel} requis.`, variant: "destructive" });
      return;
    }
    joinTeam.mutate(
      { teamId: tid, data: { playerId: player.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setPlayer({ ...player, teamId: tid });
          toast({ title: "Team rejointe !" });
        },
        onError: (err) => {
          toast({ title: "Erreur", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleLeaveTeam = () => {
    if (!teamId) return;
    leaveTeam.mutate(
      { teamId, data: { playerId: player.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setPlayer({ ...player, teamId: null });
          setIsReady(false);
          toast({ title: "Tu as quitté la team." });
        },
        onError: () => toast({ title: "Erreur", variant: "destructive" })
      }
    );
  };

  const handleToggleReady = async () => {
    if (!teamId) return;
    try {
      if (isReady) {
        const state = await cancelReady(teamId, player.id);
        setLobby(state);
        setIsReady(false);
      } else {
        const state = await markReady(teamId, player.id);
        setLobby(state);
        setIsReady(true);
      }
    } catch (err) {
      toast({ title: "Erreur", description: String(err), variant: "destructive" });
    }
  };

  const handleSendInvite = async () => {
    if (!teamId) return;
    try {
      await sendInvite(teamId, player.id);
      toast({ title: "Invitation envoyée !", description: "Les membres ont été notifiés." });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleKick = async (memberId: number) => {
    if (!teamId) return;
    try {
      await kickMember(teamId, player.id, memberId);
      refetchTeam();
      toast({ title: "Membre exclu." });
    } catch (err) {
      toast({ title: "Erreur", description: String(err), variant: "destructive" });
    }
  };

  const handleTransfer = async (newCaptainId: number) => {
    if (!teamId) return;
    try {
      await transferOwnership(teamId, player.id, newCaptainId);
      refetchTeam();
      setPlayer({ ...player });
      toast({ title: "Propriété transférée !" });
    } catch (err) {
      toast({ title: "Erreur", description: String(err), variant: "destructive" });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;
    try {
      await updateTeamSettings(teamId, {
        name: settingName.trim() || undefined,
        maxMembers: settingMaxMembers,
        minLevelRequired: settingMinLevel,
      });
      refetchTeam();
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
      setShowSettings(false);
      toast({ title: "Paramètres mis à jour !" });
    } catch (err) {
      toast({ title: "Erreur", description: String(err), variant: "destructive" });
    }
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
          toast({ title: res.success ? "Code valide !" : "Code invalide", description: res.message, variant: res.success ? "default" : "destructive" });
        },
        onError: () => toast({ title: "Erreur de code", variant: "destructive" })
      }
    );
  };

  // ── Countdown display ─────────────────────────────────────────
  const readyCount = lobby?.ready?.length ?? 0;
  const countdownActive = countdown !== null;

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans flex flex-col md:flex-row gap-6">

      {/* Left Sidebar */}
      <div className="flex flex-col gap-3 w-full md:w-72 shrink-0">
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full justify-start h-12 text-base pixel-text border-2 hover:bg-muted">
            <ArrowLeft className="mr-2 h-4 w-4" /> RETOUR
          </Button>
        </Link>

        <div className="h-px bg-border" />

        <Button
          className="w-full justify-start h-14 text-base bg-primary hover:bg-primary/90 text-white pixel-text pixel-border shadow-[0_0_10px_rgba(255,0,85,0.4)]"
          onClick={() => setLocation("/game?mode=solo")}
        >
          <Play className="mr-2 h-5 w-5" /> PARTIE RAPIDE
        </Button>

        {player.teamId ? (
          <Button
            variant="outline"
            className={`w-full justify-start h-12 text-base border-2 pixel-text ${view === "myteam" ? "border-secondary text-secondary bg-secondary/10" : "border-secondary text-secondary hover:bg-secondary/10"}`}
            onClick={() => setView("myteam")}
          >
            <Users className="mr-2 h-4 w-4" /> MA TEAM
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              className="w-full justify-start h-12 text-base border-2 border-secondary text-secondary hover:bg-secondary/10 pixel-text"
              onClick={() => {
                if (player.level < 4) {
                  toast({ title: "Niveau insuffisant", description: "Niveau 4 requis.", variant: "destructive" });
                } else {
                  setShowCreateTeam(true);
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> CRÉER UNE TEAM
            </Button>
            <Button
              variant="outline"
              className={`w-full justify-start h-12 text-base border-2 pixel-text ${view === "browse" ? "border-muted-foreground/60 bg-muted/30" : "border-muted-foreground/30 hover:bg-muted/20"}`}
              onClick={() => setView("browse")}
            >
              <Users className="mr-2 h-4 w-4" /> REJOINDRE UNE TEAM
            </Button>
          </>
        )}

        <Link href="/leaderboard" className="w-full">
          <Button variant="outline" className="w-full justify-start h-12 text-base border-2 border-accent text-accent hover:bg-accent/10 pixel-text">
            <Trophy className="mr-2 h-4 w-4" /> CLASSEMENT
          </Button>
        </Link>

        <Button
          variant="outline"
          className="w-full justify-start h-12 text-base border-2 border-muted-foreground/50 text-muted-foreground hover:bg-muted pixel-text"
          onClick={() => setShowCode(true)}
        >
          <Key className="mr-2 h-4 w-4" /> CODE BOOST
        </Button>

        {/* Player card */}
        <div className="mt-auto p-3 border-2 border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 pixel-border shrink-0" style={{ backgroundColor: player.color }} />
            <div className="min-w-0">
              <div className="font-bold pixel-text text-sm truncate">{player.username}</div>
              <div className="text-muted-foreground text-xs font-mono mt-0.5">Niv. {player.level}</div>
              {player.teamId && myTeam && (
                <div className="text-secondary text-xs font-mono truncate">{myTeam.name}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">

        {/* ── MY TEAM VIEW ─────────────────────────────────────── */}
        {view === "myteam" && teamId && (
          <div className="flex-1 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between bg-card border-2 border-border p-4">
              <div>
                <div className="pixel-text text-xl text-secondary">{myTeam?.name ?? "Ma Team"}</div>
                <div className="font-mono text-sm text-muted-foreground mt-1">
                  {myTeam?.members?.length ?? 0}/{myTeam?.maxMembers ?? "?"} membres · Niv. requis : {myTeam?.minLevelRequired ?? 1}
                </div>
              </div>
              <div className="flex gap-2">
                {isCaptain && (
                  <Button size="icon" variant="outline" className="border-2" onClick={() => setShowSettings(true)} title="Paramètres">
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="outline" className="border-2 border-destructive text-destructive hover:bg-destructive/10" onClick={handleLeaveTeam} title="Quitter la team">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Members list */}
            <div className="bg-card border-2 border-border p-4 flex flex-col gap-2">
              <div className="pixel-text text-sm text-muted-foreground mb-2">MEMBRES</div>
              {(myTeam?.members ?? []).map(member => {
                const isThisCaptain = myTeam?.captainId === member.id;
                const isMe = member.id === player.id;
                const memberReady = lobby?.ready?.includes(member.id) ?? false;
                return (
                  <div key={member.id} className="flex items-center justify-between p-2 border border-border/50 bg-background">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 shrink-0" style={{ backgroundColor: member.color }} />
                      <span className="font-mono text-sm truncate">{member.username}</span>
                      {isThisCaptain && <Crown className="h-3 w-3 text-accent shrink-0" title="Capitaine" />}
                      {isMe && <span className="text-xs text-muted-foreground">(moi)</span>}
                      {memberReady && <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono text-xs text-muted-foreground">Niv.{member.level}</span>
                      {isCaptain && !isMe && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            title="Exclure"
                            onClick={() => handleKick(member.id)}
                          >
                            <UserMinus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-accent hover:bg-accent/10"
                            title="Transférer la propriété"
                            onClick={() => handleTransfer(member.id)}
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lobby / Play area */}
            <div className="bg-card border-2 border-border p-4 flex flex-col items-center gap-4">
              {countdownActive ? (
                <>
                  <div className="pixel-text text-5xl text-primary drop-shadow-[0_0_15px_rgba(255,0,85,0.8)]">
                    {countdown}
                  </div>
                  <div className="pixel-text text-white text-lg">Préparez-vous ! Le jeu commence...</div>
                  <div className="font-mono text-sm text-secondary">{readyCount} joueur(s) prêt(s)</div>
                </>
              ) : (
                <>
                  <div className="font-mono text-sm text-muted-foreground">
                    {readyCount < 2
                      ? `${readyCount} prêt — il faut au moins 2 joueurs pour lancer`
                      : `${readyCount} prêts — le compteur va démarrer !`}
                  </div>

                  <div className="flex gap-3 flex-wrap justify-center">
                    <Button
                      size="lg"
                      className={`pixel-text text-lg tracking-widest ${isReady ? "bg-green-600 hover:bg-green-700 border-green-400" : "bg-primary hover:bg-primary/90"} text-white border-2 border-border shadow-[0_0_10px_rgba(255,0,85,0.4)]`}
                      onClick={handleToggleReady}
                    >
                      {isReady ? "✓ PRÊT" : "JOUER EN TEAM"}
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      className="pixel-text text-base border-2 border-secondary text-secondary hover:bg-secondary/10"
                      onClick={handleSendInvite}
                      title="Inviter les membres à jouer"
                    >
                      <Send className="mr-2 h-4 w-4" /> INVITER
                    </Button>
                  </div>

                  {isReady && (
                    <div className="font-mono text-xs text-green-400 text-center">
                      En attente des autres membres... ({readyCount}/2 minimum)
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BROWSE TEAMS VIEW ─────────────────────────────────── */}
        {view === "browse" && (
          <>
            <div className="relative">
              <Input
                placeholder="Chercher une team..."
                className="h-12 pl-12 text-base border-2 bg-card rounded-none font-mono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
            </div>

            <div className="flex-1 bg-card border-4 border-border p-4 overflow-auto">
              <h2 className="pixel-text text-lg mb-4 text-white border-b-2 border-border pb-3">TEAMS DISPONIBLES</h2>

              {isLoadingTeams ? (
                <div className="text-center text-muted-foreground font-mono animate-pulse">CHARGEMENT...</div>
              ) : teams.length === 0 ? (
                <div className="text-center text-muted-foreground font-mono">Aucune team trouvée.</div>
              ) : (
                <div className="grid gap-3">
                  {teams.map(team => {
                    const isMine = player.teamId === team.id;
                    const full = (team.members?.length ?? 0) >= team.maxMembers;
                    const canJoin = !player.teamId && !full && player.level >= team.minLevelRequired;
                    return (
                      <div key={team.id} className={`flex items-center justify-between p-4 border-2 transition-colors bg-background ${isMine ? "border-secondary" : "border-border hover:border-primary/60"}`}>
                        <div className="min-w-0">
                          <div className="font-bold pixel-text text-primary truncate">{team.name}</div>
                          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground mt-1">
                            <span>Niv. requis: {team.minLevelRequired}</span>
                            <span>Membres: {team.members?.length ?? 0}/{team.maxMembers}</span>
                            <span>Niv. team: {team.level}</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-2 hover:bg-primary hover:text-white hover:border-primary pixel-text shrink-0 ml-2"
                          disabled={!canJoin && !isMine}
                          onClick={() => isMine ? setView("myteam") : handleJoinTeam(team.id, team.minLevelRequired)}
                        >
                          {isMine ? "MA TEAM" : full ? "PLEINE" : "REJOINDRE"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Dialogs ───────────────────────────────────────────── */}

      {/* Create Team */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="border-4 border-primary bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-primary">CRÉER UNE TEAM</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la team</Label>
              <Input value={teamName} onChange={e => setTeamName(e.target.value)} className="font-mono rounded-none border-2" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Membres Max</Label>
                <Input type="number" min={2} max={10} value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} className="font-mono rounded-none border-2" />
              </div>
              <div className="space-y-2">
                <Label>Niveau Requis</Label>
                <Input type="number" min={1} max={100} value={minLevel} onChange={e => setMinLevel(Number(e.target.value))} className="font-mono rounded-none border-2" />
              </div>
            </div>
            <Button type="submit" className="w-full pixel-text bg-primary hover:bg-primary/90 text-white rounded-none" disabled={createTeam.isPending}>
              CRÉER
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Team Settings (captain only) */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="border-4 border-secondary bg-background/95 backdrop-blur rounded-none max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-secondary">PARAMÈTRES DE LA TEAM</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la team</Label>
              <Input value={settingName} onChange={e => setSettingName(e.target.value)} className="font-mono rounded-none border-2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Membres Max</Label>
                <Input type="number" min={2} max={10} value={settingMaxMembers} onChange={e => setSettingMaxMembers(Number(e.target.value))} className="font-mono rounded-none border-2" />
              </div>
              <div className="space-y-2">
                <Label>Niveau Requis</Label>
                <Input type="number" min={1} max={100} value={settingMinLevel} onChange={e => setSettingMinLevel(Number(e.target.value))} className="font-mono rounded-none border-2" />
              </div>
            </div>
            <Button type="submit" className="w-full pixel-text bg-secondary hover:bg-secondary/90 text-black rounded-none">
              ENREGISTRER
            </Button>
          </form>

          {/* Kick / Transfer section */}
          {myTeam && myTeam.members.length > 1 && (
            <div className="mt-6 border-t-2 border-border pt-4">
              <div className="pixel-text text-sm text-muted-foreground mb-3">GESTION DES MEMBRES</div>
              <div className="flex flex-col gap-2">
                {myTeam.members.filter(m => m.id !== player.id).map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2 border border-border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5" style={{ backgroundColor: member.color }} />
                      <span className="font-mono text-sm">{member.username}</span>
                      <span className="font-mono text-xs text-muted-foreground">Niv.{member.level}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10 pixel-text" onClick={() => { handleKick(member.id); setShowSettings(false); }}>
                        EXCLURE
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-accent text-accent hover:bg-accent/10 pixel-text" onClick={() => { handleTransfer(member.id); setShowSettings(false); }}>
                        CAPITAINE
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Code Boost */}
      <Dialog open={showCode} onOpenChange={setShowCode}>
        <DialogContent className="border-4 border-accent bg-background/95 backdrop-blur rounded-none">
          <DialogHeader>
            <DialogTitle className="pixel-text text-xl text-accent">ENTRER UN CODE</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRedeemCode} className="space-y-4">
            <div className="space-y-2">
              <Label>Code Boost</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} className="font-mono rounded-none border-2 border-accent uppercase" required />
            </div>
            <Button type="submit" className="w-full pixel-text bg-accent hover:bg-accent/90 text-background rounded-none" disabled={redeemCode.isPending}>
              VALIDER
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
