import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Onboarding, type StartupContext } from "@/components/Onboarding";
import { SignalFeed, DEFAULT_PREFS, type FeedPrefs } from "@/components/SignalFeed";

const STORAGE_KEY = "yosignal.startup.v2";
const PREFS_KEY = "yosignal.prefs.v1";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Briefing — Yo, Signal" }],
  }),
  component: AppPage,
});

function AppPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [startup, setStartup] = useState<StartupContext | null>(null);
  const [prefs, setPrefs] = useState<FeedPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setStartup(JSON.parse(raw));
        const rawPrefs = localStorage.getItem(PREFS_KEY);
        if (rawPrefs) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(rawPrefs) });
      } catch {
        /* ignore */
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSignOut() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREFS_KEY);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  function handleSubmit(ctx: StartupContext) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    setStartup(ctx);
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setStartup(null);
  }

  function handlePrefsChange(next: FeedPrefs) {
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  if (!ready) return <div className="min-h-screen bg-background" />;

  return startup ? (
    <SignalFeed
      startup={startup}
      prefs={prefs}
      onPrefsChange={handlePrefsChange}
      onReset={handleReset}
      onSignOut={handleSignOut}
    />
  ) : (
    <Onboarding onSubmit={handleSubmit} />
  );
}