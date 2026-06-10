import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Onboarding, type StartupContext } from "@/components/Onboarding";
import { SignalFeed, DEFAULT_PREFS, type FeedPrefs } from "@/components/SignalFeed";

const startupKey = (uid: string) => `yosignal.startup.v3::${uid}`;
const prefsKey = (uid: string) => `yosignal.prefs.v2::${uid}`;

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [{ title: "Briefing — Yo, Signal" }],
  }),
  component: AppPage,
});

function AppPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [startup, setStartup] = useState<StartupContext | null>(null);
  const [prefs, setPrefs] = useState<FeedPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const session = data.session;
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      const uid = session.user.id;
      setUserId(uid);
      try {
        const raw = localStorage.getItem(startupKey(uid));
        if (raw) {
          setStartup(JSON.parse(raw));
        } else {
          // Fallback: restore from Supabase user metadata (survives device/browser change)
          const meta = session.user.user_metadata as Record<string, unknown> | null;
          const remote = meta?.yosignal_startup as StartupContext | undefined;
          if (remote && typeof remote === "object" && (remote as StartupContext).name) {
            setStartup(remote);
            localStorage.setItem(startupKey(uid), JSON.stringify(remote));
          }
        }
        const rawPrefs = localStorage.getItem(prefsKey(uid));
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
    // Intentionally keep per-user onboarding cached locally so re-login is instant.
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  function handleSubmit(ctx: StartupContext) {
    if (userId) localStorage.setItem(startupKey(userId), JSON.stringify(ctx));
    setStartup(ctx);
    // Mirror to Supabase user metadata so onboarding survives across devices.
    void supabase.auth.updateUser({ data: { yosignal_startup: ctx } }).catch(() => {});
  }

  function handleReset() {
    if (userId) localStorage.removeItem(startupKey(userId));
    void supabase.auth.updateUser({ data: { yosignal_startup: null } }).catch(() => {});
    setStartup(null);
  }

  function handlePrefsChange(next: FeedPrefs) {
    setPrefs(next);
    try {
      if (userId) localStorage.setItem(prefsKey(userId), JSON.stringify(next));
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