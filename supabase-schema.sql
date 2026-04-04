-- ─────────────────────────────────────────────────────────────
-- Kharcha — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- ─── Expenses ────────────────────────────────────────────────
create table if not exists expenses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null default 'Other',
  note        text,
  date        date not null default current_date,
  created_at  timestamptz default now()
);

-- Indexes
create index if not exists expenses_user_id_date on expenses(user_id, date desc);
create index if not exists expenses_user_id_category on expenses(user_id, category);

-- RLS
alter table expenses enable row level security;

create policy "Users see own expenses"
  on expenses for select using (auth.uid() = user_id);

create policy "Users insert own expenses"
  on expenses for insert with check (auth.uid() = user_id);

create policy "Users update own expenses"
  on expenses for update using (auth.uid() = user_id);

create policy "Users delete own expenses"
  on expenses for delete using (auth.uid() = user_id);

-- ─── Income ──────────────────────────────────────────────────
create table if not exists income (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  amount      numeric(12, 2) not null check (amount > 0),
  note        text,
  date        date not null default current_date,
  created_at  timestamptz default now()
);

create index if not exists income_user_id_date on income(user_id, date desc);

alter table income enable row level security;

create policy "Users see own income"
  on income for select using (auth.uid() = user_id);

create policy "Users insert own income"
  on income for insert with check (auth.uid() = user_id);

create policy "Users delete own income"
  on income for delete using (auth.uid() = user_id);

-- ─── Budgets ─────────────────────────────────────────────────
create table if not exists budgets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  month       integer not null check (month >= 0 and month <= 11),
  year        integer not null,
  amount      numeric(12, 2) not null check (amount > 0),
  created_at  timestamptz default now(),
  unique (user_id, month, year)
);

alter table budgets enable row level security;

create policy "Users see own budgets"
  on budgets for select using (auth.uid() = user_id);

create policy "Users insert own budgets"
  on budgets for insert with check (auth.uid() = user_id);

create policy "Users update own budgets"
  on budgets for update using (auth.uid() = user_id);

-- ─── Done ────────────────────────────────────────────────────
-- No further setup needed. Supabase Auth handles user accounts.
-- Row-level security ensures users only ever see their own data.
