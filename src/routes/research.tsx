import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { StartupContext } from "@/components/Onboarding";
import { runPersonaResearch } from "@/lib/research.functions";

const startupKey = (uid: string) => `yosignal.startup.v3::${uid}`;

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [{ title: "Research — Yo, Signal" }],
  }),
  component: ResearchPage,
});

const EXAMPLE_PERSONAS = [
  "A worker who recently experienced workplace retaliation after reporting harassment, hasn't found legal help yet, frustrated and searching online",
  "A small business owner trying to figure out if they need an HR compliance tool",
  "An HR manager evaluating whether their current investigation process is defensible",
];

function ResearchPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [startup, setStartup] = useState<StartupContext | null>(null);
  const [persona, setPersona] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const research = useServerFn(runPersonaResearch);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const raw = localStorage.getItem(startupKey(session.user.id));
        if (raw) setStartup(JSON.parse(raw));
      } catch {
        /* ignore */
      }
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function runResearch() {
    if (!persona.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await research({
        data: {
          persona: persona.trim(),
          startupName: startup?.name ?? "your company",
          startupDescription: startup?.description ?? "",
        },
      });
      setResult(res.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground font-mono text-xs uppercase tracking-wider">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 sticky top-0 z-20 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-signal">Yo, Signal</span>
            <span className="font-serif italic text-sm text-muted-foreground">Research</span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/app" })}
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-signal transition"
          >
            ← Brief
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto w-full px-5 py-8 flex-1">
        <div className="space-y-2 mb-6">
          <h1 className="font-serif text-2xl text-balance leading-snug">
            Find out where your real users are stuck.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Describe a persona. Yo, Signal will search the web for real people matching it, and tell you what they're actually stuck on — in their own words.
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="e.g. A worker who recently experienced workplace retaliation after reporting harassment, hasn't found legal help yet, frustrated and searching online…"
            className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm outline-none focus:border-signal min-h-[100px] resize-none"
          />

          {!persona && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Or try one of these
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLE_PERSONAS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPersona(p)}
                    className="text-left text-sm font-serif italic text-foreground/80 border border-border/70 rounded-md px-3 py-2 hover:border-signal/60 hover:text-signal transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => void runResearch()}
            disabled={running || !persona.trim()}
            className="w-full bg-signal text-signal-foreground rounded-md px-4 py-3 text-sm font-medium disabled:opacity-40 transition"
          >
            {running ? "Searching the web…" : "Deploy research agent"}
          </button>

          {error && (
            <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}

          {running && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider py-2">
              <span className="animate-pulse">●</span> Yo, Signal is searching — this can take 30-60 seconds…
            </div>
          )}

          {result && (
            <div className="space-y-3 mt-4">
              <div className="bg-card border border-signal/30 rounded-lg p-5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-signal mb-3">Findings</p>
                <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {result}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="flex-1 text-xs font-mono uppercase tracking-wider text-muted-foreground border border-border/60 rounded-md py-2 hover:border-signal/60 hover:text-signal transition"
                >
                  Copy findings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setPersona("");
                  }}
                  className="flex-1 text-xs font-mono uppercase tracking-wider text-muted-foreground border border-border/60 rounded-md py-2 hover:border-signal/60 hover:text-signal transition"
                >
                  Run another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
