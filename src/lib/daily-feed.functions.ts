import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DailySignal {
  source: string;
  title: string;
  summary: string;
  why: string;
  tag: string;
  url: string;
  date?: string;
  relevance?: number;
  urgency?: string;
  matches?: string[];
}

export const getDailyFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("daily_feeds")
      .select("signals, generated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { signals: [] as DailySignal[], generatedAt: null as string | null };
    return {
      signals: ((data?.signals as unknown as DailySignal[] | null) ?? []),
      generatedAt: (data?.generated_at as string | null) ?? null,
    };
  });