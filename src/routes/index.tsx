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
    <div className="min-h-screen bg-white text-black flex flex-col">
      <header className="px-6 md:px-10 py-6 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.25em] uppercase">Yo, Signal</span>
        <Link
          to="/auth"
          className="font-mono text-[11px] tracking-[0.22em] uppercase border border-black/30 px-4 py-2 hover:bg-black hover:text-white transition"
        >
          Log in
        </Link>
      </header>

      <main className="flex-1 flex items-center px-6 md:px-10">
        <div className="max-w-2xl mx-auto py-20 md:py-28">
          <h1 className="text-3xl md:text-5xl leading-[1.15] font-medium tracking-tight mb-8">
            Yo, Signal is an AI that delivers news relevant to your startup every morning.
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-black/70 mb-10">
            It's like X, but the posts are all stuff about your industry. You can interact with the
            feed and ask questions about the articles — and the AI knows your business well enough
            to answer whatever.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center bg-black text-white px-6 py-3 font-medium hover:bg-black/85 transition"
            >
              Get your first brief →
            </Link>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40">
              90 seconds to set up
            </span>
          </div>
        </div>
      </main>

      <footer className="px-6 md:px-10 py-6 font-mono text-[10px] tracking-[0.22em] uppercase text-black/40">
        © Yo, Signal
      </footer>
    </div>
  );
}
