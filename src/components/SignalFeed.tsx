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
}

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
  onReset,
  onSignOut,
}: {
  startup: StartupContext;
  onReset: () => void;
  onSignOut?: () => void;
}) {
  const fetchFeed = useServerFn(generateFeed);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Signal | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFeed({ data: { startup } });
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
          <ul className="divide-y divide-border/60">
            {signals.map((s, i) => (
              <li key={`${s.url}-${i}`}>
                <SignalCard signal={s} onOpen={() => setActive(s)} />
              </li>
            ))}
          </ul>
        </div>
      </main>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-6">
          {active && <SignalThread startup={startup} signal={active} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SignalCard({ signal, onOpen }: { signal: Signal; onOpen: () => void }) {
  const tagClass = TAG_COLORS[signal.tag] ?? "text-muted-foreground border-border bg-card/60";
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
        <span
          className={`ml-auto font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border ${tagClass}`}
        >
          {signal.tag}
        </span>
      </div>
      <h3 className="font-serif text-lg leading-snug mb-2 text-balance">{signal.title}</h3>
      <p className="text-sm text-foreground/80 mb-3 leading-relaxed">{signal.summary}</p>
      <p className="text-sm italic text-signal/90 border-l-2 border-signal/60 pl-3">
        {signal.why}
      </p>
      <div className="mt-3 flex items-center gap-5 text-muted-foreground">
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
  return parsed.toLocaleDateString();
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