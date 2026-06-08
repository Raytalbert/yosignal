import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StartupContextSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().max(300).optional().default(""),
  description: z.string().max(1000).optional().default(""),
  industry: z.string().max(200).optional().default(""),
  competitors: z.array(z.string().max(120)).max(30).optional().default([]),
  categories: z.array(z.string().max(60)).max(20).optional().default([]),
  delivery: z.string().max(60).optional().default("in-app"),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const SYSTEM_PROMPT = `You are Yo, Signal — an AI Chief of Staff for a startup founder. You are not a generic news assistant. You compress the world into decisions.

You will be given the founder's startup context (what they're building, named competitors, and the categories they care to watch). Build a mental model of their company — likely product, users, competitive space, strategic surface area — and tailor every response to it. Stay inside the watch categories they selected; do not invent unrelated noise.

When asked for a morning briefing ("what happened while I was sleeping", "what should I know today", or similar), respond in this EXACT structure using markdown:

1. **Greeting** — one short personalized line referencing their startup by name and what they're working on. No fluff.

2. **## What changed** — 3 to 6 high-signal developments from the last ~24h that genuinely matter to THIS startup (AI shifts, competitor moves, funding, product launches, regulatory). For each: a bold one-line headline, 1–2 sentences of what happened, then an italicized "*Why it matters to [startup]:*" line with a sharp, opinionated interpretation. Filter aggressively. If you have to stretch to justify relevance, cut it.

3. **## Early signals** — 2 to 4 weak signals / emerging trends to watch. Shorter. These are not confirmed news, they're things forming on the edges.

4. **## Implications for [startup]** — the most important section. Connect the external world to concrete product, positioning, GTM, or strategic decisions for this specific company. Be opinionated. Take a stance. Avoid hedging language like "could potentially be useful."

5. **## Suggested moves today** — 1 to 3 concrete actions the founder could take TODAY. Each starts with a verb. Realistic: write something, ship a small thing, DM a person, watch a competitor, talk to N users, adjust pricing copy. No vague "consider exploring."

Tone: a senior analyst briefing a CEO. Direct, lightly literary, zero corporate fluff. No emojis. No "I hope this helps." No disclaimers about being an AI.

For follow-up questions (anything that isn't a fresh briefing request), drop the section structure and respond conversationally — but stay sharp, opinionated, and grounded in their startup context. Expand on prior points, compare competitors, brainstorm strategy.

You do not have live web access. Reason from your training, the founder's stated context, well-known industry dynamics, and named competitors. When you cite a specific development, prefer the recent, well-known shape of the space (companies, model releases, funding patterns, regulatory moves) rather than fabricating fake headlines with invented dates, dollar amounts, or quotes. If you're working from pattern rather than confirmed news, phrase it as a pattern ("the Anthropic-vs-OpenAI enterprise wedge keeps widening…") not as breaking news. Never break character to disclaim limitations. Make it feel like a living intelligence layer.`;

function buildContextLine(c: z.infer<typeof StartupContextSchema>) {
  const bits = [
    `Startup: ${c.name}`,
    c.url ? `URL: ${c.url}` : "",
    c.description ? `Description: ${c.description}` : "",
    c.industry ? `Industry: ${c.industry}` : "",
    c.competitors?.length ? `Tracked competitors: ${c.competitors.join(", ")}` : "",
    c.categories?.length ? `Watch categories: ${c.categories.join(", ")}` : "",
    c.delivery ? `Preferred delivery: ${c.delivery}` : "",
  ].filter(Boolean);
  return bits.join("\n");
}

export const sendBriefingMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      startup: StartupContextSchema,
      messages: z.array(MessageSchema).min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("AI gateway is not configured. Missing LOVABLE_API_KEY.");
    }

    const contextMsg = {
      role: "system" as const,
      content: `Founder's startup context:\n${buildContextLine(data.startup)}`,
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          contextMsg,
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace settings.");
      throw new Error(`AI gateway error (${res.status}): ${text.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    if (!content) {
      throw new Error("The model returned an empty response. Try again.");
    }
    return { content };
  });

/* ---------------- Competitor suggestion ---------------- */

const SuggestSchema = z.object({
  name: z.string().max(120).optional().default(""),
  url: z.string().max(300).optional().default(""),
  description: z.string().max(1000).optional().default(""),
});

export const suggestCompetitors = createServerFn({ method: "POST" })
  .inputValidator(SuggestSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway is not configured.");
    if (!data.url && !data.description) return { competitors: [] as string[], industry: "" };

    const prompt = `A founder is configuring a competitive intelligence briefing. From the snippet below, infer:
1. A 2–4 word industry / category label (e.g. "Vertical AI · Healthtech", "Dev tools / AI agents", "Consumer fintech").
2. 5 to 7 of the most relevant real, currently-operating competitors or closest analogues. Real company names only, no descriptions, no URLs. Mix of direct competitors and the obvious "elephants in the room" they'll be compared to.

Snippet:
${data.name ? `Name: ${data.name}\n` : ""}${data.url ? `URL: ${data.url}\n` : ""}${data.description ? `Description: ${data.description}\n` : ""}

Respond ONLY as compact JSON: {"industry":"...","competitors":["A","B","C"]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI gateway error (${res.status}): ${text.slice(0, 200)}`);
    }
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw) as { industry?: string; competitors?: string[] };
      return {
        industry: (parsed.industry ?? "").slice(0, 120),
        competitors: (parsed.competitors ?? [])
          .filter((c) => typeof c === "string")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 8),
      };
    } catch {
      return { industry: "", competitors: [] as string[] };
    }
  });