import { useState, type FormEvent } from "react";

export interface StartupContext {
  name: string;
  url: string;
  description: string;
  industry: string;
  competitors: string;
}

interface Props {
  onSubmit: (ctx: StartupContext) => void;
}

export function Onboarding({ onSubmit }: Props) {
  const [form, setForm] = useState<StartupContext>({
    name: "",
    url: "",
    description: "",
    industry: "",
    competitors: "",
  });

  function update<K extends keyof StartupContext>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="min-h-screen grain flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="mb-10">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-signal mb-4">
            Chief of Staff · v0.1
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[0.95] text-balance">
            Good morning.
            <br />
            <span className="italic text-muted-foreground">Who are we briefing?</span>
          </h1>
          <p className="mt-5 text-muted-foreground max-w-md">
            Tell me about your startup and I'll wake up before you do — scanning the night for what
            actually moves your needle.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Startup name" required>
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Acme AI"
              className="input-base"
            />
          </Field>

          <Field label="URL">
            <input
              value={form.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="acme.ai"
              className="input-base"
            />
          </Field>

          <Field label="What you're building" hint="One line is fine — I'll infer the rest.">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              placeholder="AI voice agents for dental offices."
              className="input-base resize-none"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Industry">
              <input
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                placeholder="Vertical AI / Healthtech"
                className="input-base"
              />
            </Field>
            <Field label="Competitors">
              <input
                value={form.competitors}
                onChange={(e) => update("competitors", e.target.value)}
                placeholder="Hippocratic, Sully, Suki"
                className="input-base"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="mt-4 w-full group relative overflow-hidden rounded-md bg-signal px-6 py-4 text-signal-foreground font-medium tracking-tight transition hover:brightness-110 active:brightness-95"
          >
            <span className="relative z-10">Brief me →</span>
          </button>
        </form>
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
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
          {label}
          {required && <span className="text-signal ml-1">*</span>}
        </span>
        {hint && <span className="text-xs text-muted-foreground/70 italic">{hint}</span>}
      </div>
      {children}
    </label>
  );
}