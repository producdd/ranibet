create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null default '',
  handle text not null default '@ranibet',
  avatar text not null default '🐸',
  photo_url text not null default '',
  coins integer not null default 500,
  score integer not null default 0,
  bets integer not null default 0,
  won integer not null default 0,
  profit numeric not null default 0,
  best_odd numeric not null default 0,
  win_rate numeric not null default 0,
  title text not null default '',
  last_daily_bonus_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  achievement_key text not null,
  title text not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (email, achievement_key)
);

create table if not exists public.bet_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  username text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'WON', 'LOST')),
  picks jsonb not null default '[]'::jsonb,
  total_odd numeric not null default 0,
  stake numeric not null default 0,
  payout numeric not null default 0,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  username text not null default '',
  starting_coins numeric not null default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, email)
);

create table if not exists public.monthly_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  month_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  username text not null default '',
  starting_coins numeric not null default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, email)
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists photo_url text not null default '';
alter table public.profiles add column if not exists last_daily_bonus_on date;
alter table public.user_achievements add column if not exists email text;
alter table public.bet_tickets add column if not exists email text;
alter table public.bet_tickets add column if not exists username text not null default '';
alter table public.bet_tickets add column if not exists status text not null default 'PENDING';
alter table public.bet_tickets add column if not exists picks jsonb not null default '[]'::jsonb;
alter table public.bet_tickets add column if not exists total_odd numeric not null default 0;
alter table public.bet_tickets add column if not exists stake numeric not null default 0;
alter table public.bet_tickets add column if not exists payout numeric not null default 0;
alter table public.bet_tickets add column if not exists settled_at timestamptz;
alter table public.bet_tickets add column if not exists created_at timestamptz not null default now();
alter table public.bet_tickets add column if not exists updated_at timestamptz not null default now();
alter table public.weekly_rank_snapshots add column if not exists username text not null default '';
alter table public.weekly_rank_snapshots add column if not exists starting_coins numeric not null default 500;
alter table public.weekly_rank_snapshots add column if not exists created_at timestamptz not null default now();
alter table public.weekly_rank_snapshots add column if not exists updated_at timestamptz not null default now();
alter table public.monthly_rank_snapshots add column if not exists username text not null default '';
alter table public.monthly_rank_snapshots add column if not exists starting_coins numeric not null default 500;
alter table public.monthly_rank_snapshots add column if not exists created_at timestamptz not null default now();
alter table public.monthly_rank_snapshots add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_email_key on public.profiles(email);
create unique index if not exists unique_username on public.profiles(username) where username <> '';
create unique index if not exists user_achievements_email_achievement_key on public.user_achievements(email, achievement_key);
create unique index if not exists bet_tickets_ticket_code_key on public.bet_tickets(ticket_code);
create index if not exists bet_tickets_email_created_at_idx on public.bet_tickets(email, created_at desc);
create unique index if not exists weekly_rank_snapshots_week_email_key on public.weekly_rank_snapshots(week_id, email);
create index if not exists weekly_rank_snapshots_week_idx on public.weekly_rank_snapshots(week_id);
create unique index if not exists monthly_rank_snapshots_month_email_key on public.monthly_rank_snapshots(month_id, email);
create index if not exists monthly_rank_snapshots_month_idx on public.monthly_rank_snapshots(month_id);

alter table public.profiles enable row level security;
alter table public.user_achievements enable row level security;
alter table public.bet_tickets enable row level security;
alter table public.weekly_rank_snapshots enable row level security;
alter table public.monthly_rank_snapshots enable row level security;

drop policy if exists "profiles read global ranking" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "achievements read own" on public.user_achievements;
drop policy if exists "achievements insert own" on public.user_achievements;
drop policy if exists "achievements update own" on public.user_achievements;
drop policy if exists "bet tickets read own" on public.bet_tickets;
drop policy if exists "bet tickets read global ranking" on public.bet_tickets;
drop policy if exists "bet tickets insert own" on public.bet_tickets;
drop policy if exists "bet tickets update own" on public.bet_tickets;
drop policy if exists "weekly snapshots read global ranking" on public.weekly_rank_snapshots;
drop policy if exists "weekly snapshots insert own" on public.weekly_rank_snapshots;
drop policy if exists "weekly snapshots update own" on public.weekly_rank_snapshots;
drop policy if exists "monthly snapshots read global ranking" on public.monthly_rank_snapshots;
drop policy if exists "monthly snapshots insert own" on public.monthly_rank_snapshots;
drop policy if exists "monthly snapshots update own" on public.monthly_rank_snapshots;

create policy "profiles read global ranking"
on public.profiles for select
to anon, authenticated
using (true);

create policy "profiles insert own"
on public.profiles for insert
to anon, authenticated
with check (auth.uid() = user_id and auth.email() = email);

create policy "profiles update own"
on public.profiles for update
to anon, authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and auth.email() = email);

create policy "achievements read own"
on public.user_achievements for select
to authenticated
using (auth.uid() = user_id and auth.email() = email);

create policy "achievements insert own"
on public.user_achievements for insert
to authenticated
with check (auth.uid() = user_id and auth.email() = email);

create policy "achievements update own"
on public.user_achievements for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and auth.email() = email);

create policy "bet tickets read own"
on public.bet_tickets for select
to authenticated
using (auth.uid() = user_id and auth.email() = email);

create policy "bet tickets read global ranking"
on public.bet_tickets for select
to anon, authenticated
using (username <> '');

create policy "bet tickets insert own"
on public.bet_tickets for insert
to authenticated
with check (auth.uid() = user_id and auth.email() = email);

create policy "bet tickets update own"
on public.bet_tickets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and auth.email() = email);

create policy "weekly snapshots read global ranking"
on public.weekly_rank_snapshots for select
to anon, authenticated
using (username <> '');

create policy "weekly snapshots insert own"
on public.weekly_rank_snapshots for insert
to authenticated
with check (auth.uid() = user_id and auth.email() = email);

create policy "weekly snapshots update own"
on public.weekly_rank_snapshots for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and auth.email() = email);

create policy "monthly snapshots read global ranking"
on public.monthly_rank_snapshots for select
to anon, authenticated
using (username <> '');

create policy "monthly snapshots insert own"
on public.monthly_rank_snapshots for insert
to authenticated
with check (auth.uid() = user_id and auth.email() = email);

create policy "monthly snapshots update own"
on public.monthly_rank_snapshots for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and auth.email() = email);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  reward_amount integer not null default 100 check (reward_amount > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.used_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code text not null,
  reward_amount integer not null default 0,
  used_at timestamptz not null default now(),
  unique (email, code)
);

insert into public.promo_codes (code, reward_amount, active)
values ('TODOELBERNALSECO', 100, true)
on conflict (code) do update
set reward_amount = excluded.reward_amount,
    active = excluded.active;

alter table public.promo_codes enable row level security;
alter table public.used_codes enable row level security;

drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "bet tickets insert own" on public.bet_tickets;
drop policy if exists "bet tickets update own" on public.bet_tickets;
drop policy if exists "weekly snapshots insert own" on public.weekly_rank_snapshots;
drop policy if exists "weekly snapshots update own" on public.weekly_rank_snapshots;
drop policy if exists "monthly snapshots insert own" on public.monthly_rank_snapshots;
drop policy if exists "monthly snapshots update own" on public.monthly_rank_snapshots;
drop policy if exists "used codes read own" on public.used_codes;
drop policy if exists "used codes insert own" on public.used_codes;
drop policy if exists "promo codes read none" on public.promo_codes;

create policy "used codes read own"
on public.used_codes for select
to authenticated
using (auth.uid() = user_id and auth.email() = email);

create policy "promo codes read none"
on public.promo_codes for select
to authenticated
using (false);

create or replace function public.bootstrap_profile_secure(
  p_handle text default null,
  p_photo_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_today date := (now() at time zone 'America/Lima')::date;
  v_handle text := coalesce(nullif(trim(p_handle), ''), '@ranibet');
  v_photo text := coalesce(nullif(trim(p_photo_url), ''), '');
  v_profile public.profiles;
begin
  if v_uid is null or v_email is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.profiles (
    user_id, email, username, handle, avatar, photo_url, coins, score, bets, won, profit, best_odd, win_rate, title, last_daily_bonus_on
  ) values (
    v_uid, v_email, '', v_handle, case when v_photo <> '' then v_photo else '🐸' end, v_photo, 500, 0, 0, 0, 0, 0, 0, 'Nueva Rana', null
  )
  on conflict (email) do update
    set user_id = excluded.user_id,
        handle = case when coalesce(nullif(public.profiles.handle, ''), '') = '' then excluded.handle else public.profiles.handle end,
        avatar = case when excluded.photo_url <> '' then excluded.photo_url else public.profiles.avatar end,
        photo_url = case when excluded.photo_url <> '' then excluded.photo_url else public.profiles.photo_url end,
        updated_at = now()
  returning * into v_profile;

  if v_profile.last_daily_bonus_on is distinct from v_today then
    update public.profiles
       set coins = coins + 100,
           last_daily_bonus_on = v_today,
           updated_at = now()
     where id = v_profile.id
     returning * into v_profile;
  end if;

  return v_profile;
end;
$$;

create or replace function public.set_username_secure(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_username text := trim(coalesce(p_username, ''));
  v_profile public.profiles;
begin
  if v_uid is null or v_email is null then
    raise exception 'not_authenticated';
  end if;

  if v_username !~ '^[A-Za-z0-9.-]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  update public.profiles
     set username = v_username,
         updated_at = now()
   where user_id = v_uid
     and email = v_email
   returning * into v_profile;

  if v_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.redeem_promo_code_secure(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_reward integer;
  v_profile public.profiles;
begin
  if v_uid is null or v_email is null then
    raise exception 'not_authenticated';
  end if;

  if v_code !~ '^[A-Z0-9.-]{3,24}$' then
    raise exception 'invalid_code';
  end if;

  select reward_amount
    into v_reward
    from public.promo_codes
   where code = v_code
     and active = true
   limit 1;

  if v_reward is null then
    raise exception 'promo_not_found';
  end if;

  insert into public.used_codes(user_id, email, code, reward_amount, used_at)
  values (v_uid, v_email, v_code, v_reward, now());

  update public.profiles
     set coins = coins + v_reward,
         updated_at = now()
   where user_id = v_uid
     and email = v_email
   returning * into v_profile;

  if v_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  return jsonb_build_object(
    'reward_amount', v_reward,
    'profile', row_to_json(v_profile)
  );
exception
  when unique_violation then
    raise exception 'already_used';
end;
$$;

create or replace function public.place_bet_secure(
  p_ticket_code text,
  p_picks jsonb,
  p_total_odd numeric,
  p_stake numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_ticket_code text := trim(coalesce(p_ticket_code, ''));
  v_picks jsonb := coalesce(p_picks, '[]'::jsonb);
  v_total_odd numeric := round(coalesce(p_total_odd, 0)::numeric, 2);
  v_stake numeric := round(coalesce(p_stake, 0)::numeric, 2);
  v_payout numeric := round(v_total_odd * v_stake, 2);
  v_profile public.profiles;
  v_ticket public.bet_tickets;
  v_week_id text;
  v_week_start date;
  v_month_id text;
  v_month_start date;
begin
  if v_uid is null or v_email is null then
    raise exception 'not_authenticated';
  end if;

  if v_ticket_code = '' or length(v_ticket_code) > 32 then
    raise exception 'invalid_ticket_code';
  end if;

  if jsonb_typeof(v_picks) <> 'array' or jsonb_array_length(v_picks) = 0 or jsonb_array_length(v_picks) > 20 then
    raise exception 'invalid_picks';
  end if;

  if v_stake < 1 then
    raise exception 'invalid_stake';
  end if;

  if v_total_odd < 1.01 or v_total_odd > 1000 then
    raise exception 'invalid_total_odd';
  end if;

  select *
    into v_profile
    from public.profiles
   where user_id = v_uid
     and email = v_email
   for update;

  if v_profile.id is null then
    raise exception 'profile_not_found';
  end if;

  if coalesce(nullif(trim(v_profile.username), ''), '') = '' then
    raise exception 'username_required';
  end if;

  if v_profile.coins < v_stake then
    raise exception 'insufficient_balance';
  end if;

  v_week_start := date_trunc('week', (now() at time zone 'America/Lima'))::date;
  v_week_id := to_char(v_week_start, 'IYYY-"W"IW');
  v_month_start := date_trunc('month', (now() at time zone 'America/Lima'))::date;
  v_month_id := to_char(v_month_start, 'YYYY-MM');

  insert into public.weekly_rank_snapshots (week_id, user_id, email, username, starting_coins, created_at, updated_at)
  values (v_week_id, v_uid, v_email, v_profile.username, v_profile.coins, now(), now())
  on conflict (week_id, email) do nothing;

  insert into public.monthly_rank_snapshots (month_id, user_id, email, username, starting_coins, created_at, updated_at)
  values (v_month_id, v_uid, v_email, v_profile.username, v_profile.coins, now(), now())
  on conflict (month_id, email) do nothing;

  insert into public.bet_tickets (
    ticket_code, user_id, email, username, status, picks, total_odd, stake, payout, created_at, updated_at
  ) values (
    v_ticket_code, v_uid, v_email, v_profile.username, 'PENDING', v_picks, v_total_odd, v_stake, v_payout, now(), now()
  )
  returning * into v_ticket;

  update public.profiles
     set coins = coins - v_stake,
         bets = bets + 1,
         best_odd = greatest(best_odd, v_total_odd),
         win_rate = case when bets + 1 > 0 then round((won::numeric / (bets + 1)) * 100, 2) else 0 end,
         updated_at = now()
   where id = v_profile.id
   returning * into v_profile;

  return jsonb_build_object(
    'ticket', row_to_json(v_ticket),
    'profile', row_to_json(v_profile)
  );
end;
$$;

grant execute on function public.bootstrap_profile_secure(text, text) to authenticated;
grant execute on function public.set_username_secure(text) to authenticated;
grant execute on function public.redeem_promo_code_secure(text) to authenticated;
grant execute on function public.place_bet_secure(text, jsonb, numeric, numeric) to authenticated;
