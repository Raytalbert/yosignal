import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { sendBriefingMessage } from "@/lib/briefing.functions";
import type { StartupContext } from "./Onboarding";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "What happened while I was sleeping?",
  "What should I know today?",
  "What are my competitors up to?",
  "What's one move I should make this week?",
];

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function BriefingChat({
  startup,
  onReset,
}: {
  startup: StartupContext;
  onReset: () => void;
}) {
  const send = useServerFn(sendBriefingMessage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(text: string) {
    if (!text.trim() || loading) return;
    setError(null);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await send({ data: { startup, messages: next } });
      setMessages([...next, { role: "assistant", content: res.content || "(no response)" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  const empty = messages.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur-md sticky top-0 z-10 bg-background/70">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal">
              Chief of Staff
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-serif text-xl italic">{startup.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground hidden sm:inline">
              {formatDate()}
            </span>
            <button
              onClick={onReset}
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground hover:text-signal transition"
            >
              Switch
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          {empty && (
            <div className="py-12 grain">
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">
                {formatDate()} · briefing room
              </p>
              <h2 className="font-serif text-4xl md:text-5xl leading-tight text-balance">
                The world moved overnight.
                <br />
                <span className="italic text-muted-foreground">
                  Ask what matters for {startup.name}.
                </span>
              </h2>
              <div className="mt-10 grid sm:grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => void ask(p)}
                    className="text-left p-4 rounded-md border border-border/70 bg-card/40 hover:border-signal/60 hover:bg-card transition group"
                  >
                    <span className="font-serif italic text-lg text-balance group-hover:text-signal transition">
                      {p}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-10">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {loading && <ThinkingBubble />}
            {error && (
              <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md p-3">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Composer */}
      <footer className="border-t border-border/60 bg-background/70 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <form onSubmit={onSubmit} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(input);
                  }
                }}
                rows={1}
                placeholder="Ask anything about your world…"
                className="w-full resize-none rounded-md bg-input border border-border focus:border-signal outline-none px-4 py-3 text-[15px] placeholder:text-muted-foreground/60"
                style={{ minHeight: 48, maxHeight: 200 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-md bg-signal text-signal-foreground px-5 py-3 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
            >
              {loading ? "…" : "Send"}
            </button>
          </form>
          <p className="mt-2 font-mono text-[10px] tracking-wider uppercase text-muted-foreground/60">
            Press Enter to send · Shift+Enter for newline
          </p>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-md bg-card border border-border/70 px-4 py-3 text-foreground/90">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <article className="prose-briefing">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif text-3xl mt-8 mb-4 text-balance">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif text-2xl mt-10 mb-3 text-signal text-balance">
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mr-2 align-middle">
                §
              </span>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-xl mt-6 mb-2 text-balance">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="my-3 leading-relaxed text-foreground/90">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="text-signal/90 italic">{children}</em>,
          ul: ({ children }) => <ul className="my-3 space-y-2 pl-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="my-3 space-y-2 pl-1 list-none counter-reset-briefing">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-signal/80">
              {children}
            </li>
          ),
          hr: () => <hr className="my-8 border-border/50" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-signal pl-4 my-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[13px] bg-muted px-1.5 py-0.5 rounded">{children}</code>
          ),
        }}
      >
        {message.content}
      </ReactMarkdown>
    </article>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Scanning the night</span>
      <span className="flex gap-1">
        <Dot />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </span>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-signal animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}