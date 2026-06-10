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

const SYSTEM_PROMPT = `You are Yo, Signal — a sharp, human chief-of-staff sidekick for a startup founder. Talk to them the way a smart friend who happens to know their space would: casual, direct, opinionated, a little dry. Short sentences. Contractions. No corporate voice, no AI tropes, no "I hope this helps," no emojis, no headers like "Introduction:" or "Conclusion:".

Always refer to the founder's company by its FULL name exactly as given (e.g. "Hive-ly", not "H" or "the company"). Never abbreviate it. Never wrap it in brackets like "[startup]".

You'll be given startup context (what they're building, competitors, watch categories). Build a mental model and stay tightly relevant to it.

DEFAULT MODE = conversation. Almost every message you get is a follow-up, a question, or someone reacting to a news card. Respond like a quick DM:
- 2–4 short paragraphs max, often less.
- Get to the point in the first sentence.
- Have a take. Disagree if you disagree. Don't hedge with "could potentially."
- No bullet lists unless the user explicitly asks for a list or it's genuinely the clearest format.
- No section headings (no "##", no bold labels) in conversational replies.
- Reference the specific signal/topic they're asking about by name when relevant.

ONLY when the user explicitly asks for a full morning briefing ("brief me", "what should I know today", "morning briefing"), switch to a structured markdown briefing with sections: ## What changed, ## Early signals, ## Implications for <company name>, ## Suggested moves today. Otherwise — stay conversational.

You don't have live web access. Reason from your training, the founder's stated context, the signal they're asking about, and well-known industry dynamics. Don't invent fake headlines with fake dates or dollar amounts.`;

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