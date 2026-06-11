import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string().min(1).max(2000) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Voice is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        voice: "onyx",
        input: data.text,
        speed: 0.98,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) throw new Error("Voice rate limit — try again shortly.");
      throw new Error(`Voice synthesis failed (${res.status}): ${detail.slice(0, 120)}`);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    return { audio: toBase64(bytes), mimeType: "audio/mpeg" as const };
  });
