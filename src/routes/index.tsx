import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yo, Signal — an AI Chief of Staff for founders" },
      {
        name: "description",
        content:
          "Yo, Signal compresses overnight news, competitor moves, and AI shifts into a 90-second morning briefing — tailored to your startup.",
      },
      { property: "og:title", content: "Yo, Signal" },
      {
        property: "og:description",
        content: "Information into decisions, before coffee.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/10">
        <span className="font-mono text-[11px] tracking-[0.25em] uppercase">Yo, Signal</span>
        <Link
          to="/auth"
          className="font-mono text-[11px] tracking-[0.22em] uppercase border border-white/30 px-4 py-2 hover:bg-white hover:text-black transition"
        >
          Log in
        </Link>
      </header>

      <main className="flex-1 flex items-center px-8">
        <div className="max-w-2xl mx-auto py-24">
          <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/50 mb-8 animate-fade-in" style={{ animationDelay: "0ms", animationFillMode: "both" }}>
            An AI Chief of Staff for founders
          </p>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.08] text-balance mb-8">
            <span className="inline-block animate-fade-in" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
              It's like{" "}
            </span>
            <span
              className="inline-block relative px-2 mx-0.5 bg-white text-black animate-fade-in"
              style={{ animationDelay: "320ms", animationFillMode: "both" }}
            >
              X
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </span>
            <span className="inline-block animate-fade-in" style={{ animationDelay: "520ms", animationFillMode: "both" }}>
              , but every post is{" "}
            </span>
            <span className="italic text-amber-300 inline-block animate-fade-in" style={{ animationDelay: "720ms", animationFillMode: "both" }}>
              relevant to your startup
            </span>
            <span className="inline-block animate-fade-in" style={{ animationDelay: "900ms", animationFillMode: "both" }}>
              {" "}— and you can{" "}
            </span>
            <span className="italic text-white/70 inline-block animate-fade-in" style={{ animationDelay: "1080ms", animationFillMode: "both" }}>
              talk back to it.
            </span>
          </h1>
          <p className="text-lg leading-relaxed text-white/70 max-w-xl mb-10 animate-fade-in" style={{ animationDelay: "1300ms", animationFillMode: "both" }}>
            Every morning Yo, Signal loads a fresh feed of everything that moved in your world
            overnight. Competitor updates, funding news, regulations, demand signals — each one
            explained in plain English, personalized to your company. Tap any signal to dig deeper
            and talk it through with an AI that already knows your business.
          </p>
          <div className="flex items-center gap-4 animate-fade-in" style={{ animationDelay: "1500ms", animationFillMode: "both" }}>
            <Link
              to="/auth"
              className="inline-flex items-center bg-white text-black px-6 py-3 font-medium hover:bg-white/90 transition"
            >
              Get your first brief →
            </Link>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40">
              90 seconds to set up
            </span>
          </div>
        </div>
      </main>

      <footer className="px-8 py-6 border-t border-white/10 font-mono text-[10px] tracking-[0.22em] uppercase text-white/40 flex items-center justify-between">
        <span>© Yo, Signal</span>
        <span>Built for founders who don't have time to scroll</span>
      </footer>
    </div>
  );
}
