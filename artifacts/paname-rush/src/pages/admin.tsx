import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Edit2, Ban, ShieldCheck, Plus, RefreshCw } from "lucide-react";
import {
  isAdminPlayer,
  adminListTeams,
  adminDeleteTeam,
  adminRenameTeam,
  adminListPlayers,
  adminBanPlayer,
  adminUnbanPlayer,
  adminListCodes,
  adminDeleteCode,
} from "@/lib/admin";
import { useCreateCode } from "@workspace/api-client-react";
import type { Player, Team, BoostCode } from "@workspace/api-client-react";

type Tab = "teams" | "players" | "codes";
type TeamWithMembers = Team & { members: Player[] };

const BOOST_TYPES: { value: string; label: string; help: string }[] = [
  { value: "coins", label: "Coins", help: "Ajoute le nombre de coins indiqué (champ Valeur)." },
  { value: "skip_parcours", label: "Skip parcours", help: "Permet au joueur de sauter X parcours." },
  { value: "skip_level", label: "Skip niveau", help: "Permet au joueur de sauter X niveaux entiers." },
  { value: "protection_parcours", label: "Protection parcours", help: "Immunité pendant un parcours." },
  { value: "protection_level", label: "Protection niveau", help: "Immunité pendant tout un niveau." },
];

export default function Admin() {
  const [, setLocation] = useLocation();
  const { player } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("teams");
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [codes, setCodes] = useState<BoostCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [renamingTeamId, setRenamingTeamId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Code creation form
  const [codeText, setCodeText] = useState("");
  const [boostType, setBoostType] = useState<string>("coins");
  const [boostValue, setBoostValue] = useState<number>(200);
  const createCode = useCreateCode();

  const admin = isAdminPlayer(player);

  // ── Redirect non-admins ─────────────────────────────────────
  useEffect(() => {
    if (!admin) {
      setLocation("/");
    }
  }, [admin, setLocation]);

  const refresh = async (which: Tab = tab) => {
    setLoading(true);
    try {
      if (which === "teams") setTeams(await adminListTeams());
      if (which === "players") setPlayers(await adminListPlayers());
      if (which === "codes") setCodes(await adminListCodes());
    } catch (e) {
      toast({ title: "Erreur", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) refresh(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, admin]);

  if (!admin) return null;

  const handleDeleteTeam = async (id: number) => {
    if (!confirm("Supprimer définitivement cette team ?")) return;
    try {
      await adminDeleteTeam(id);
      toast({ title: "Team supprimée" });
      refresh("teams");
    } catch (e) {
      toast({ title: "Erreur", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    }
  };

  const handleRenameTeam = async (id: number) => {
    const name = renameValue.trim();
    if (!name) return;
    try {
      await adminRenameTeam(id, name);
      toast({ title: "Team renommée" });
      setRenamingTeamId(null);
      setRenameValue("");
      refresh("teams");
    } catch (e) {
      toast({ title: "Erreur", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    }
  };

  const handleToggleBan = async (p: Player) => {
    try {
      if (p.banned) await adminUnbanPlayer(p.id);
      else await adminBanPlayer(p.id);
      toast({ title: p.banned ? "Joueur débanni" : "Joueur banni" });
      refresh("players");
    } catch (e) {
      toast({ title: "Erreur", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    }
  };

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = codeText.trim().toUpperCase();
    if (!code) return;
    createCode.mutate(
      { data: { code, boostType: boostType as never, value: boostValue } },
      {
        onSuccess: () => {
          toast({ title: "Code créé", description: code });
          setCodeText("");
          refresh("codes");
        },
        onError: (err) => {
          toast({
            title: "Erreur",
            description: err instanceof Error ? err.message : "Impossible de créer le code",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDeleteCode = async (id: number) => {
    if (!confirm("Supprimer ce code ?")) return;
    try {
      await adminDeleteCode(id);
      toast({ title: "Code supprimé" });
      refresh("codes");
    } catch (e) {
      toast({ title: "Erreur", description: String(e instanceof Error ? e.message : e), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/game-mode">
              <Button variant="outline" size="icon" className="border-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="pixel-text text-2xl md:text-3xl text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]">
              ADMIN PANEL
            </h1>
          </div>
          <Button variant="outline" size="icon" onClick={() => refresh()} disabled={loading} title="Rafraîchir">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          {(["teams", "players", "codes"] as Tab[]).map((t) => (
            <Button
              key={t}
              variant={tab === t ? "default" : "outline"}
              className={`pixel-text ${tab === t ? "bg-red-500 hover:bg-red-600 text-white" : "border-red-500/50 text-red-300"}`}
              onClick={() => setTab(t)}
            >
              {t === "teams" ? "TEAMS" : t === "players" ? "JOUEURS" : "CODES"}
            </Button>
          ))}
        </div>

        {tab === "teams" && (
          <div className="space-y-2">
            {teams.length === 0 && <p className="text-muted-foreground font-mono">Aucune team.</p>}
            {teams.map((team) => (
              <div key={team.id} className="border-2 border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  {renamingTeamId === team.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8 w-48"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleRenameTeam(team.id)}>OK</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRenamingTeamId(null); setRenameValue(""); }}>X</Button>
                    </div>
                  ) : (
                    <>
                      <div className="pixel-text text-base text-secondary">{team.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">
                        Niv. {team.level} · {team.members.length}/{team.maxMembers} membres · ID {team.id}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRenamingTeamId(team.id); setRenameValue(team.name); }}
                  >
                    <Edit2 className="h-3 w-3 mr-1" /> Renommer
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteTeam(team.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "players" && (
          <div className="space-y-2">
            {players.length === 0 && <p className="text-muted-foreground font-mono">Aucun joueur.</p>}
            {players.map((p) => (
              <div key={p.id} className="border-2 border-border bg-card p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 pixel-border shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="min-w-0">
                    <div className="pixel-text text-sm truncate">
                      {p.username}
                      {p.banned && <span className="ml-2 text-destructive text-xs">[BANNI]</span>}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      ID {p.id} · Niv. {p.level} · {p.coins ?? 0} coins
                      {p.discordId && <> · DiscordID {p.discordId}</>}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={p.banned ? "outline" : "destructive"}
                  onClick={() => handleToggleBan(p)}
                  disabled={p.discordId === player?.discordId}
                  title={p.discordId === player?.discordId ? "Tu ne peux pas te bannir toi-même" : ""}
                >
                  {p.banned ? <><ShieldCheck className="h-3 w-3 mr-1" /> Débannir</> : <><Ban className="h-3 w-3 mr-1" /> Bannir</>}
                </Button>
              </div>
            ))}
          </div>
        )}

        {tab === "codes" && (
          <div className="space-y-4">
            <form onSubmit={handleCreateCode} className="border-2 border-red-500/50 bg-card p-4 space-y-3">
              <div className="pixel-text text-base text-red-300">CRÉER UN CODE BOOST</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-mono">Code</Label>
                  <Input
                    value={codeText}
                    onChange={(e) => setCodeText(e.target.value)}
                    placeholder="SALLY200"
                    className="h-9 font-mono uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs font-mono">Type</Label>
                  <select
                    value={boostType}
                    onChange={(e) => setBoostType(e.target.value)}
                    className="w-full h-9 bg-background border border-input px-2 font-mono text-sm rounded-md"
                  >
                    {BOOST_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-mono">Valeur</Label>
                  <Input
                    type="number"
                    value={boostValue}
                    onChange={(e) => setBoostValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-9 font-mono"
                    min={1}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {BOOST_TYPES.find(b => b.value === boostType)?.help}
              </p>
              <Button type="submit" disabled={createCode.isPending || !codeText.trim()} className="bg-red-500 hover:bg-red-600 text-white pixel-text">
                <Plus className="h-4 w-4 mr-1" /> CRÉER
              </Button>
            </form>

            <div className="space-y-2">
              {codes.length === 0 && <p className="text-muted-foreground font-mono">Aucun code.</p>}
              {codes.map((c) => (
                <div key={c.id} className="border-2 border-border bg-card p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="pixel-text text-sm font-mono">{c.code}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {BOOST_TYPES.find(b => b.value === c.boostType)?.label ?? c.boostType} · valeur {c.value}
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => handleDeleteCode(c.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
