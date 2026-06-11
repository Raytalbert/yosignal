grant insert, update on public.daily_feeds to authenticated;

create policy "insert own daily feed"
  on public.daily_feeds for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own daily feed"
  on public.daily_feeds for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
