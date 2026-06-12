import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatCompletion, CHAT_MODEL_LITE, getGeminiApiKey } from "@/lib/ai-client";

const StartupSchema = z.object({
  name: z.string(),
  url: z.string().optional().default(""),
  description: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  competitors: z.array(z.string()).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
  delivery: z.string().optional().default("in-app"),
  companyType: z.string().optional().default(""),
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
    url: `https://news.google.com/rss/search?q=${q}+when:7d&hl=en-US&gl=US&ceid=US:en`,
    source: `News · ${query}`,
  };
}

function bingNewsFeed(query: string): FeedSource {
  const q = encodeURIComponent(query);
  return {
    url: `https://www.bing.com/news/search?q=${q}&format=rss&cc=US&setlang=en-US`,
    source: `Bing · ${query}`,
  };
}

const RSS_TIMEOUT_MS = 12_000;
const RSS_BATCH_SIZE = 4;

async function fetchWithTimeout(url: string, ms = RSS_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      headers: { "User-Agent": "YoSignal/1.0 (+https://yosignal.app)" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHackerNews(query: string) {
  try {
    const r = await fetchWithTimeout(
      `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=8`,
      6000,
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { hits?: Array<{ title?: string; url?: string; story_text?: string; created_at?: string; objectID?: string }> };
    return (j.hits ?? [])
      .filter((h) => h.title && (h.url || h.objectID))
      .map((h) => ({
        title: h.title ?? "",
        link: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        summary: (h.story_text ?? "").slice(0, 300),
        source: `Hacker News · ${query}`,
        pubDate: h.created_at ?? "",
      }));
  } catch {
    return [];
  }
}

async function fetchReddit(query: string) {
  try {
    const r = await fetchWithTimeout(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=week&limit=10`,
      6000,
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: { children?: Array<{ data?: { title?: string; permalink?: string; url?: string; selftext?: string; created_utc?: number; subreddit?: string } }> } };
    return (j.data?.children ?? [])
      .map((c) => c.data)
      .filter((d): d is NonNullable<typeof d> => !!d && !!d.title)
      .map((d) => ({
        title: d.title ?? "",
        link: d.url && /^https?:\/\//.test(d.url) ? d.url : `https://reddit.com${d.permalink ?? ""}`,
        summary: (d.selftext ?? "").slice(0, 280),
        source: `r/${d.subreddit ?? "reddit"}`,
        pubDate: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : "",
      }));
  } catch {
    return [];
  }
}

function clean(s: string) {
  const decode = (str: string) =>
    str
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  // Decode entities first so any escaped HTML (common in Google News
  // descriptions: &lt;a href=...&gt;) becomes real tags we can strip.
  // Loop twice to catch double-escaped sequences.
  let out = decode(decode(s));
  out = out.replace(/<[^>]+>/g, " ");
  // Drop residual url fragments that survived because they had no closing >
  out = out.replace(/https?:\/\/\S+/g, " ");
  return out.replace(/\s+/g, " ").trim();
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

type RawFeedItem = {
  title: string;
  link: string;
  summary: string;
  source: string;
  pubDate: string;
};

type AISignalLite = {
  i?: number;
  summary?: string;
  why?: string;
  tag?: string;
  relevance?: number;
  urgency?: string;
  matches?: string[];
};

function heuristicTag(title: string): string {
  const t = title.toLowerCase();
  if (/\b(raises?|raised|series [a-e]\b|seed round|funding|valuation|acquir|m&a|ipo|spac)\b/.test(t)) return "Funding";
  if (/\b(lawsuit|sued|sec\b|ftc\b|doj\b|eeoc\b|regulat|ruling|court|bill\b|law\b|policy|sanction|tariff|antitrust)\b/.test(t)) return "Regulatory";
  if (/\b(ai\b|artificial intelligence|gpt|llm|openai|anthropic|gemini|copilot|machine learning)\b/.test(t)) return "AI";
  if (/\b(hir|layoff|fired|cfo|cto|ceo|hire|talent|workforce|recruit)\b/.test(t)) return "Talent";
  if (/\b(launch|releases?|unveils?|announce|introduces?|debut|rolls out|update|version|feature)\b/.test(t)) return "Product";
  return "Industry";
}

function heuristicWhy(title: string, startup: FeedStartup, queryLabel?: string): string {
  const tag = heuristicTag(title);
  const who = startup.name || "your company";
  const space = startup.industry || startup.companyType || "your space";
  const cueParts: string[] = [];
  if (queryLabel) cueParts.push(`tracked "${queryLabel}"`);
  const cue = cueParts.length ? ` (${cueParts.join(", ")})` : "";
  switch (tag) {
    case "Funding":
      return `Capital flowing into ${space} reshapes the competitive bar for ${who}${cue}.`;
    case "Regulatory":
      return `New rules in ${space} may change compliance or risk for ${who}${cue}.`;
    case "AI":
      return `An AI shift that could affect how ${who} builds or competes in ${space}${cue}.`;
    case "Talent":
      return `Hiring & workforce signal — useful context for staffing ${who}${cue}.`;
    case "Product":
      return `A product move in ${space} worth comparing to ${who}'s roadmap${cue}.`;
    default:
      return `Background context on ${space} that frames the market ${who} operates in${cue}.`;
  }
}

async function fetchSingleFeed(f: FeedSource, retries = 1): Promise<RawFeedItem[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetchWithTimeout(f.url);
      if (!r.ok) {
        if (attempt < retries) await sleep(400 * (attempt + 1));
        continue;
      }
      const xml = await r.text();
      const items = parseFeed(xml, f.source);
      if (items.length > 0) return items;
    } catch {
      if (attempt < retries) await sleep(400 * (attempt + 1));
    }
  }
  return [];
}

function dedupeFeedItems(items: RawFeedItem[]) {
  const seen = new Set<string>();
  return items.filter((x) => {
    if (!x.link || seen.has(x.link)) return false;
    seen.add(x.link);
    return true;
  });
}

// Drop items that are clearly non-English or from foreign-only outlets.
// We bias the feed to US/English because that's what most founders here read.
const FOREIGN_TLD_RE = /\.(ma|in|pk|ng|ke|za|br|mx|ar|cl|co|pe|ru|cn|jp|kr|tw|vn|th|id|my|ph|tr|gr|pl|cz|hu|ro|bg|ua|sa|ae|qa|eg)\//i;
const NON_LATIN_RE = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
function isEnglishUS(item: RawFeedItem): boolean {
  if (NON_LATIN_RE.test(item.title)) return false;
  try {
    const host = new URL(item.link).hostname.toLowerCase();
    if (FOREIGN_TLD_RE.test(host + "/")) return false;
  } catch {
    /* ignore */
  }
  return true;
}

async function fetchAllFeeds(feeds: FeedSource[]) {
  const all: RawFeedItem[] = [];
  for (let i = 0; i < feeds.length; i += RSS_BATCH_SIZE) {
    const batch = feeds.slice(i, i + RSS_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((f) => fetchSingleFeed(f)));
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value);
    }
    if (i + RSS_BATCH_SIZE < feeds.length) await sleep(250);
  }
  return dedupeFeedItems(all).slice(0, 120);
}

function buildStaticQueries(
  startup: z.infer<typeof StartupSchema>,
  prefs: z.infer<typeof PrefsSchema>,
): string[] {
  const queries: string[] = [
    ...prefs.extraKeywords,
    ...prefs.focusAreas,
    ...startup.competitors.slice(0, 4),
    ...startup.categories.slice(0, 3),
    startup.industry,
    startup.companyType,
    startup.name,
  ].filter((q): q is string => typeof q === "string" && q.trim().length > 0);
  if (startup.description) {
    const snippet = startup.description.split(/\s+/).slice(0, 5).join(" ");
    if (snippet.length >= 8) queries.push(snippet);
  }
  return Array.from(new Set(queries.map((q) => q.trim()))).slice(0, 8);
}

async function fetchFallbackRaw(startup: FeedStartup): Promise<RawFeedItem[]> {
  const fallbackQueries = Array.from(
    new Set(
      [
        startup.industry,
        startup.companyType,
        startup.name,
        startup.industry ? `${startup.industry} news` : "",
        "startup news",
      ].filter((q): q is string => typeof q === "string" && q.trim().length > 0),
    ),
  );
  const collected: RawFeedItem[] = [];
  for (const q of fallbackQueries) {
    const items = await fetchAllFeeds([googleNewsFeed(q), bingNewsFeed(q)]);
    collected.push(...items);
    if (dedupeFeedItems(collected).length >= 12) break;
  }
  return dedupeFeedItems(collected);
}

async function generateQueries(
  startup: z.infer<typeof StartupSchema>,
  prefs: z.infer<typeof PrefsSchema>,
): Promise<string[]> {
  const prompt = `You are building a personalized news feed for a startup. Generate 6-8 Google News search queries that will surface the most relevant, recent stories for THIS company. Think broadly across: the problem space, target users/customers, adjacent industries, regulatory/policy moves, mission-aligned movements, and named competitors.

Startup: ${startup.name}
Description: ${startup.description || "—"}
Industry: ${startup.industry || "—"}
Company type: ${startup.companyType || "—"}
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

  let payload: { choices?: { message?: { content?: string } }[] };
  try {
    payload = await chatCompletion({
      model: CHAT_MODEL_LITE,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
  } catch {
    return [];
  }
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

export type FeedStartup = z.infer<typeof StartupSchema>;
export type FeedPrefsT = z.infer<typeof PrefsSchema>;

export async function runFeedGeneration(
  startup: FeedStartup,
  prefsInput: FeedPrefsT | undefined,
) {
    const prefs: FeedPrefsT = prefsInput ?? {
      focusAreas: [],
      extraKeywords: [],
      mutedTitles: [],
      mutedSources: [],
    };

    // 1) Ask the model for tailored search queries; fall back to profile-derived queries.
    const aiQueries = await generateQueries(startup, prefs);
    const staticQueries = buildStaticQueries(startup, prefs);
    const competitorQueries = startup.competitors.slice(0, 5);
    const allQueries = Array.from(
      new Set([...prefs.extraKeywords, ...aiQueries, ...staticQueries, ...competitorQueries]),
    ).slice(0, 10);

    const baselineQueries =
      allQueries.length > 0
        ? allQueries
        : [startup.industry || startup.name].filter(Boolean);

    // Hit Google News + Bing for RSS, plus HN and Reddit JSON for breadth.
    const rssFeeds: FeedSource[] = [
      ...baselineQueries.map(googleNewsFeed),
      ...baselineQueries.slice(0, 3).map(bingNewsFeed),
    ];
    const [rssItems, hnItems, redditItems] = await Promise.all([
      fetchAllFeeds(rssFeeds),
      Promise.all(baselineQueries.slice(0, 3).map(fetchHackerNews)).then((a) => a.flat()),
      Promise.all(baselineQueries.slice(0, 3).map(fetchReddit)).then((a) => a.flat()),
    ]);
    // dedupe combined pool by link
    const seen = new Set<string>();
    let raw = [...rssItems, ...hnItems, ...redditItems].filter((x) => {
      if (!x.link || seen.has(x.link)) return false;
      seen.add(x.link);
      return true;
    });
    // Bias to English/US sources — the founder is in the US and wants US-relevant news.
    raw = raw.filter(isEnglishUS);
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
      raw = await fetchFallbackRaw(startup);
      raw = raw.filter(isEnglishUS);
      if (raw.length === 0) {
        return { signals: [], generatedAt: new Date().toISOString(), note: "feeds-empty" };
      }
    }

    // Token optimization: send only the top ~30 items with short summaries.
    // Free-tier Gemini chokes on big payloads — we keep the pool tight on purpose.
    const aiInput = raw.slice(0, 30).map((x, i) => ({
      i,
      s: x.source.replace(/^News · /, "").replace(/^Bing · /, "").slice(0, 40),
      t: x.title.slice(0, 140),
      d: x.pubDate ? x.pubDate.slice(0, 10) : "",
    }));

    const ctx = [
      startup.name && `co=${startup.name}`,
      startup.industry && `ind=${startup.industry}`,
      startup.description && `desc=${startup.description.slice(0, 140)}`,
      prefs.focusAreas.length && `focus=${prefs.focusAreas.slice(0, 6).join("|")}`,
      prefs.extraKeywords.length && `kw=${prefs.extraKeywords.slice(0, 6).join("|")}`,
      startup.competitors.length && `comp=${startup.competitors.slice(0, 5).join("|")}`,
      prefs.mutedTitles.length && `mute=${prefs.mutedTitles.slice(0, 8).map((m) => m.slice(0, 40)).join("|")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Curate a personalized news feed for a US-based founder. Pick the most relevant 12-18 items for THIS company and enrich each with insight + accurate tag.

Context:
${ctx}

Items (index|source|title|date):
${aiInput.map((x) => `${x.i}|${x.s}|${x.t}|${x.d}`).join("\n")}

Drop generic/off-topic items and anything matching muted themes. For each kept item return:
- i: the original index
- summary: 1 punchy sentence rewrite (<=200 chars)
- why: ONE specific insight tying this story to ${startup.name}'s business (<=180 chars). NEVER say "Surfaced from your watch query" — that's not insight.
- tag: pick the BEST fit from [AI, Competitor, Funding, Product, Regulatory, Industry, Talent]. Use Funding for raises/M&A, Regulatory for laws/lawsuits/gov, AI for AI/ML stories, Competitor only if it names a tracked competitor, Talent for hiring/layoffs, Product for launches, Industry only as last resort.
- relevance: 0-100 (reserve >85 for genuinely urgent/on-mission items)
- urgency: [Breaking, Today, This week, Background]
- matches: 1-2 short tags (<=22 chars) like "focus: regulatory" or "competitor: Lattice"

Return ONLY: {"signals":[{"i":0,"summary":"...","why":"...","tag":"...","relevance":0,"urgency":"...","matches":["..."]}]}`;

    let txt = "{}";
    let aiFailed = false;
    try {
      const payload = await chatCompletion({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      txt = payload.choices?.[0]?.message?.content ?? "{}";
    } catch {
      aiFailed = true;
    }
    let parsed: { signals?: unknown } = {};
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = {};
    }
    // Re-hydrate AI output by index, so we keep source/title/url/date verbatim.
    const aiSignals: AISignalLite[] = Array.isArray(parsed.signals)
      ? (parsed.signals as AISignalLite[])
      : [];
    const signals = aiSignals
      .map((s) => {
        const idx = typeof s.i === "number" ? s.i : -1;
        const r = raw[idx];
        if (!r) return null;
        const queryLabel = r.source.replace(/^News · /, "").replace(/^Bing · /, "");
        const titleMatch = r.title.match(/\s[–-]\s([^–-]+)$/);
        const publisher = titleMatch?.[1]?.trim() || queryLabel;
        const cleanTitle = r.title.replace(/\s[–-]\s[^–-]+$/, "").trim();
        return {
          source: publisher,
          title: cleanTitle,
          summary: s.summary || r.summary || cleanTitle,
          why: s.why || heuristicWhy(cleanTitle, startup),
          tag: s.tag || heuristicTag(cleanTitle),
          relevance: typeof s.relevance === "number" ? s.relevance : 60,
          urgency: s.urgency || "Background",
          matches: Array.isArray(s.matches) ? s.matches.slice(0, 3) : [],
          url: r.link,
          date: r.pubDate,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    // Fallback: if the model returns nothing but we DID pull raw items, surface
    // a lightly-formatted version of the top raw items so the feed is never empty.
    if (signals.length === 0 && raw.length > 0) {
      // Round-robin across queries/sources so we don't dump 18 results from
      // the first query — the founder sees variety even when the AI is rate-limited.
      const buckets = new Map<string, RawFeedItem[]>();
      for (const r of raw) {
        const key = r.source;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(r);
      }
      const interleaved: RawFeedItem[] = [];
      let added = true;
      while (added && interleaved.length < 18) {
        added = false;
        for (const list of buckets.values()) {
          const next = list.shift();
          if (next) {
            interleaved.push(next);
            added = true;
            if (interleaved.length >= 18) break;
          }
        }
      }
      // Extract a clean publication name from the title's trailing " - Publisher" suffix
      // (Google News convention), falling back to the query label.
      const fallback = interleaved.map((r) => {
        const queryLabel = r.source.replace(/^News · /, "").replace(/^Bing · /, "");
        const titleMatch = r.title.match(/\s[–-]\s([^–-]+)$/);
        const publisher = titleMatch?.[1]?.trim() || queryLabel;
        const cleanTitle = r.title.replace(/\s[–-]\s[^–-]+$/, "").trim();
        return {
          source: publisher,
          title: cleanTitle,
          summary: r.summary || cleanTitle,
          why: heuristicWhy(cleanTitle, startup, queryLabel),
          tag: heuristicTag(cleanTitle),
          relevance: 60,
          urgency: "Background",
          matches: [`query: ${queryLabel}`],
          url: r.link,
          date: r.pubDate,
        };
      });
      return {
        signals: fallback,
        generatedAt: new Date().toISOString(),
        note: aiFailed ? "ai-rate-limited" : "fallback-raw",
      };
    }
    return { signals, generatedAt: new Date().toISOString() };
}

export const generateFeed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ startup: StartupSchema, prefs: PrefsSchema.optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    getGeminiApiKey();
    return runFeedGeneration(data.startup, data.prefs);
  });