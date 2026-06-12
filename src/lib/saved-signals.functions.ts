import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignalSchema = z.object({
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

export type SavedSignal = z.infer<typeof SignalSchema> & { saved_at?: string };

export const listSavedSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("saved_signals")
      .select("signal, saved_at, url")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(200);
    if (error) return { items: [] as SavedSignal[] };
    const items = (data ?? []).map((r) => ({
      ...(r.signal as SavedSignal),
      saved_at: r.saved_at as string,
    }));
    return { items };
  });

export const saveSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ signal: SignalSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("saved_signals").upsert(
      {
        user_id: userId,
        url: data.signal.url,
        signal: data.signal as unknown as never,
      },
      { onConflict: "user_id,url" },
    );
    if (error) throw new Error("Could not save article.");
    return { ok: true };
  });

export const unsaveSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("saved_signals")
      .delete()
      .eq("user_id", userId)
      .eq("url", data.url);
    if (error) throw new Error("Could not unsave article.");
    return { ok: true };
  });