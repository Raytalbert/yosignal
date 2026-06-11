import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDailyFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("daily_feeds")
      .select("signals, generated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { signals: [], generatedAt: null as string | null };
    return {
      signals: (data?.signals as unknown[]) ?? [],
      generatedAt: (data?.generated_at as string | null) ?? null,
    };
  });