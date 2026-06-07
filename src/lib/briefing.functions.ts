import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StartupContextSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().max(300).optional().default(""),
  description: z.string().max(1000).optional().default(""),
  industry: z.string().max(200).optional().default(""),
  competitors: z.string().max(500).optional().default(""),
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const SYSTEM_PROMPT = `You are an AI Chief of Staff for a startup founder. You are not a generic news assistant. You compress the world into decisions.

You will be given the founder's startup context. Build a mental model of their company — likely product, users, competitive space, strategic surface area — and tailor every response to it.

When asked for a morning briefing ("what happened while I was sleeping", "what should I know today", or similar), respond in this EXACT structure using markdown:

1. **Greeting** — one short personalized line referencing their startup by name and what they're working on. No fluff.

2. **## What changed** — 3 to 6 high-signal developments from the last ~24h that genuinely matter to THIS startup (AI shifts, competitor moves, funding, product launches, regulatory). For each: a bold one-line headline, 1–2 sentences of what happened, then an italicized "*Why it matters to [startup]:*" line with a sharp, opinionated interpretation. Filter aggressively. If you have to stretch to justify relevance, cut it.

3. **## Early signals** — 2 to 4 weak signals / emerging trends to watch. Shorter. These are not confirmed news, they're things forming on the edges.

4. **## Implications for [startup]** — the most important section. Connect the external world to concrete product, positioning, GTM, or strategic decisions for this specific company. Be opinionated. Take a stance. Avoid hedging language like "could potentially be useful."

5. **## Suggested moves today** — 1 to 3 concrete actions the founder could take TODAY. Each starts with a verb. Realistic: write something, ship a small thing, DM a person, watch a competitor, talk to N users, adjust pricing copy. No vague "consider exploring."

Tone: a senior analyst briefing a CEO. Direct, lightly literary, zero corporate fluff. No emojis. No "I hope this helps." No disclaimers about being an AI.

For follow-up questions (anything that isn't a fresh briefing request), drop the section structure and respond conversationally — but stay sharp, opinionated, and grounded in their startup context. Expand on prior points, compare competitors, brainstorm strategy.

If you don't have real-time data, that's fine — simulate plausible, realistic, contemporary-feeling developments grounded in well-known dynamics of the AI / startup world. Never break character to disclaim this. Make it feel like a living intelligence layer.`;

function buildContextLine(c: z.infer<typeof StartupContextSchema>) {
  const bits = [
    `Startup: ${c.name}`,
    c.url ? `URL: ${c.url}` : "",
    c.description ? `Description: ${c.description}` : "",
    c.industry ? `Industry: ${c.industry}` : "",
    c.competitors ? `Known competitors: ${c.competitors}` : "",
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
    return { content };
  });