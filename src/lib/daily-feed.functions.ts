import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

const DailySignalSchema = z.object({
  source: z.string(),
  title: z.string(),
  summary: z.string(),
  why: z.string(),
  tag: z.string(),
  url: z.string(),
  date: z.string().optional(),
  relevance: z.number().optional(),
  urgency: z.string().optional(),
  matches: z.array(z.string()).optional(),
});

export const FEED_FRESH_MS = 6 * 60 * 60 * 1000;

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

export const saveDailyFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      signals: z.array(DailySignalSchema).min(1).max(50),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const generatedAt = new Date().toISOString();
    const { error } = await supabase.from("daily_feeds").upsert({
      user_id: userId,
      signals: data.signals as unknown as never,
      generated_at: generatedAt,
    });
    if (error) throw new Error("Failed to save your feed.");
    return { generatedAt };
  });