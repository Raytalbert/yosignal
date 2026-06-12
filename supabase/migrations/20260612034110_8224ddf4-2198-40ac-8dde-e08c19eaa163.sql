CREATE TABLE public.saved_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  signal JSONB NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_signals TO authenticated;
GRANT ALL ON public.saved_signals TO service_role;

ALTER TABLE public.saved_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own saved signals" ON public.saved_signals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own saved signals" ON public.saved_signals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own saved signals" ON public.saved_signals
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX saved_signals_user_idx ON public.saved_signals (user_id, saved_at DESC);