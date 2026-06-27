import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerEnv } from "@/lib/server-env";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

function getAnthropicApiKey(): string {
  const key = getServerEnv("ANTHROPIC_API_KEY");
  if (!key) {
    throw new Error(
      "Research agent is not configured. Add ANTHROPIC_API_KEY in Lovable -> Settings -> Secrets, then redeploy.",
    );
  }
  return key;
}

const ResearchInputSchema = z.object({
  persona: z.string().min(1).max(1000),
  startupName: z.string().max(120),
  startupDescription: z.string().max(1000).optional().default(""),
});

function buildResearchPrompt(input: z.infer<typeof ResearchInputSchema>): string {
  return `You are roleplaying as a persona for honest market research purposes, on behalf of a founder building ${input.startupName}.
${input.startupDescription ? `${input.startupName} is: ${input.startupDescription}` : ""}

Persona: ${input.persona}

Search the web to find where real people matching this persona are actually discussing their situation right now — forums, Q&A sites, articles, comment sections, public posts. You're looking for genuine signal about what they're stuck on and what they actually need.

Be honest in your search process. If a platform or query comes up empty, say so and try a different angle rather than inventing results.

For each genuine real post or thread you find, report:
- Where you found it (site/platform)
- A short quote or close paraphrase of what they said
- What they seem to actually need help with right now

Then summarize: what are the 2-3 most common needs or frustrations across everything you found? Be direct and specific — name the actual bottleneck, not a vague restatement of the problem. If there's a throughline that the founder should act on immediately, say so plainly.

Do not use markdown formatting symbols like asterisks or hash signs in a way that looks like raw markdown — write in clean, readable prose with clear paragraph and section breaks. Headers are fine as plain text labels.`;
}

async function callAnthropicWithSearch(prompt: string): Promise<string> {
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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      // Concatenate all text blocks (tool-use turns interleave with text blocks).
      const text = data.content
        ?.filter((b) => b.type === "text" && b.text)
        .map((b) => b.text ?? "")
        .join("\n\n") ?? "";
      if (!text) throw new Error("Research agent returned an empty response.");
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
  throw new Error(`Research agent error (${lastStatus}): ${lastText.slice(0, 300)}`);
}

export const runPersonaResearch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ResearchInputSchema.parse(d))
  .handler(async ({ data }) => {
    const prompt = buildResearchPrompt(data);
    const result = await callAnthropicWithSearch(prompt);
    return { result };
  });
