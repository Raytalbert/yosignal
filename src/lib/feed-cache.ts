export interface FeedCachePayload {
  signals: unknown[];
  updatedAt: string;
  generatedAtIso?: string;
}

export function readFeedCache(key: string): FeedCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedCachePayload;
    if (!Array.isArray(parsed.signals)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFeedCache(key: string, payload: FeedCachePayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

export function formatFeedAge(generatedAtIso: string | null | undefined): string | null {
  if (!generatedAtIso) return null;
  const ts = new Date(generatedAtIso).getTime();
  if (!Number.isFinite(ts)) return null;
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}
