import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatCompletion, CHAT_MODEL_LITE, getGeminiApiKey } from "@/lib/ai-client";

const StartupContextSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().max(300).optional().default(""),
  description: z.string().max(1000).optional().default(""),
  industry: z.string().max(200).optional().default(""),
  competitors: z.array(z.string().max(120)).max(30).optional().default([]),
  categories: z.array(z.string().max(60)).max(20).optional().default([]),
  delivery: z.string().max(60).optional().default("in-app"),
  companyType: z.string().max(80).optional().default(""),
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
    c.companyType ? `Company type: ${c.companyType}` : "",
    c.competitors?.length ? `Tracked competitors: ${c.competitors.join(", ")}` : "",
    c.categories?.length ? `Watch categories: ${c.categories.join(", ")}` : "",
    c.delivery ? `Preferred delivery: ${c.delivery}` : "",
  ].filter(Boolean);
  return bits.join("\n");
}

function fallbackBriefingReply(
  startup: z.infer<typeof StartupContextSchema>,
  messages: z.infer<typeof MessageSchema>[],
) {
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === "user")
    ?.content.trim();
  const company = startup.name.trim() || "your company";
  const topic = lastUser
    ? `“${lastUser.slice(0, 180)}${lastUser.length > 180 ? "…" : ""}”`
    : "that";

  return `I'm getting throttled by the AI provider for a minute, so I can't give the full take yet.

For ${company}, treat ${topic} as a signal to sanity-check against three things: whether it changes customer urgency, whether it shifts competitor positioning, and whether it creates a move you can make today.

Try again in a bit and I'll give you the sharper read.`;
}

export const sendBriefingMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      startup: StartupContextSchema,
      messages: z.array(MessageSchema).min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    getGeminiApiKey();

    const nameRule = {
      role: "system" as const,
      content: `The founder's company is named exactly: "${data.startup.name}". Every time you refer to the company, write it EXACTLY as "${data.startup.name}" — same casing, same punctuation, same hyphens. Do NOT repeat it ("${data.startup.name}${data.startup.name}"), do NOT shorten it to its first letter, do NOT add or drop characters, do NOT wrap it in brackets. If you can't naturally fit the full name, just say "you" or "your company".`,
    };
    const contextMsg = {
      role: "system" as const,
      content: `Founder's startup context:\n${buildContextLine(data.startup)}`,
    };

    let payload: { choices?: { message?: { content?: string } }[] };
    try {
      payload = await chatCompletion({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          nameRule,
          contextMsg,
          ...data.messages,
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Rate limit") || message.includes("quota") || message.includes("429")) {
        return { content: fallbackBriefingReply(data.startup, data.messages), limited: true };
      }
      throw error;
    }
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
    getGeminiApiKey();
    if (!data.url && !data.description) return { competitors: [] as string[], industry: "" };

    const prompt = `A founder is configuring a competitive intelligence briefing. From the snippet below, infer:
1. A 2–4 word industry / category label (e.g. "Vertical AI · Healthtech", "Dev tools / AI agents", "Consumer fintech").
2. 5 to 7 of the most relevant real, currently-operating competitors or closest analogues. Real company names only, no descriptions, no URLs. Mix of direct competitors and the obvious "elephants in the room" they'll be compared to.

Snippet:
${data.name ? `Name: ${data.name}\n` : ""}${data.url ? `URL: ${data.url}\n` : ""}${data.description ? `Description: ${data.description}\n` : ""}

Respond ONLY as compact JSON: {"industry":"...","competitors":["A","B","C"]}`;

    const payload = await chatCompletion({
      model: CHAT_MODEL_LITE,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
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

/* ---------------- Focus area suggestion (used by Tune panel) ---------------- */

const FocusSchema = z.object({
  name: z.string().max(120).optional().default(""),
  description: z.string().max(1000).optional().default(""),
  industry: z.string().max(200).optional().default(""),
  companyType: z.string().max(80).optional().default(""),
});

export const suggestFocusAreas = createServerFn({ method: "POST" })
  .inputValidator(FocusSchema)
  .handler(async ({ data }) => {
    getGeminiApiKey();

    const prompt = `Generate 8–10 short focus-area tags that a founder of THIS startup would actually want to filter their news feed by. Tags should be 2–4 words, specific to the company's domain, mission, customers, and the kinds of news that genuinely move their world. Mix domain-specific themes with universal startup themes (funding, talent, product) where relevant.

Startup: ${data.name || "—"}
What they're building: ${data.description || "—"}
Industry: ${data.industry || "—"}
Company type: ${data.companyType || "—"}

Examples of good tags for a workplace-justice platform: "Legal & Regulatory", "EEOC rulings", "HR tech moves", "Worker organizing", "AI for Good".
Examples of good tags for a consumer fintech: "Consumer banking", "Card networks", "Regulation & CFPB", "Fraud & security", "Funding & Deals".

Return ONLY compact JSON: {"areas":["tag1","tag2",...]}`;

    let payload: { choices?: { message?: { content?: string } }[] };
    try {
      payload = await chatCompletion({
        model: CHAT_MODEL_LITE,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
    } catch {
      return { areas: [] as string[] };
    }
    try {
      const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as {
        areas?: string[];
      };
      return {
        areas: (parsed.areas ?? [])
          .filter((a): a is string => typeof a === "string")
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 12),
      };
    } catch {
      return { areas: [] as string[] };
    }
  });