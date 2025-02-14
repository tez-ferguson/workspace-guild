
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log("Attempting to sign in with:", { email });
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
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
        console.log("Sign in successful, session created");
        toast({
          title: "Success",
          description: "Signed in successfully",
        });
        navigate("/");
      } else {
        throw new Error("Failed to create session. Please try again.");
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

  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        toast({
          title: "Error",
          description: "This email is already registered. Please sign in instead.",
          variant: "destructive",
        });
        return false;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          throw new Error("This email is already registered. Please sign in instead.");
        }
        throw signUpError;
      }

      if (authData.user) {
        const { error: insertError } = await supabase
          .from("users")
          .insert([{ id: authData.user.id, email, name }]);

        if (insertError) {
          console.error("Error creating user profile:", insertError);
          await supabase.auth.signOut();
          throw new Error("Failed to create user profile. Please try again.");
        }

        toast({
          title: "Success",
          description: "Account created successfully. Please check your email for verification.",
        });
        return true;
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
    return false;
  };

  return {
    isLoading,
    signIn,
    signUp,
  };
};
