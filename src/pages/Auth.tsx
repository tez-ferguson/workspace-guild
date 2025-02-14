
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/auth/AuthForm";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("Session found, redirecting to home");
        navigate("/");
      } else {
        console.log("No session found");
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session ? "Session exists" : "No session");
      if (session) {
        navigate("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-workspace-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">
            {isSignUp ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-sm text-workspace-500">
            {isSignUp
              ? "Sign up to start managing your workspaces"
              : "Sign in to your account"}
          </p>
        </div>
        <AuthForm
          isSignUp={isSignUp}
          onToggleMode={() => setIsSignUp(!isSignUp)}
        />
      </Card>
    </div>
  );
};

export default Auth;
