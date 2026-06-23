import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/lib/server-env";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function getAnthropicApiKey(): string {
  const key = getServerEnv("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error(
      "Agent is not configured. Add ANTHROPIC_API_KEY in Lovable -> Settings -> Secrets, then redeploy.",
    );
  }
  return key;
}

const AgentInputSchema = z.object({
  command: z.string().min(1).max(2000),
  signalTitle: z.string().max(500),
  signalWhy: z.string().max(2000).optional().default(""),
  startupName: z.string().max(120),
  startupDescription: z.string().max(1000).optional().default(""),
  competitors: z.array(z.string().max(120)).max(30).optional().default([]),
});

function buildSystemPrompt(input: z.infer<typeof AgentInputSchema>): string {
  return `You are Yo, Signal, an AI chief of staff and action agent for ${input.startupName}.
${input.startupDescription ? `Company: ${input.startupDescription}` : ""}
${input.competitors.length ? `Competitors tracked: ${input.competitors.join(", ")}` : ""}

Signal context:
Headline: ${input.signalTitle}
${input.signalWhy ? `Why it matters: ${input.signalWhy}` : ""}

You have just been given a command related to this signal. Complete the command fully and return a complete, actionable result. Be specific to ${input.startupName}. Be direct. Deliver real output, not advice about what to do. If asked for a marketing plan, write the actual plan. If asked for action items, write the actual items. No hedging. Do not use markdown formatting symbols like asterisks or hash signs, write in plain clean prose with natural paragraph breaks.`;
}

async function callAnthropic(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = getAnthropicApiKey();

  let lastStatus = 0;
  let lastText = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = data.content?.map((b) => b.text ?? "").join("") ?? "";
      if (!text) throw new Error("Agent returned an empty response.");
      return text;
    }

    lastStatus = res.status;
    lastText = await res.text();

    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    break;
  }

  if (lastStatus === 429) throw new Error("Rate limit reached. Try again shortly.");
  if (lastStatus === 401 || lastStatus === 403) {
    throw new Error("Anthropic API key issue. Check ANTHROPIC_API_KEY in Lovable secrets.");
  }
  throw new Error(`Agent error (${lastStatus}): ${lastText.slice(0, 200)}`);
}

export const runAgentCommand = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AgentInputSchema.parse(d))
  .handler(async ({ data }) => {
    const systemPrompt = buildSystemPrompt(data);
    const result = await callAnthropic(systemPrompt, data.command);
    return { result };
  });
