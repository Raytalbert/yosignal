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

const PrefsSchema = z.object({
  focusAreas: z.array(z.string().max(60)).max(20).optional().default([]),
  extraKeywords: z.array(z.string().max(60)).max(30).optional().default([]),
  mutedTitles: z.array(z.string().max(300)).max(200).optional().default([]),
  mutedSources: z.array(z.string().max(120)).max(80).optional().default([]),
});

type FeedSource = { url: string; source: string };

function googleNewsFeed(query: string): FeedSource {
  const q = encodeURIComponent(query);
  return {
    url: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
    source: `News · ${query}`,
  };
}

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

async function fetchAllFeeds(feeds: FeedSource[]) {
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
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
  return all.slice(0, 80);
}

async function generateQueries(
  apiKey: string,
  startup: z.infer<typeof StartupSchema>,
  prefs: z.infer<typeof PrefsSchema>,
): Promise<string[]> {
  const prompt = `You are building a personalized news feed for a startup. Generate 6-8 Google News search queries that will surface the most relevant, recent stories for THIS company. Think broadly across: the problem space, target users/customers, adjacent industries, regulatory/policy moves, mission-aligned movements, and named competitors.

Startup: ${startup.name}
Description: ${startup.description || "—"}
Industry: ${startup.industry || "—"}
Competitors: ${startup.competitors.join(", ") || "—"}
Watch categories: ${startup.categories.join(", ") || "—"}
Focus areas (weight heavily): ${prefs.focusAreas.join(", ") || "—"}
Extra keywords from founder: ${prefs.extraKeywords.join(", ") || "—"}
AVOID topics the founder marked irrelevant (do NOT generate queries matching these themes): ${prefs.mutedTitles.slice(0, 20).join(" | ") || "—"}

Rules:
- Each query is 2-6 words. Specific enough to surface relevant stories, broad enough to return results.
- Mix domain queries (e.g. "workplace discrimination lawsuit", "EEOC ruling"), competitor names, and focus-area queries.
- If focus areas or extra keywords are present, AT LEAST half of queries should reflect them.
- Do NOT default to generic tech terms ("AI startup", "venture capital") unless that's actually this company's space.
- Avoid duplicates.

Return ONLY compact JSON: {"queries":["...","..."]}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as {
      queries?: string[];
    };
    return (parsed.queries ?? [])
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export const generateFeed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ startup: StartupSchema, prefs: PrefsSchema.optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured.");

    const prefs: z.infer<typeof PrefsSchema> = data.prefs ?? {
      focusAreas: [],
      extraKeywords: [],
      mutedTitles: [],
      mutedSources: [],
    };

    // 1) Ask the model for tailored search queries based on the startup profile.
    const queries = await generateQueries(apiKey, data.startup, prefs);

    // 2) Always include competitor names + founder's extra keywords as a baseline.
    const competitorQueries = data.startup.competitors.slice(0, 5);
    const allQueries = Array.from(
      new Set([...prefs.extraKeywords, ...queries, ...competitorQueries]),
    ).slice(0, 12);

    const feeds: FeedSource[] = allQueries.length
      ? allQueries.map(googleNewsFeed)
      : [googleNewsFeed(data.startup.industry || data.startup.name)];

    let raw = await fetchAllFeeds(feeds);
    // hard-filter muted titles / sources before sending to the model
    if (prefs.mutedTitles.length || prefs.mutedSources.length) {
      const muted = prefs.mutedTitles.map((t) => t.toLowerCase().slice(0, 80));
      const mutedSources = prefs.mutedSources.map((s) => s.toLowerCase());
      raw = raw.filter((x) => {
        const t = x.title.toLowerCase();
        if (mutedSources.some((s) => x.source.toLowerCase().includes(s))) return false;
        if (muted.some((m) => m && t.includes(m))) return false;
        return true;
      });
    }
    if (raw.length === 0) {
      return { signals: [], generatedAt: new Date().toISOString(), note: "feeds-empty" };
    }

    const prompt = `You curate a personalized "signal feed" for a startup founder — like a feed of tweets, but every item is sharp, relevant, and opinionated. Below are raw news items pulled from queries tailored to this company. Pick the 10–14 that most matter to THIS specific startup, and rewrite each as a tweet-sized card.

CRITICAL: Be ruthless about relevance. If an item is generic tech news, off-topic, or only tangentially related to this company's actual mission, DROP IT. Better to return 6 sharp items than 14 mediocre ones. The founder of a workplace-justice platform should NOT see "Apple announces new framework" — they should see EEOC rulings, discrimination lawsuits, labor policy, HR-tech moves, etc.

Startup: ${data.startup.name}
Description: ${data.startup.description || "—"}
Industry: ${data.startup.industry || "—"}
Competitors tracked: ${data.startup.competitors.join(", ") || "—"}
Watch categories: ${data.startup.categories.join(", ") || "—"}
Founder focus areas (weight heavily): ${prefs.focusAreas.join(", ") || "—"}
Founder extra keywords: ${prefs.extraKeywords.join(", ") || "—"}
Topics founder has marked NOT RELEVANT (avoid these themes — do not surface similar items): ${prefs.mutedTitles.slice(0, 30).join(" | ") || "—"}

Raw items (JSON):
${JSON.stringify(raw.map((x) => ({ source: x.source, title: x.title, summary: x.summary, url: x.link, date: x.pubDate })))}

Filter aggressively. Drop anything generic or off-topic. For each kept item, output:
- source: a short publication name (extract from the title if present, e.g. "Reuters", "NYT"; otherwise use the feed source)
- title: keep close to original (≤ 120 chars)
- summary: 1–2 punchy sentences in your own words (≤ 280 chars)
- why: ONE opinionated sentence on why this matters to ${data.startup.name} specifically
- tag: one of [AI, Competitor, Funding, Product, Regulatory, Industry, Talent]
- relevance: integer 0-100, how relevant THIS item is to THIS startup right now (be honest; reserve >85 for genuinely urgent/on-mission items)
- urgency: one of [Breaking, Today, This week, Background] based on timing AND impact
- matches: 1-3 short tags (≤ 22 chars each) describing WHY it matched — e.g. "focus: legal/regulatory", "matches: discrimination", "competitor: Lattice"
- url: original link
- date: original date if present

Return ONLY compact JSON exactly like:
{"signals":[{"source":"...","title":"...","summary":"...","why":"...","tag":"...","relevance":0,"urgency":"...","matches":["..."],"url":"...","date":"..."}]}`;

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
    // Fallback: if the model returns nothing but we DID pull raw items, surface
    // a lightly-formatted version of the top raw items so the feed is never empty.
    if (signals.length === 0 && raw.length > 0) {
      const fallback = raw.slice(0, 12).map((r) => ({
        source: r.source.replace(/^News · /, ""),
        title: r.title,
        summary: r.summary || r.title,
        why: `Pulled from your "${r.source.replace(/^News · /, "")}" watch query.`,
        tag: "Industry",
        relevance: 60,
        urgency: "Background",
        matches: [r.source.replace(/^News · /, "query: ")],
        url: r.link,
        date: r.pubDate,
      }));
      return { signals: fallback, generatedAt: new Date().toISOString(), note: "fallback-raw" };
    }
    return { signals, generatedAt: new Date().toISOString() };
  });