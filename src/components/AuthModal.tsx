import { FormEvent, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

const AuthModal = ({ onClose, prompt }: { onClose: () => void; prompt?: string }) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      toast({ title: mode === "signup" ? "Check your email" : "Signed in", description: mode === "signup" ? "Confirm your email before signing in." : "You can now review and save dishes." });
      if (mode === "signin") onClose();
    } catch (error) {
      toast({ title: "Sign-in failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/` });
    if (result.redirected) return;
    if (result.error) toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
    else onClose();
  };

  return <div className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-foreground/30 p-3 backdrop-blur-sm md:items-center md:justify-center"><div className="max-h-[calc(100svh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg border bg-card p-5 shadow-[var(--shadow-editorial)] md:max-w-md"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-primary">{prompt || "Account required for this action"}</p><h2 className="font-display text-3xl font-black">{mode === "signup" ? "Create your food passport" : "Sign in to continue"}</h2><div className="mt-3 grid gap-2 text-sm font-bold text-secondary"><p>Save dishes you want to try</p><p>Track your favorite meals</p></div></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X /></Button></div><form onSubmit={submit} className="space-y-3"><Input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /><Button className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />}{mode === "signup" ? "Sign up" : "Sign in"}</Button></form><Button variant="outline" className="mt-3 w-full" onClick={googleSignIn}>Continue with Google</Button><button className="mt-4 text-sm font-bold text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</button></div></div>;
};

export default AuthModal;