import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import FreeQuiz from "@/pages/FreeQuiz";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Lessons from "@/pages/Lessons";
import Rewards from "@/pages/Rewards";
import Premium from "@/pages/Premium";
import NotFound from "@/pages/not-found";
import { useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={FreeQuiz} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/lessons" component={Lessons} />
      <Route path="/rewards" component={Rewards} />
      <Route path="/premium" component={Premium} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen">
          {isLoggedIn && (
            <Navbar
              isLoggedIn={isLoggedIn}
              username="Arun Kumar"
              onLogin={() => setIsLoggedIn(true)}
              onLogout={() => setIsLoggedIn(false)}
            />
          )}
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
