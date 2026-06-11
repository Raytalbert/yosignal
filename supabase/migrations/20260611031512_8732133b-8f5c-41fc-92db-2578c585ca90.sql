
create table public.daily_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  signals jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);
grant select on public.daily_feeds to authenticated;
grant all on public.daily_feeds to service_role;
alter table public.daily_feeds enable row level security;
create policy "read own daily feed"
  on public.daily_feeds for select
  to authenticated
  using (auth.uid() = user_id);
