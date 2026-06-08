import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Yo, Signal" },
      { name: "description", content: "Sign in to Yo, Signal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (res.error) {
      setError(res.error.message || "Google sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="font-mono text-[11px] tracking-[0.25em] uppercase">
          Yo, Signal
        </Link>
        <Link
          to="/"
          className="font-mono text-[11px] tracking-[0.22em] uppercase text-white/50 hover:text-white"
        >
          ← Back
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm py-16">
          <h1 className="font-serif text-4xl mb-2 text-balance">
            {mode === "signin" ? "Welcome back." : "Start your briefing."}
          </h1>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/50 mb-8">
            {mode === "signin" ? "Sign in to continue" : "Create your account"}
          </p>

          <button
            onClick={() => void handleGoogle()}
            disabled={loading}
            className="w-full border border-white/30 px-4 py-3 mb-6 hover:bg-white hover:text-black transition disabled:opacity-40 text-sm font-medium"
          >
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-white/15" />
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40">or</span>
            <div className="h-px flex-1 bg-white/15" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/50 block mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border border-white/30 px-3 py-2.5 outline-none focus:border-white text-sm"
                placeholder="you@startup.com"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/50 block mb-2">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-white/30 px-3 py-2.5 outline-none focus:border-white text-sm"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-xs text-red-400 border border-red-400/30 bg-red-400/10 p-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black px-4 py-3 font-medium hover:bg-white/90 transition disabled:opacity-40 text-sm"
            >
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white w-full text-center"
          >
            {mode === "signin" ? "No account? Sign up →" : "Have an account? Sign in →"}
          </button>
        </div>
      </main>
    </div>
  );
}