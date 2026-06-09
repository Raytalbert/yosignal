import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StartupSchema = z.object({
  name: z.string(),
  url: z.string().optional().default(""),
  description: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  competitors: z.array(z.string()).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
  delivery: z.string().optional().default("in-app"),
});

const FEEDS = [
  { url: "https://hnrss.org/frontpage?points=100", source: "Hacker News" },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat AI" },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
  { url: "https://news.ycombinator.com/rss", source: "Hacker News" },
];

function clean(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeed(xml: string, source: string) {
  const items: { title: string; link: string; summary: string; source: string; pubDate: string }[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks.slice(0, 12)) {
    const title = clean(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const linkHref = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const linkTag = b.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
    const link = (linkHref ?? linkTag ?? "").trim();
    const summary = clean(
      b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
        b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        b.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ??
        "",
    ).slice(0, 360);
    const pubDate = clean(
      b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
        b.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
        b.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1] ??
        "",
    );
    if (title && link) items.push({ title, link, summary, source, pubDate });
  }
  return items;
}

async function fetchAllFeeds() {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const r = await fetch(f.url, {
        headers: { "User-Agent": "YoSignal/1.0 (+https://yosignal.app)" },
      });
      if (!r.ok) return [];
      const xml = await r.text();
      return parseFeed(xml, f.source);
    }),
  );
  // dedupe by link
  const seen = new Set<string>();
  const all = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((x) => {
      if (seen.has(x.link)) return false;
      seen.add(x.link);
      return true;
    });
  return all.slice(0, 60);
}

export const generateFeed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ startup: StartupSchema }).parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured.");

    const raw = await fetchAllFeeds();
    if (raw.length === 0) {
      return { signals: [], generatedAt: new Date().toISOString(), note: "feeds-empty" };
    }

    const prompt = `You curate a personalized "signal feed" for a startup founder — like a feed of tweets, but every item is sharp, relevant, and opinionated. Below are raw items from RSS feeds. Pick the 10–14 that most matter to THIS specific startup, and rewrite each as a tweet-sized card.

Startup: ${data.startup.name}
Description: ${data.startup.description || "—"}
Industry: ${data.startup.industry || "—"}
Competitors tracked: ${data.startup.competitors.join(", ") || "—"}
Watch categories: ${data.startup.categories.join(", ") || "—"}

Raw items (JSON):
${JSON.stringify(raw.map((x) => ({ source: x.source, title: x.title, summary: x.summary, url: x.link, date: x.pubDate })))}

Filter aggressively. Drop anything generic or off-topic. For each kept item, output:
- source: the feed source
- title: keep close to original (≤ 120 chars)
- summary: 1–2 punchy sentences in your own words (≤ 280 chars)
- why: ONE opinionated sentence on why this matters to ${data.startup.name} specifically
- tag: one of [AI, Competitor, Funding, Product, Regulatory, Industry, Talent]
- url: original link
- date: original date if present

Return ONLY compact JSON exactly like:
{"signals":[{"source":"...","title":"...","summary":"...","why":"...","tag":"...","url":"...","date":"..."}]}`;

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
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI gateway error (${res.status}): ${t.slice(0, 200)}`);
    }
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: { signals?: unknown } = {};
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = {};
    }
    const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
    return { signals, generatedAt: new Date().toISOString() };
  });