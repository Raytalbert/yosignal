import { getServerEnv } from "@/lib/server-env";

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export const CHAT_MODEL = "gemini-2.5-flash";
export const CHAT_MODEL_LITE = "gemini-2.5-flash";

/** Server-only. Read inside handlers — not at module scope on Workers. */
export function getGeminiApiKey(): string {
  const key = getServerEnv("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      "AI is not configured. Add GEMINI_API_KEY in Lovable → Settings → Secrets, then redeploy.",
    );
  }
  return key;
}

export function isGeminiConfigured(): boolean {
  return !!getServerEnv("GEMINI_API_KEY");
}

export async function chatCompletion(body: {
  model?: string;
  messages: { role: string; content: string }[];
  response_format?: { type: "json_object" };
}) {
  const apiKey = getGeminiApiKey();
  const res = await fetch(GEMINI_OPENAI_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model ?? CHAT_MODEL,
      messages: body.messages,
      ...(body.response_format ? { response_format: body.response_format } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
    if (res.status === 402 || res.status === 403) {
      throw new Error("AI quota or API key issue. Check GEMINI_API_KEY in Google AI Studio.");
    }
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }

  return (await res.json()) as { choices?: { message?: { content?: string } }[] };
}
