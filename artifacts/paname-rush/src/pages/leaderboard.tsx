import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetIndividualLeaderboard, 
  useGetTeamLeaderboard,
  getGetIndividualLeaderboardQueryKey,
  getGetTeamLeaderboardQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, User, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Leaderboard() {
  const [tab, setTab] = useState("individual");

  const { data: individualLeaderboard = [], isLoading: isLoadingIndividual } = useGetIndividualLeaderboard(
    { sortBy: "level" },
    { query: { queryKey: getGetIndividualLeaderboardQueryKey({ sortBy: "level" }) } }
  );

  const { data: teamLeaderboard = [], isLoading: isLoadingTeam } = useGetTeamLeaderboard(
    { sortBy: "level" },
    { query: { queryKey: getGetTeamLeaderboardQueryKey({ sortBy: "level" }) } }
  );

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 font-sans flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b-4 border-border pb-6">
        <Link href="/game-mode">
          <Button variant="outline" className="h-12 border-2 hover:bg-muted pixel-text">
            <ArrowLeft className="mr-2 h-4 w-4" /> RETOUR
          </Button>
        </Link>
        <h1 className="text-3xl md:text-5xl font-bold pixel-text text-accent flex items-center drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">
          <Trophy className="mr-4 h-10 w-10" /> CLASSEMENT
        </h1>
        <div className="w-24"></div> {/* Spacer for center alignment */}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-16 bg-card border-4 border-border rounded-none p-1">
          <TabsTrigger value="individual" className="text-lg pixel-text data-[state=active]:bg-primary data-[state=active]:text-white rounded-none">
            <User className="mr-2 h-5 w-5" /> INDIVIDUEL
          </TabsTrigger>
          <TabsTrigger value="team" className="text-lg pixel-text data-[state=active]:bg-secondary data-[state=active]:text-white rounded-none">
            <Users className="mr-2 h-5 w-5" /> TEAM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="mt-8">
          <div className="bg-card border-4 border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b-4 border-border bg-muted text-muted-foreground font-bold pixel-text text-sm">
              <div className="col-span-2 text-center">RANG</div>
              <div className="col-span-6">JOUEUR</div>
              <div className="col-span-2 text-center">NIVEAU</div>
              <div className="col-span-2 text-right">TEMPS</div>
            </div>
            
            {isLoadingIndividual ? (
              <div className="p-8 text-center text-muted-foreground font-mono animate-pulse">CHARGEMENT...</div>
            ) : individualLeaderboard.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">Aucun joueur classe.</div>
            ) : (
              <div className="flex flex-col">
                {individualLeaderboard.map((entry, i) => (
                  <div key={entry.playerId} className={`grid grid-cols-12 gap-4 p-4 border-b-2 border-border items-center font-mono ${i < 3 ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                    <div className="col-span-2 text-center font-bold text-xl">
                      {entry.rank === 1 ? <span className="text-accent">#1</span> : 
                       entry.rank === 2 ? <span className="text-gray-300">#2</span> : 
                       entry.rank === 3 ? <span className="text-orange-400">#3</span> : 
                       <span className="text-muted-foreground">#{entry.rank}</span>}
                    </div>
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-6 h-6 border border-border" style={{ backgroundColor: entry.color }} />
                      <span className="font-bold text-lg">{entry.username}</span>
                    </div>
                    <div className="col-span-2 text-center text-secondary font-bold">{entry.level}</div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {entry.bestTime ? `${entry.bestTime.toFixed(1)}s` : '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-8">
          <div className="bg-card border-4 border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b-4 border-border bg-muted text-muted-foreground font-bold pixel-text text-sm">
              <div className="col-span-2 text-center">RANG</div>
              <div className="col-span-5">TEAM</div>
              <div className="col-span-2 text-center">MEMBRES</div>
              <div className="col-span-1 text-center">NIV.</div>
              <div className="col-span-2 text-right">TEMPS</div>
            </div>
            
            {isLoadingTeam ? (
              <div className="p-8 text-center text-muted-foreground font-mono animate-pulse">CHARGEMENT...</div>
            ) : teamLeaderboard.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono">Aucune team classee.</div>
            ) : (
              <div className="flex flex-col">
                {teamLeaderboard.map((entry, i) => (
                  <div key={entry.teamId} className={`grid grid-cols-12 gap-4 p-4 border-b-2 border-border items-center font-mono ${i < 3 ? 'bg-secondary/10' : 'hover:bg-muted/50'}`}>
                    <div className="col-span-2 text-center font-bold text-xl">
                      {entry.rank === 1 ? <span className="text-accent">#1</span> : 
                       entry.rank === 2 ? <span className="text-gray-300">#2</span> : 
                       entry.rank === 3 ? <span className="text-orange-400">#3</span> : 
                       <span className="text-muted-foreground">#{entry.rank}</span>}
                    </div>
                    <div className="col-span-5 font-bold text-lg text-primary">{entry.teamName}</div>
                    <div className="col-span-2 text-center">{entry.memberCount}</div>
                    <div className="col-span-1 text-center text-secondary font-bold">{entry.level}</div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {entry.bestTime ? `${entry.bestTime.toFixed(1)}s` : '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
