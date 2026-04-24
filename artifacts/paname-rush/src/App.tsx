import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Lobby from "@/pages/lobby";
import Locker from "@/pages/locker";
import ShopPage from "@/pages/shop-page";
import BattleRoyale from "@/pages/battle-royale";
import Leaderboard from "@/pages/leaderboard";
import Admin from "@/pages/admin";
import { DiscordProvider, useDiscord } from "@/hooks/use-discord";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/lobby" component={Lobby} />
      <Route path="/locker" component={Locker} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/battle-royale" component={BattleRoyale} />
      <Route path="/leaderboard" component={Leaderboard} />
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
          <div style={{fontSize:32,fontWeight:900,color:"#00d4ff",letterSpacing:2,marginBottom:12}}>
            PANAME<span style={{color:"#ffd700"}}>LEGEND</span>
          </div>
          <div style={{color:"#aaa",fontSize:14,animation:"pulse 1s infinite"}}>Chargement...</div>
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
