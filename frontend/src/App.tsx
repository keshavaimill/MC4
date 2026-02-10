import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Executive from "./pages/Executive";
import Demand from "./pages/Demand";
import Planning from "./pages/Planning";
import Operations from "./pages/Operations";
import Materials from "./pages/Materials";
import WastePage from "./pages/WastePage";
import Scenarios from "./pages/Scenarios";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FilterProvider } from "./context/FilterContext";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking access...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FilterProvider>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Executive />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/demand"
                element={
                  <ProtectedRoute>
                    <Demand />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/planning"
                element={
                  <ProtectedRoute>
                    <Planning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/operations"
                element={
                  <ProtectedRoute>
                    <Operations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materials"
                element={
                  <ProtectedRoute>
                    <Materials />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/waste"
                element={
                  <ProtectedRoute>
                    <WastePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scenarios"
                element={
                  <ProtectedRoute>
                    <Scenarios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute>
                    <Alerts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FilterProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
