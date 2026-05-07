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

create table if not exists public.weekly_rank_results (
  id uuid primary key default gen_random_uuid(),
  week_id text not null,
  email text not null,
  username text not null,
  title text not null default '',
  pos integer not null default 0,
  status text not null default 'PROVISIONAL',
  score numeric(10,2) not null default 0,
  win_rate numeric(10,2) not null default 0,
  risk_rate numeric(10,2) not null default 0,
  coverage_rate numeric(10,2) not null default 0,
  clean_rate numeric(10,2) not null default 0,
  profit numeric(12,2) not null default 0,
  best_odd numeric(10,2) not null default 0,
  bets integer not null default 0,
  won integer not null default 0,
  lost integer not null default 0,
  pending integer not null default 0,
  contaminated integer not null default 0,
  closed_at timestamptz not null default now(),
  unique (week_id, email)
);

create table if not exists public.system_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_source text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
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
create index if not exists bet_tickets_created_at_idx on public.bet_tickets(created_at desc);
create index if not exists bet_tickets_status_created_at_idx on public.bet_tickets(status, created_at desc);
create index if not exists bet_tickets_username_created_at_idx on public.bet_tickets(username, created_at desc) where username <> '';
create index if not exists bet_tickets_email_status_created_at_idx on public.bet_tickets(email, status, created_at desc);
create unique index if not exists weekly_rank_snapshots_week_email_key on public.weekly_rank_snapshots(week_id, email);
create index if not exists weekly_rank_snapshots_week_idx on public.weekly_rank_snapshots(week_id);
create unique index if not exists monthly_rank_snapshots_month_email_key on public.monthly_rank_snapshots(month_id, email);
create index if not exists monthly_rank_snapshots_month_idx on public.monthly_rank_snapshots(month_id);
create index if not exists weekly_rank_results_week_pos_idx on public.weekly_rank_results(week_id, pos);
create index if not exists system_event_logs_type_created_at_idx on public.system_event_logs(event_type, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_achievements enable row level security;
alter table public.bet_tickets enable row level security;
alter table public.weekly_rank_snapshots enable row level security;
alter table public.monthly_rank_snapshots enable row level security;
alter table public.weekly_rank_results enable row level security;
alter table public.system_event_logs enable row level security;

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
drop policy if exists "weekly results read global ranking" on public.weekly_rank_results;

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

create policy "weekly results read global ranking"
on public.weekly_rank_results for select
to anon, authenticated
using (username <> '');

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

create or replace function public.close_weekly_ranking_secure()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true));
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_week_id text;
  v_rows integer := 0;
  v_winner record;
begin
  if (v_uid is null or v_email is null) and v_role <> 'service_role' then
    raise exception 'AUTH_REQUIRED';
  end if;

  if v_email is null then
    v_email := 'system@ranibet.local';
  end if;

  v_week_end := date_trunc('week', timezone('America/Lima', now()));
  v_week_start := v_week_end - interval '7 day';
  v_week_id := to_char(v_week_start::date, 'IYYY-"W"IW');

  if exists (select 1 from public.weekly_rank_results where week_id = v_week_id limit 1) then
    select count(*) into v_rows
    from public.weekly_rank_results
    where week_id = v_week_id;

    select username, pos, score
      into v_winner
      from public.weekly_rank_results
     where week_id = v_week_id
     order by pos asc
     limit 1;

    return jsonb_build_object(
      'week_id', v_week_id,
      'closed', true,
      'already_closed', true,
      'rows', coalesce(v_rows, 0),
      'winner', coalesce(v_winner.username, ''),
      'winner_pos', coalesce(v_winner.pos, 0),
      'winner_score', coalesce(v_winner.score, 0)
    );
  end if;

  with ticket_rows as (
    select
      email,
      username,
      status,
      picks,
      coalesce(stake, 0)::numeric as stake,
      coalesce(payout, 0)::numeric as payout,
      coalesce(total_odd, 0)::numeric as total_odd,
      created_at
    from public.bet_tickets
    where created_at >= v_week_start
      and created_at < v_week_end
      and coalesce(username, '') <> ''
  ),
  snapshot_rows as (
    select email, username, coalesce(starting_coins, 500)::numeric as starting_coins
    from public.weekly_rank_snapshots
    where week_id = v_week_id
  ),
  profile_rows as (
    select email, username, coalesce(title, '') as title, coalesce(coins, 0)::numeric as coins
    from public.profiles
    where coalesce(username, '') <> ''
  ),
  user_sources as (
    select email, username, null::text as title, starting_coins as bankroll from snapshot_rows
    union all
    select email, username, title, coins as bankroll from profile_rows
    union all
    select email, username, null::text as title, null::numeric as bankroll from ticket_rows
  ),
  user_base as (
    select
      lower(coalesce(email, username)) as ranking_key,
      max(email) as email,
      coalesce(nullif(max(username), ''), 'Brutality') as username,
      coalesce(max(title), '') as title,
      coalesce(max(bankroll), 0)::numeric as initial_bankroll
    from user_sources
    group by lower(coalesce(email, username))
  ),
  ticket_totals as (
    select
      lower(coalesce(email, username)) as ranking_key,
      sum(stake)::numeric as total_staked,
      sum(payout)::numeric as total_payout,
      max(total_odd)::numeric as best_odd
    from ticket_rows
    group by lower(coalesce(email, username))
  ),
  expanded_picks as (
    select
      lower(coalesce(t.email, t.username)) as ranking_key,
      t.status,
      coalesce(nullif(pick ->> 'matchId', ''), nullif(pick ->> 'match', '')) as match_key,
      lower(coalesce(pick ->> 'type', '')) as pick_type
    from ticket_rows t
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(t.picks) = 'array' then t.picks
        else '[]'::jsonb
      end
    ) as pick
  ),
  total_matches as (
    select greatest(count(distinct match_key), 1)::numeric as total_matches
    from expanded_picks
    where coalesce(match_key, '') <> ''
  ),
  match_summaries as (
    select
      ranking_key,
      match_key,
      count(distinct nullif(pick_type, '')) as side_count,
      bool_or(status = 'WON') as has_won,
      bool_or(status = 'LOST') as has_lost,
      bool_or(status = 'PENDING') as has_pending
    from expanded_picks
    where coalesce(match_key, '') <> ''
    group by ranking_key, match_key
  ),
  user_match_stats as (
    select
      ranking_key,
      count(*)::integer as bets,
      count(*) filter (where side_count > 1 or (has_won and has_lost))::integer as contaminated,
      count(*) filter (where not (side_count > 1 or (has_won and has_lost)) and has_won)::integer as won,
      count(*) filter (where not (side_count > 1 or (has_won and has_lost)) and has_lost)::integer as lost,
      count(*) filter (where not (side_count > 1 or (has_won and has_lost)) and not has_won and not has_lost)::integer as pending
    from match_summaries
    group by ranking_key
  ),
  combined as (
    select
      u.ranking_key,
      u.email,
      u.username,
      u.title,
      greatest(coalesce(u.initial_bankroll, 0), 1)::numeric as initial_bankroll,
      coalesce(t.total_staked, 0)::numeric as total_staked,
      coalesce(t.total_payout, 0)::numeric as total_payout,
      coalesce(t.best_odd, 0)::numeric as best_odd,
      coalesce(m.bets, 0)::integer as bets,
      coalesce(m.won, 0)::integer as won,
      coalesce(m.lost, 0)::integer as lost,
      coalesce(m.pending, 0)::integer as pending,
      coalesce(m.contaminated, 0)::integer as contaminated
    from user_base u
    left join ticket_totals t on t.ranking_key = u.ranking_key
    left join user_match_stats m on m.ranking_key = u.ranking_key
  ),
  scored as (
    select
      c.*,
      (c.won + c.lost + c.contaminated) as resolved,
      case when (c.won + c.lost + c.contaminated) > 0 then c.won::numeric / (c.won + c.lost + c.contaminated) else 0 end as win_rate_ratio,
      case when tm.total_matches > 0 then c.bets::numeric / tm.total_matches else 0 end as coverage_rate_ratio,
      least(c.total_staked / greatest(c.initial_bankroll, 1), 1) as risk_rate_ratio,
      case when c.bets > 0 then (c.bets - c.contaminated)::numeric / c.bets else 1 end as clean_rate_ratio,
      (c.total_payout - c.total_staked)::numeric as profit
    from combined c
    cross join total_matches tm
    where c.bets > 0 or c.total_staked > 0 or c.total_payout > 0
  ),
  ranked as (
    select
      row_number() over (
        order by
          round(((win_rate_ratio * 50) + (risk_rate_ratio * 25) + (coverage_rate_ratio * 20) + (clean_rate_ratio * 5))::numeric, 2) desc,
          round((win_rate_ratio * 100)::numeric, 2) desc,
          round((risk_rate_ratio * 100)::numeric, 2) desc,
          round((coverage_rate_ratio * 100)::numeric, 2) desc,
          won desc,
          contaminated asc,
          profit desc
      )::integer as pos,
      email,
      username,
      title,
      case when resolved >= 3 then 'OFICIAL' else 'PROVISIONAL' end as status,
      round(((win_rate_ratio * 50) + (risk_rate_ratio * 25) + (coverage_rate_ratio * 20) + (clean_rate_ratio * 5))::numeric, 2) as score,
      round((win_rate_ratio * 100)::numeric, 2) as win_rate,
      round((risk_rate_ratio * 100)::numeric, 2) as risk_rate,
      round((coverage_rate_ratio * 100)::numeric, 2) as coverage_rate,
      round((clean_rate_ratio * 100)::numeric, 2) as clean_rate,
      round(profit::numeric, 2) as profit,
      round(best_odd::numeric, 2) as best_odd,
      bets,
      won,
      lost,
      pending,
      contaminated
    from scored
  )
  insert into public.weekly_rank_results (
    week_id, email, username, title, pos, status, score, win_rate, risk_rate, coverage_rate, clean_rate, profit, best_odd, bets, won, lost, pending, contaminated, closed_at
  )
  select
    v_week_id,
    email,
    username,
    title,
    pos,
    status,
    score,
    win_rate,
    risk_rate,
    coverage_rate,
    clean_rate,
    profit,
    best_odd,
    bets,
    won,
    lost,
    pending,
    contaminated,
    now()
  from ranked
  on conflict (week_id, email) do update set
    username = excluded.username,
    title = excluded.title,
    pos = excluded.pos,
    status = excluded.status,
    score = excluded.score,
    win_rate = excluded.win_rate,
    risk_rate = excluded.risk_rate,
    coverage_rate = excluded.coverage_rate,
    clean_rate = excluded.clean_rate,
    profit = excluded.profit,
    best_odd = excluded.best_odd,
    bets = excluded.bets,
    won = excluded.won,
    lost = excluded.lost,
    pending = excluded.pending,
    contaminated = excluded.contaminated,
    closed_at = excluded.closed_at;

  select count(*) into v_rows
  from public.weekly_rank_results
  where week_id = v_week_id;

  select username, pos, score
    into v_winner
    from public.weekly_rank_results
   where week_id = v_week_id
   order by pos asc
   limit 1;

  insert into public.system_event_logs(event_type, event_source, payload)
  values (
    'weekly_closure',
    'close_weekly_ranking_secure',
    jsonb_build_object(
      'week_id', v_week_id,
      'closed_by', v_email,
      'rows', coalesce(v_rows, 0),
      'winner', coalesce(v_winner.username, ''),
      'winner_score', coalesce(v_winner.score, 0)
    )
  );

  return jsonb_build_object(
    'week_id', v_week_id,
    'closed', true,
    'already_closed', false,
    'rows', coalesce(v_rows, 0),
    'winner', coalesce(v_winner.username, ''),
    'winner_pos', coalesce(v_winner.pos, 0),
    'winner_score', coalesce(v_winner.score, 0)
  );
end;
$$;

grant execute on function public.bootstrap_profile_secure(text, text) to authenticated;
grant execute on function public.set_username_secure(text) to authenticated;
grant execute on function public.redeem_promo_code_secure(text) to authenticated;
grant execute on function public.place_bet_secure(text, jsonb, numeric, numeric) to authenticated;
grant execute on function public.close_weekly_ranking_secure() to authenticated;
