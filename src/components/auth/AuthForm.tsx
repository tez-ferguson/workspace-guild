
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

interface AuthFormProps {
  isSignUp: boolean;
  onToggleMode: () => void;
}

export const AuthForm = ({ isSignUp, onToggleMode }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { isLoading, signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (isSignUp) {
      if (!name) return;
      const success = await signUp(normalizedEmail, password, name);
      if (success) {
        onToggleMode();
        setPassword("");
      }
    } else {
      await signIn(normalizedEmail, password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        {isLoading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            onToggleMode();
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
    </form>
  );
};
