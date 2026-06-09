import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { generateFeed } from "@/lib/feed.functions";
import { sendBriefingMessage } from "@/lib/briefing.functions";
import type { StartupContext } from "./Onboarding";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Signal {
  source: string;
  title: string;
  summary: string;
  why: string;
  tag: string;
  url: string;
  date?: string;
  relevance?: number;
  urgency?: string;
  matches?: string[];
}

export interface FeedPrefs {
  focusAreas: string[];
  extraKeywords: string[];
  mutedTitles: string[];
  mutedSources: string[];
}

export const DEFAULT_PREFS: FeedPrefs = {
  focusAreas: [],
  extraKeywords: [],
  mutedTitles: [],
  mutedSources: [],
};

const FOCUS_AREA_OPTIONS = [
  "Legal & Regulatory",
  "Product & Launches",
  "AI for Good",
  "Funding & Deals",
  "Competitor Moves",
  "Policy & Politics",
  "Talent & Hiring",
  "Customer Stories",
  "Industry Trends",
];

const TAG_COLORS: Record<string, string> = {
  AI: "text-violet-300 border-violet-400/40 bg-violet-400/10",
  Competitor: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  Funding: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  Product: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  Regulatory: "text-rose-300 border-rose-400/40 bg-rose-400/10",
  Industry: "text-stone-300 border-stone-400/40 bg-stone-400/10",
  Talent: "text-pink-300 border-pink-400/40 bg-pink-400/10",
};

export function SignalFeed({
  startup,
  prefs,
  onPrefsChange,
  onReset,
  onSignOut,
}: {
  startup: StartupContext;
  prefs: FeedPrefs;
  onPrefsChange: (p: FeedPrefs) => void;
  onReset: () => void;
  onSignOut?: () => void;
}) {
  const fetchFeed = useServerFn(generateFeed);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Signal | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load(withPrefs: FeedPrefs = prefs) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFeed({ data: { startup, prefs: withPrefs } });
      setSignals((res.signals as Signal[]) ?? []);
      setUpdatedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function muteSignal(s: Signal) {
    const next: FeedPrefs = {
      ...prefs,
      mutedTitles: Array.from(new Set([...prefs.mutedTitles, s.title])).slice(-200),
    };
    onPrefsChange(next);
    setSignals((cur) => cur.filter((x) => x.url !== s.url));
  }

  function applyPrefs(next: FeedPrefs) {
    onPrefsChange(next);
    setSettingsOpen(false);
    void load(next);
  }

  // partition by freshness: < 48h "recent", everything else "older"
  const RECENT_MS = 48 * 60 * 60 * 1000;
  const now = Date.now();
  const withTs = signals.map((s) => {
    const t = s.date ? new Date(s.date).getTime() : NaN;
    return { s, ts: Number.isFinite(t) ? t : 0 };
  });
  const recent = withTs
    .filter((x) => x.ts && now - x.ts <= RECENT_MS)
    .sort((a, b) => b.ts - a.ts);
  const older = withTs
    .filter((x) => !x.ts || now - x.ts > RECENT_MS)
    .sort((a, b) => b.ts - a.ts);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 sticky top-0 z-20 bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal">Yo, Signal</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-serif text-lg italic truncate">{startup.name}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-signal disabled:opacity-40"
            >
              {loading ? "Scanning…" : "Refresh"}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-signal"
            >
              Tune
            </button>
            <button
              onClick={onReset}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-signal"
            >
              Switch
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-signal"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-5 pb-3">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            Your feed{updatedAt ? ` · updated ${updatedAt}` : ""}
            {prefs.focusAreas.length > 0 && ` · focus: ${prefs.focusAreas.length}`}
            {prefs.mutedTitles.length > 0 && ` · muted: ${prefs.mutedTitles.length}`}
          </p>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto">
          {loading && signals.length === 0 && <FeedSkeleton />}
          {error && (
            <div className="m-5 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}
          {!loading && !error && signals.length === 0 && (
            <div className="p-10 text-center text-muted-foreground font-serif italic">
              No signals matched your watchlist yet. Try refresh in a bit.
            </div>
          )}
          {recent.length > 0 && (
            <ul className="divide-y divide-border/60">
              {recent.map(({ s }, i) => (
                <li key={`r-${s.url}-${i}`}>
                  <SignalCard
                    signal={s}
                    onOpen={() => setActive(s)}
                    onMute={() => muteSignal(s)}
                  />
                </li>
              ))}
            </ul>
          )}
          {older.length > 0 && (
            <>
              <div className="px-5 pt-8 pb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Older — still relevant
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <ul className="divide-y divide-border/60 opacity-80">
                {older.map(({ s }, i) => (
                  <li key={`o-${s.url}-${i}`}>
                    <SignalCard
                      signal={s}
                      onOpen={() => setActive(s)}
                      onMute={() => muteSignal(s)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-6">
          {active && <SignalThread startup={startup} signal={active} />}
        </SheetContent>
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto">
          <SettingsPanel
            initial={prefs}
            onCancel={() => setSettingsOpen(false)}
            onSave={applyPrefs}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SignalCard({
  signal,
  onOpen,
  onMute,
}: {
  signal: Signal;
  onOpen: () => void;
  onMute: () => void;
}) {
  const tagClass = TAG_COLORS[signal.tag] ?? "text-muted-foreground border-border bg-card/60";
  const relevance = typeof signal.relevance === "number" ? Math.max(0, Math.min(100, signal.relevance)) : null;
  const urgency = signal.urgency ?? "";
  const urgencyClass =
    urgency === "Breaking"
      ? "text-rose-300 border-rose-400/40 bg-rose-400/10"
      : urgency === "Today"
        ? "text-emerald-300 border-emerald-400/40 bg-emerald-400/10"
        : urgency === "This week"
          ? "text-sky-300 border-sky-400/40 bg-sky-400/10"
          : "text-muted-foreground border-border bg-card/60";
  return (
    <article
      className="px-5 py-5 hover:bg-card/40 transition cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-signal/15 border border-signal/40 flex items-center justify-center font-mono text-[11px] text-signal uppercase shrink-0">
          {signal.source.slice(0, 2)}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{signal.source}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {signal.date ? formatDate(signal.date) : "today"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {urgency && urgency !== "Background" && (
            <span className={`font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${urgencyClass}`}>
              {urgency}
            </span>
          )}
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${tagClass}`}
          >
            {signal.tag}
          </span>
        </div>
      </div>
      <h3 className="font-serif text-lg leading-snug mb-2 text-balance">{signal.title}</h3>
      <p className="text-sm text-foreground/80 mb-3 leading-relaxed">{signal.summary}</p>
      <p className="text-sm italic text-signal/90 border-l-2 border-signal/60 pl-3">
        {signal.why}
      </p>

      {(relevance !== null || (signal.matches && signal.matches.length > 0)) && (
        <div className="mt-3 space-y-1.5">
          {relevance !== null && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground w-16 shrink-0">
                Relevance
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${relevance}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-signal w-8 text-right">{relevance}</span>
            </div>
          )}
          {signal.matches && signal.matches.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-[4.25rem]">
              {signal.matches.slice(0, 4).map((m, i) => (
                <span
                  key={`${m}-${i}`}
                  className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-border/70 rounded-sm px-1.5 py-0.5"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-5 text-muted-foreground">
        <button
          className="font-mono text-[10px] uppercase tracking-wider hover:text-signal"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Ask →
        </button>
        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-wider hover:text-signal"
            onClick={(e) => e.stopPropagation()}
          >
            Source ↗
          </a>
        )}
        <button
          className="ml-auto font-mono text-[10px] uppercase tracking-wider hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onMute();
          }}
          title="Mark not relevant — Signal will show fewer like this"
        >
          Not relevant ✕
        </button>
      </div>
    </article>
  );
}

function formatDate(d: string) {
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d.slice(0, 16);
  const diffH = (Date.now() - parsed.getTime()) / 36e5;
  if (diffH < 1) return `${Math.max(1, Math.round(diffH * 60))}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  const diffD = diffH / 24;
  if (diffD < 7) return `${Math.round(diffD)}d ago`;
  return parsed.toLocaleDateString();
}

function SettingsPanel({
  initial,
  onSave,
  onCancel,
}: {
  initial: FeedPrefs;
  onSave: (p: FeedPrefs) => void;
  onCancel: () => void;
}) {
  const [focusAreas, setFocusAreas] = useState<string[]>(initial.focusAreas);
  const [keywordsText, setKeywordsText] = useState<string>(initial.extraKeywords.join(", "));
  const [mutedTitles, setMutedTitles] = useState<string[]>(initial.mutedTitles);

  function toggleFocus(a: string) {
    setFocusAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }

  function save() {
    const extraKeywords = keywordsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    onSave({ ...initial, focusAreas, extraKeywords, mutedTitles });
  }

  return (
    <div className="space-y-6">
      <SheetHeader className="text-left p-0">
        <SheetTitle className="font-serif text-xl">Tune your feed</SheetTitle>
        <p className="text-sm text-muted-foreground">
          Shape what Signal pulls and how it ranks relevance.
        </p>
      </SheetHeader>

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
          Focus areas
        </p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREA_OPTIONS.map((a) => {
            const on = focusAreas.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleFocus(a)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  on
                    ? "bg-signal text-signal-foreground border-signal"
                    : "border-border text-foreground/80 hover:border-signal/60"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Extra keywords
        </p>
        <textarea
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          rows={3}
          placeholder="e.g. EEOC, retaliation lawsuit, pay transparency, workplace harassment"
          className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-signal resize-none"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Comma-separated. These get turned into news queries directly.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Muted ({mutedTitles.length})
          </p>
          {mutedTitles.length > 0 && (
            <button
              type="button"
              onClick={() => setMutedTitles([])}
              className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
            >
              Clear all
            </button>
          )}
        </div>
        {mutedTitles.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Tap "Not relevant" on any card to teach Signal what to skip.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {mutedTitles.slice(-20).reverse().map((t, i) => (
              <li key={`${t}-${i}`} className="flex items-start gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMutedTitles((cur) => cur.filter((x) => x !== t))}
                  className="text-muted-foreground hover:text-foreground mt-0.5"
                  title="Unmute"
                >
                  ✕
                </button>
                <span className="flex-1 text-foreground/70 line-clamp-2">{t}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:border-signal/60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="flex-1 bg-signal text-signal-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Save & regenerate
        </button>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <ul className="divide-y divide-border/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-5 py-6 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-muted" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
          <div className="h-5 w-3/4 bg-muted rounded mb-2" />
          <div className="h-4 w-full bg-muted rounded mb-1" />
          <div className="h-4 w-2/3 bg-muted rounded" />
        </li>
      ))}
    </ul>
  );
}

function SignalThread({ startup, signal }: { startup: StartupContext; signal: Signal }) {
  const send = useServerFn(sendBriefingMessage);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    const seed = `The founder is asking about this specific signal from their personalized feed:

Source: ${signal.source}
Headline: ${signal.title}
Summary: ${signal.summary}
Your prior take: ${signal.why}
URL: ${signal.url}

Their question: ${q}

Answer conversationally, sharp and opinionated, grounded in their startup context. Drop the briefing structure; treat this like a follow-up DM with their chief of staff.`;
    try {
      const res = await send({ data: { startup, messages: [{ role: "user", content: seed }] } });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (e) {
      setMessages([
        ...next,
        { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const quick = [
    "Why does this matter to us?",
    "How should we respond?",
    "Who else is affected?",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <SheetHeader className="text-left">
        <SheetTitle className="font-serif text-xl text-balance leading-snug">
          {signal.title}
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{signal.source}</span>
          <span>·</span>
          <span>{signal.tag}</span>
          {signal.date && (
            <>
              <span>·</span>
              <span>{formatDate(signal.date)}</span>
            </>
          )}
        </div>
        <p className="text-foreground/85 leading-relaxed">{signal.summary}</p>
        <p className="italic text-signal/90 border-l-2 border-signal/60 pl-3">{signal.why}</p>
        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block font-mono text-[10px] uppercase tracking-wider text-signal hover:underline"
          >
            Read source ↗
          </a>
        )}
      </div>

      <div className="border-t border-border/60 mt-5 pt-4 flex-1 overflow-y-auto space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Ask a follow-up
            </p>
            <div className="flex flex-col gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => void ask(q)}
                  className="text-left text-sm font-serif italic text-foreground/80 border border-border/70 rounded-md px-3 py-2 hover:border-signal/60 hover:text-signal transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="text-sm bg-card border border-border/70 rounded-md p-3 ml-6"
            >
              {m.content}
            </div>
          ) : (
            <article key={i} className="text-sm prose-briefing">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </article>
          ),
        )}
        {loading && (
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Thinking…
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="border-t border-border/60 pt-3 mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this signal…"
          className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-signal"
        />
        <button
          disabled={loading || !input.trim()}
          className="bg-signal text-signal-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}