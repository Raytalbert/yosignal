import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Onboarding, type StartupContext } from "@/components/Onboarding";
import { BriefingChat } from "@/components/BriefingChat";

const STORAGE_KEY = "cos.startup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chief of Staff — your morning intelligence briefing" },
      {
        name: "description",
        content:
          "An AI Chief of Staff for startup founders. Wake up to a personal briefing on what changed in your world overnight — and what to do about it today.",
      },
      { property: "og:title", content: "Chief of Staff" },
      {
        property: "og:description",
        content: "An AI Chief of Staff for startup founders. Information into decisions, before coffee.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [startup, setStartup] = useState<StartupContext | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStartup(JSON.parse(raw));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  function handleSubmit(ctx: StartupContext) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
    setStartup(ctx);
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setStartup(null);
  }

  if (!hydrated) return <div className="min-h-screen bg-background" />;

  return startup ? (
    <BriefingChat startup={startup} onReset={handleReset} />
  ) : (
    <Onboarding onSubmit={handleSubmit} />
  );
}
