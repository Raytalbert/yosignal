import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestCompetitors } from "@/lib/briefing.functions";

export interface StartupContext {
  name: string;
  url: string;
  description: string;
  industry: string;
  competitors: string[];
  categories: string[];
  delivery: string;
}

const CATEGORY_OPTIONS = [
  { id: "competitor-moves", label: "Competitor moves", hint: "Launches, pricing, hiring, drama" },
  { id: "ai-shifts", label: "AI shifts", hint: "New models, capabilities, benchmarks" },
  { id: "funding", label: "Funding & M&A", hint: "Rounds, acquisitions, valuations" },
  { id: "product-launches", label: "Product launches", hint: "Adjacent launches that move your space" },
  { id: "regulatory", label: "Regulatory & policy", hint: "Laws, executive orders, agency moves" },
  { id: "hiring", label: "Hiring signals", hint: "Key exec moves, team builds" },
  { id: "macro", label: "Macro & markets", hint: "Rates, indices, sector rotations" },
];
const DEFAULT_CATEGORIES = ["competitor-moves", "ai-shifts", "funding", "product-launches"];

const DELIVERY_OPTIONS = [
  { id: "in-app", label: "In-app", hint: "Open Yo, Signal and ask." },
  { id: "email", label: "Email", hint: "07:00 local. Single tap to expand.", soon: true },
  { id: "slack", label: "Slack DM", hint: "Goes to your DMs.", soon: true },
  { id: "imessage", label: "iMessage", hint: "For the bold.", soon: true },
];

type Step = 0 | 1 | 2 | 3 | 4;

interface Props {
  onSubmit: (ctx: StartupContext) => void;
}

export function Onboarding({ onSubmit }: Props) {
  const [step, setStep] = useState<Step>(0);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [customComp, setCustomComp] = useState("");
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [delivery, setDelivery] = useState("in-app");
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const suggestFn = useServerFn(suggestCompetitors);
  const fetchedFor = useRef<string>("");

  const canContinueStep0 = url.trim().length > 0 || description.trim().length > 5;

  // Derive a friendly default name from URL if user didn't provide one
  useEffect(() => {
    if (name) return;
    if (url) {
      const cleaned = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      const root = cleaned.split(".")[0];
      if (root) setName(root.charAt(0).toUpperCase() + root.slice(1));
    }
  }, [url, name]);

  async function goToStep1() {
    setStep(1);
    const key = `${url}::${description}`;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;
    setLoadingSuggest(true);
    try {
      const res = await suggestFn({ data: { name, url, description } });
      setSuggested(res.competitors);
      if (!industry && res.industry) setIndustry(res.industry);
    } catch {
      // soft-fail; user can add their own
    } finally {
      setLoadingSuggest(false);
    }
  }

  function addCompetitor(c: string) {
    const v = c.trim();
    if (!v) return;
    if (competitors.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setCompetitors((prev) => [...prev, v]);
  }
  function removeCompetitor(c: string) {
    setCompetitors((prev) => prev.filter((x) => x !== c));
  }
  function toggleCategory(id: string) {
    setCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleFinish() {
    onSubmit({
      name: name.trim() || "Your startup",
      url: url.trim(),
      description: description.trim(),
      industry: industry.trim(),
      competitors,
      categories,
      delivery,
    });
  }

  return (
    <div className="min-h-screen grain flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <Header step={step} />

        {step === 0 && (
          <StepShell
            title={<>Tell me what you're <em className="italic text-muted-foreground">building.</em></>}
            sub="A URL, a sentence, or both. I'll infer the rest."
          >
            <Field label="Your URL">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="acme.ai"
                className="input-base"
                autoFocus
              />
            </Field>
            <div className="flex items-center gap-3 my-2">
              <div className="h-px flex-1 bg-border/60" />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">or / and</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            <Field label="What you're building">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="AI voice agents for dental offices."
                className="input-base resize-none"
              />
            </Field>
            <Field label="What should I call it?" hint="Optional — I'll guess from your URL.">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme"
                className="input-base"
              />
            </Field>
            <Nav
              right={
                <PrimaryBtn disabled={!canContinueStep0} onClick={() => void goToStep1()}>
                  Continue →
                </PrimaryBtn>
              }
            />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title={<>Who should I <em className="italic text-muted-foreground">watch?</em></>}
            sub={
              industry
                ? `Inferred space: ${industry}. Tweak the lineup below.`
                : "Pin the companies whose moves matter to you."
            }
          >
            <Field label="Tracked competitors">
              <div className="flex flex-wrap gap-2 min-h-[44px] p-2 rounded-md bg-input border border-border">
                {competitors.length === 0 && (
                  <span className="text-muted-foreground/60 text-sm px-1 py-1">
                    Tap a suggestion or type your own ↓
                  </span>
                )}
                {competitors.map((c) => (
                  <Chip key={c} variant="active" onRemove={() => removeCompetitor(c)}>
                    {c}
                  </Chip>
                ))}
              </div>
            </Field>

            <div className="flex gap-2">
              <input
                value={customComp}
                onChange={(e) => setCustomComp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCompetitor(customComp);
                    setCustomComp("");
                  }
                }}
                placeholder="Add a competitor and press Enter"
                className="input-base"
              />
              <button
                type="button"
                onClick={() => {
                  addCompetitor(customComp);
                  setCustomComp("");
                }}
                className="px-4 rounded-md border border-border hover:border-signal/60 text-sm font-mono tracking-wider uppercase text-muted-foreground hover:text-signal transition"
              >
                Add
              </button>
            </div>

            <div>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                Suggested {loadingSuggest && <span className="text-signal/70 normal-case tracking-normal italic ml-2">scanning the space…</span>}
              </div>
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {!loadingSuggest && suggested.length === 0 && (
                  <span className="text-muted-foreground/60 text-sm italic">
                    No suggestions — add your own above.
                  </span>
                )}
                {suggested.map((s) => {
                  const added = competitors.some((c) => c.toLowerCase() === s.toLowerCase());
                  return (
                    <Chip
                      key={s}
                      variant={added ? "dim" : "suggest"}
                      onClick={() => !added && addCompetitor(s)}
                    >
                      {added ? "✓ " : "+ "}
                      {s}
                    </Chip>
                  );
                })}
              </div>
            </div>

            <Nav
              left={<GhostBtn onClick={() => setStep(0)}>← Back</GhostBtn>}
              right={<PrimaryBtn onClick={() => setStep(2)}>Continue →</PrimaryBtn>}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title={<>What should I <em className="italic text-muted-foreground">watch for?</em></>}
            sub="Pre-selected to the highest-signal defaults. Tap to refine."
          >
            <div className="grid grid-cols-1 gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const active = categories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`text-left p-4 rounded-md border transition group ${
                      active
                        ? "border-signal/70 bg-signal/[0.06]"
                        : "border-border/60 bg-card/30 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-lg">{cat.label}</span>
                      <span
                        className={`font-mono text-[10px] tracking-[0.2em] uppercase ${
                          active ? "text-signal" : "text-muted-foreground/50"
                        }`}
                      >
                        {active ? "On" : "Off"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{cat.hint}</p>
                  </button>
                );
              })}
            </div>
            <Nav
              left={<GhostBtn onClick={() => setStep(1)}>← Back</GhostBtn>}
              right={
                <PrimaryBtn disabled={categories.length === 0} onClick={() => setStep(3)}>
                  Continue →
                </PrimaryBtn>
              }
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title={<>How should I <em className="italic text-muted-foreground">deliver?</em></>}
            sub="Where you want the briefing waiting for you."
          >
            <div className="grid grid-cols-1 gap-2">
              {DELIVERY_OPTIONS.map((opt) => {
                const active = delivery === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.soon}
                    onClick={() => setDelivery(opt.id)}
                    className={`text-left p-4 rounded-md border transition ${
                      active
                        ? "border-signal/70 bg-signal/[0.06]"
                        : "border-border/60 bg-card/30 hover:border-border"
                    } ${opt.soon ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-serif text-lg">{opt.label}</span>
                      <span
                        className={`font-mono text-[10px] tracking-[0.2em] uppercase ${
                          active ? "text-signal" : "text-muted-foreground/50"
                        }`}
                      >
                        {opt.soon ? "Soon" : active ? "Selected" : "Pick"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
            <Nav
              left={<GhostBtn onClick={() => setStep(2)}>← Back</GhostBtn>}
              right={<PrimaryBtn onClick={() => setStep(4)}>Continue →</PrimaryBtn>}
            />
          </StepShell>
        )}

        {step === 4 && (
          <Summary
            data={{ name, url, description, industry, competitors, categories, delivery }}
            onBack={() => setStep(3)}
            onConfirm={handleFinish}
          />
        )}
      </div>

      <style>{`
        .input-base {
          width: 100%;
          background: var(--color-input);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 12px 14px;
          color: var(--color-foreground);
          font-size: 15px;
          transition: border-color 120ms, background 120ms;
        }
        .input-base:focus {
          outline: none;
          border-color: var(--color-signal);
          background: oklch(0.22 0.02 250);
        }
        .input-base::placeholder {
          color: var(--color-muted-foreground);
          opacity: 0.55;
        }
      `}</style>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function Header({ step }: { step: Step }) {
  const labels = ["Define", "Watchlist", "Categories", "Delivery", "Confirm"];
  return (
    <div className="mb-10">
      <p className="font-mono text-xs tracking-[0.25em] uppercase text-signal mb-5">
        Yo, Signal · setup {step + 1} / 5
      </p>
      <div className="flex gap-1.5 mb-2">
        {labels.map((_, i) => (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${
              i <= step ? "bg-signal" : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="flex gap-1.5 justify-between font-mono text-[9px] tracking-[0.18em] uppercase">
        {labels.map((l, i) => (
          <span key={l} className={i === step ? "text-signal" : "text-muted-foreground/50"}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepShell({
  title,
  sub,
  children,
}: {
  title: React.ReactNode;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] text-balance mb-3">{title}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">{sub}</p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-xs text-muted-foreground/70 italic">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Nav({ left, right }: { left?: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-4">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-signal px-6 py-3 text-signal-foreground font-medium tracking-tight transition hover:brightness-110 active:brightness-95 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:text-signal transition"
    >
      {children}
    </button>
  );
}

function Chip({
  children,
  variant,
  onClick,
  onRemove,
}: {
  children: React.ReactNode;
  variant: "active" | "suggest" | "dim";
  onClick?: () => void;
  onRemove?: () => void;
}) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm transition";
  if (variant === "active") {
    return (
      <span className={`${base} bg-signal/15 text-signal border border-signal/40`}>
        {children}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 hover:text-signal-foreground hover:bg-signal rounded-full w-4 h-4 inline-flex items-center justify-center text-[11px] leading-none"
            aria-label="remove"
          >
            ×
          </button>
        )}
      </span>
    );
  }
  if (variant === "dim") {
    return (
      <span className={`${base} bg-card/30 text-muted-foreground/40 border border-border/40 line-through decoration-muted-foreground/30 cursor-default`}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} bg-card/40 text-foreground/80 border border-border/70 hover:border-signal/60 hover:text-signal hover:bg-signal/[0.06]`}
    >
      {children}
    </button>
  );
}

function Summary({
  data,
  onBack,
  onConfirm,
}: {
  data: StartupContext;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const catLabel = useMemo(
    () =>
      data.categories
        .map((id) => CATEGORY_OPTIONS.find((c) => c.id === id)?.label ?? id)
        .join(" · "),
    [data.categories],
  );
  const delLabel = DELIVERY_OPTIONS.find((d) => d.id === data.delivery)?.label ?? data.delivery;

  return (
    <div>
      <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] text-balance mb-3">
        Ready when you are,{" "}
        <em className="italic text-muted-foreground">{data.name.split(" ")[0]}.</em>
      </h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Here's how I'll think about your world. Edit any time.
      </p>

      <div className="rounded-lg border border-border/60 bg-card/30 divide-y divide-border/50">
        <Row label="Startup">
          <span className="font-serif text-xl">{data.name}</span>
          {data.url && <div className="text-xs text-muted-foreground mt-0.5 font-mono">{data.url}</div>}
        </Row>
        {data.description && (
          <Row label="Building">
            <span className="italic text-foreground/90">{data.description}</span>
          </Row>
        )}
        {data.industry && (
          <Row label="Space">
            <span className="font-mono text-xs tracking-wider uppercase text-signal">{data.industry}</span>
          </Row>
        )}
        <Row label={`Watching (${data.competitors.length})`}>
          {data.competitors.length === 0 ? (
            <span className="text-muted-foreground/60 italic text-sm">no competitors pinned</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.competitors.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2 py-0.5 rounded-full bg-signal/10 text-signal border border-signal/30"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </Row>
        <Row label="Categories">
          <span className="text-sm text-foreground/85">{catLabel || "—"}</span>
        </Row>
        <Row label="Delivery">
          <span className="text-sm text-foreground/85">{delLabel}</span>
        </Row>
      </div>

      <Nav
        left={<GhostBtn onClick={onBack}>← Back</GhostBtn>}
        right={<PrimaryBtn onClick={onConfirm}>Open my briefing room →</PrimaryBtn>}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 grid grid-cols-[110px_1fr] gap-4 items-start">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground pt-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
