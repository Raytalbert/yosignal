import { createFileRoute } from "@tanstack/react-router";
import { runFeedGeneration, type FeedStartup, type FeedPrefsT } from "@/lib/feed.functions";

export const Route = createFileRoute("/api/public/hooks/morning-brief")({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Walk auth.users via admin API and pick those that have onboarded.
        const targets: Array<{ id: string; startup: FeedStartup; prefs?: FeedPrefsT }> = [];
        let page = 1;
        const perPage = 200;
        while (true) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (error) break;
          for (const u of data.users) {
            const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
            const startup = meta.yosignal_startup as FeedStartup | undefined;
            if (startup && typeof startup === "object" && startup.name) {
              targets.push({ id: u.id, startup });
            }
          }
          if (data.users.length < perPage) break;
          page += 1;
          if (page > 25) break; // safety cap
        }

        const results = await Promise.allSettled(
          targets.map(async (t) => {
            const out = await runFeedGeneration(t.startup, t.prefs, apiKey);
            if (out.signals.length > 0) {
              await supabaseAdmin.from("daily_feeds").upsert({
                user_id: t.id,
                signals: out.signals as unknown as never,
                generated_at: new Date().toISOString(),
              });
            }
            return t.id;
          }),
        );

        const ok = results.filter((r) => r.status === "fulfilled").length;
        return new Response(
          JSON.stringify({ processed: ok, total: targets.length }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});