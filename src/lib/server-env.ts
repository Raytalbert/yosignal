import process from "node:process";

type EnvRecord = Record<string, string | undefined>;

/** Read a server secret on Cloudflare Workers or Node (local dev). */
export function getServerEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  try {
    // Cloudflare Workers bindings (Lovable production)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { env } = require("cloudflare:workers") as { env: EnvRecord };
    const fromCf = env[name]?.trim();
    if (fromCf) return fromCf;
  } catch {
    /* local vite dev — process.env only */
  }

  return undefined;
}
