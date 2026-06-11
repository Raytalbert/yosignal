import { createFileRoute } from "@tanstack/react-router";
import { isGeminiConfigured } from "@/lib/ai-client";

export const Route = createFileRoute("/api/ai-status")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({
            gemini: isGeminiConfigured(),
            provider: "google-gemini",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
