
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Basic validation
      if (!email || !password) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (isSignUp) {
        if (!name) {
          toast({
            title: "Error",
            description: "Name is required for signup",
            variant: "destructive",
          });
          return;
        }

        // Check if user already exists in our users table
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (existingUser) {
          toast({
            title: "Error",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
          setIsSignUp(false);
          setPassword("");
          return;
        }

        // First, try to sign up the user
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              name: name,
            },
          },
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            throw new Error("This email is already registered. Please sign in instead.");
          }
          throw signUpError;
        }

        if (authData.user) {
          try {
            const { error: insertError } = await supabase
              .from("users")
              .insert([{ id: authData.user.id, email: normalizedEmail, name }]);

            if (insertError) {
              console.error("Error creating user profile:", insertError);
              // If we fail to create the profile, we should clean up the auth user
              await supabase.auth.signOut();
              throw new Error("Failed to create user profile. Please try again.");
            }

            toast({
              title: "Success",
              description: "Account created successfully. Please check your email for verification.",
            });

            // Switch to sign in mode
            setIsSignUp(false);
            setPassword("");
          } catch (error) {
            throw error;
          }
        }
      } else {
        // Regular sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInError) {
          console.error("Sign in error:", signInError);
          if (signInError.message.includes("Invalid login credentials")) {
            throw new Error("Invalid email or password. Please check your credentials and try again.");
          }
          throw signInError;
        }

        if (data?.session) {
          toast({
            title: "Success",
            description: "Signed in successfully",
          });
          navigate("/");
        } else {
          throw new Error("Failed to create session. Please try again.");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              placeholder="your@email.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? "Loading..."
              : isSignUp
              ? "Create account"
              : "Sign in"}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setPassword("");
              setName("");
            }}
            className="text-sm text-workspace-600 hover:underline"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
