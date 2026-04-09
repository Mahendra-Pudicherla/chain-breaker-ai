import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PrivateRoute from "@/components/PrivateRoute";
import { useAuthStore } from "@/store/authStore";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NewScan from "@/pages/NewScan";
import LiveScan from "@/pages/LiveScan";
import Report from "@/pages/Report";
import ScanHistory from "@/pages/ScanHistory";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    const unsub = initialize();
    return unsub;
  }, [initialize]);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthInitializer>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/scan/new" element={<PrivateRoute><NewScan /></PrivateRoute>} />
            <Route path="/scan/:scanId/live" element={<PrivateRoute><LiveScan /></PrivateRoute>} />
            <Route path="/scan/:scanId/report" element={<PrivateRoute><Report /></PrivateRoute>} />
            <Route path="/scans" element={<PrivateRoute><ScanHistory /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthInitializer>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
