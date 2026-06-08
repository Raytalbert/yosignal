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
          <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-white/50 mb-8">
            An AI Chief of Staff for founders
          </p>
          <h1 className="font-serif text-5xl md:text-7xl leading-[1.05] text-balance mb-8">
            The world moved overnight.
            <br />
            <span className="italic text-white/60">Know what matters by coffee.</span>
          </h1>
          <p className="text-lg leading-relaxed text-white/70 max-w-xl mb-10">
            Yo, Signal reads the night so you don't have to. Every morning, a tight briefing on
            competitor moves, AI shifts, funding, and product launches — filtered to what actually
            matters for the company you're building. No feed. No noise. Just a sharp page that ends
            with what to do today.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center bg-white text-black px-6 py-3 font-medium hover:bg-white/90 transition"
            >
              Get your first briefing →
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
