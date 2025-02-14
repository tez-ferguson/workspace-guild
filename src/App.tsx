
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import WorkspaceDetails from "./pages/WorkspaceDetails";
import BoardDetails from "./pages/BoardDetails";
import { useEffect, useState } from "react";
import { supabase } from "./integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    } catch (error) {
      setIsAuthenticated(false);
    }
  }

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  // Render children if authenticated
  return <>{children}</>;
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:id"
            element={
              <ProtectedRoute>
                <WorkspaceDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/boards/:id"
            element={
              <ProtectedRoute>
                <BoardDetails />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
