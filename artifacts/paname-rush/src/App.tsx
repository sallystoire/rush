import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import GameMode from "@/pages/game-mode";
import Leaderboard from "@/pages/leaderboard";
import Game from "@/pages/game";
import Admin from "@/pages/admin";
import { DiscordProvider, useDiscord } from "@/hooks/use-discord";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/game-mode" component={GameMode} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/game" component={Game} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { ready } = useDiscord();

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-white pixel-text mb-4">PANAME RUSH</div>
          <div className="text-muted-foreground pixel-text animate-pulse">Connexion Discord...</div>
        </div>
      </div>
    );
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DiscordProvider>
          <AppContent />
        </DiscordProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
