const SUPABASE_URL = 'https://gdntslyfogqzvzevcbnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y7mTO19Wp96L5QwHiEwWAg_2OH4RtEB';

const WEEKLY_RANKING_LIMIT = 50;
const MONTHLY_RANKING_LIMIT = 10;
const HISTORICAL_RANKING_LIMIT = 10;
const MONTHLY_POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

const CACHE_TTL_BY_TYPE = {
  weekly: 15,
  monthly: 600,
  historical: 86400
};

const RANKING_CACHE = new Map();

function hasTrustedOrigin(req) {
  const host = String(req.headers.host || '').trim().toLowerCase();
  if (!host) return true;

  const candidates = [req.headers.origin, req.headers.referer]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (!candidates.length) return true;

  return candidates.some((value) => {
    try {
      return new URL(value).host.toLowerCase() === host;
    } catch {
      return false;
    }
  });
}

function setRankingCacheHeaders(res, type) {
  const ttl = CACHE_TTL_BY_TYPE[type] || 30;
  res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`);
}

function getCacheEntry(type) {
  const ttl = (CACHE_TTL_BY_TYPE[type] || 30) * 1000;
  const entry = RANKING_CACHE.get(type);
  if (!entry) return null;
  if ((Date.now() - entry.createdAt) > ttl) {
    RANKING_CACHE.delete(type);
    return null;
  }
  return entry.payload;
}

function setCacheEntry(type, payload) {
  RANKING_CACHE.set(type, {
    createdAt: Date.now(),
    payload
  });
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json'
  };
}

export async function fetchSupabaseRows(table, params = []) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  params.forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url, { headers: supabaseHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`supabase_${table}_${response.status}:${text}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  if (day !== 1) d.setHours(-24 * (day - 1));
  return d;
}

function getISOWeekNumber(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
}

function getCurrentWeekInfo(now = new Date()) {
  const start = getStartOfWeek(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const weekNumber = getISOWeekNumber(now);
  return {
    id: `${start.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
    weekNumber,
    start,
    end
  };
}

export function getCurrentMonthInfo(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return {
    id: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    start,
    end
  };
}

function getWeekEndInclusive(weekInfo) {
  const endInclusive = new Date(weekInfo.end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  return endInclusive;
}

export function getMonthlyWeeklyPeriods(now = new Date()) {
  const monthInfo = getCurrentMonthInfo(now);
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const lastVisibleDate = new Date(Math.min(today.getTime(), monthInfo.end.getTime() - 1));
  const periods = [];
  const seen = new Set();
  let cursor = getStartOfWeek(monthInfo.start);

  while (cursor <= lastVisibleDate) {
    const weekInfo = getCurrentWeekInfo(cursor);
    const endInclusive = getWeekEndInclusive(weekInfo);
    const belongsToMonth = endInclusive.getFullYear() === monthInfo.start.getFullYear()
      && endInclusive.getMonth() === monthInfo.start.getMonth();

    if (belongsToMonth && !seen.has(weekInfo.id)) {
      periods.push({ ...weekInfo, endInclusive });
      seen.add(weekInfo.id);
    }

    cursor = new Date(weekInfo.end);
  }

  return periods;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRankingKey(email, username) {
  return String(email || username || '').trim().toLowerCase();
}

function normalizeStoredPick(pick = {}) {
  return {
    matchId: pick.matchId || '',
    match: pick.match || '',
    type: String(pick.type || '').toLowerCase(),
    odd: Number(pick.odd || 0)
  };
}

function createRankingPeriodUser(seed = {}) {
  return {
    key: seed.key || '',
    name: seed.name || 'Brutality',
    title: seed.title || '',
    initialBankroll: Number(seed.initialBankroll || 0),
    totalStaked: 0,
    totalPayout: 0,
    totalTickets: 0,
    wonTickets: 0,
    lostTickets: 0,
    pendingTickets: 0,
    bestOdd: 0,
    matches: new Map()
  };
}

function getOrCreateRankingPeriodUser(map, key, seed = {}) {
  if (!map.has(key)) map.set(key, createRankingPeriodUser({ key, ...seed }));
  const user = map.get(key);
  if (seed.name) user.name = seed.name;
  if (seed.title) user.title = seed.title;
  if (seed.initialBankroll && !user.initialBankroll) user.initialBankroll = Number(seed.initialBankroll);
  return user;
}

function computeTotalMatches(ticketRows = []) {
  const keys = new Set();
  ticketRows.forEach((row) => {
    const picks = Array.isArray(row.picks) ? row.picks.map(normalizeStoredPick) : [];
    picks.forEach((pick) => {
      const matchKey = String(pick.matchId || pick.match || '').trim();
      if (matchKey) keys.add(matchKey);
    });
  });
  return Math.max(keys.size, 1);
}

function buildPeriodRankingRowsV2(ticketRows = [], snapshotRows = [], profileRows = [], options = {}) {
  const totalMatches = Math.max(Number(options.totalMatches || computeTotalMatches(ticketRows)), 1);
  const limit = Number(options.limit || WEEKLY_RANKING_LIMIT);
  const officialResolved = Number(options.officialResolved || 3);
  const rankingMap = new Map();

  snapshotRows.forEach((row) => {
    const key = getRankingKey(row.email, row.username);
    if (!key) return;
    getOrCreateRankingPeriodUser(rankingMap, key, {
      name: row.username || 'Brutality',
      initialBankroll: Number(row.starting_coins || 0)
    });
  });

  profileRows.forEach((row) => {
    const key = getRankingKey(row.email, row.username);
    if (!key) return;
    getOrCreateRankingPeriodUser(rankingMap, key, {
      name: row.username || 'Brutality',
      title: row.title || '',
      initialBankroll: Number(row.coins || 0)
    });
  });

  ticketRows.forEach((row) => {
    const key = getRankingKey(row.email, row.username);
    if (!key) return;
    const picks = Array.isArray(row.picks) ? row.picks.map(normalizeStoredPick).filter((p) => p.matchId || p.match) : [];
    if (!picks.length) return;

    const user = getOrCreateRankingPeriodUser(rankingMap, key, { name: row.username || 'Brutality' });
    const totalStake = Number(row.stake || 0);
    const totalPayout = Number(row.payout || 0);
    const totalOdd = Number(row.total_odd || row.totalOdd || 0);
    const stakeShare = totalStake / picks.length;
    const payoutShare = totalPayout / picks.length;

    user.totalTickets += 1;
    user.totalStaked += totalStake;
    user.totalPayout += totalPayout;
    user.bestOdd = Math.max(user.bestOdd, totalOdd);
    if (row.status === 'WON') user.wonTickets += 1;
    else if (row.status === 'LOST') user.lostTickets += 1;
    else user.pendingTickets += 1;

    picks.forEach((pick) => {
      const matchKey = String(pick.matchId || pick.match || '').trim();
      if (!matchKey) return;
      if (!user.matches.has(matchKey)) {
        user.matches.set(matchKey, {
          sides: new Set(),
          hasWon: false,
          hasLost: false,
          hasPending: false
        });
      }

      const summary = user.matches.get(matchKey);
      if (pick.type) summary.sides.add(pick.type);
      if (row.status === 'WON') summary.hasWon = true;
      if (row.status === 'LOST') summary.hasLost = true;
      if (row.status === 'PENDING') summary.hasPending = true;
      summary.stake = Number(summary.stake || 0) + stakeShare;
      summary.payout = Number(summary.payout || 0) + payoutShare;
    });
  });

  const rows = Array.from(rankingMap.values()).map((user) => {
    let won = 0;
    let lost = 0;
    let contaminated = 0;
    let pending = 0;

    user.matches.forEach((match) => {
      const contaminatedMatch = match.sides.size > 1 || (match.hasWon && match.hasLost);
      if (contaminatedMatch) {
        contaminated += 1;
        return;
      }
      if (match.hasWon) {
        won += 1;
        return;
      }
      if (match.hasLost) {
        lost += 1;
        return;
      }
      pending += 1;
    });

    const played = user.matches.size;
    const resolved = won + lost + contaminated;
    const winRate = resolved ? won / resolved : 0;
    const coverageRate = played / totalMatches;
    const baseBankroll = Math.max(Number(user.initialBankroll || 0), 1);
    const riskRate = clamp(user.totalStaked / baseBankroll, 0, 1);
    const cleanRate = played ? (played - contaminated) / played : 1;
    const score = (winRate * 50) + (riskRate * 25) + (coverageRate * 20) + (cleanRate * 5);
    const profit = user.totalPayout - user.totalStaked;

    return {
      key: user.key,
      pos: 0,
      name: user.name || 'Brutality',
      title: user.title || '',
      bets: played,
      won,
      lost,
      pending,
      contaminated,
      profit: Number(profit.toFixed(2)),
      bestOdd: Number(user.bestOdd || 0),
      winRate: Number((winRate * 100).toFixed(1)),
      riskRate: Number((riskRate * 100).toFixed(1)),
      coverageRate: Number((coverageRate * 100).toFixed(1)),
      cleanRate: Number((cleanRate * 100).toFixed(1)),
      score: Number(score.toFixed(2)),
      status: resolved >= officialResolved ? 'OFICIAL' : 'PROVISIONAL'
    };
  });

  rows.sort((a, b) =>
    b.score - a.score
    || b.winRate - a.winRate
    || b.riskRate - a.riskRate
    || b.coverageRate - a.coverageRate
    || b.won - a.won
    || a.contaminated - b.contaminated
    || b.profit - a.profit
  );

  return rows.slice(0, limit).map((row, index) => ({ ...row, pos: index + 1 }));
}

function buildHistoricalRankingRowsV2(ticketRows = [], profileRows = []) {
  const rankingMap = new Map();

  profileRows.forEach((row) => {
    const key = getRankingKey(row.email, row.username);
    if (!key) return;
    getOrCreateRankingPeriodUser(rankingMap, key, {
      name: row.username || 'Brutality',
      title: row.title || ''
    });
  });

  ticketRows.forEach((row) => {
    const key = getRankingKey(row.email, row.username);
    if (!key) return;
    const user = getOrCreateRankingPeriodUser(rankingMap, key, { name: row.username || 'Brutality' });
    const stake = Number(row.stake || 0);
    const payout = Number(row.payout || 0);
    const totalOdd = Number(row.total_odd || row.totalOdd || 0);

    user.totalTickets += 1;
    user.bestOdd = Math.max(user.bestOdd, totalOdd);
    if (row.status === 'WON') {
      user.wonTickets += 1;
      user.totalStaked += stake;
      user.totalPayout += payout;
    } else if (row.status === 'LOST') {
      user.lostTickets += 1;
      user.totalStaked += stake;
    } else {
      user.pendingTickets += 1;
    }
  });

  return Array.from(rankingMap.values())
    .map((user) => {
      const settled = user.wonTickets + user.lostTickets;
      const winRate = settled ? (user.wonTickets / settled) * 100 : 0;
      const profit = user.totalPayout - user.totalStaked;
      return {
        key: user.key,
        pos: 0,
        name: user.name || 'Brutality',
        bets: user.totalTickets,
        won: user.wonTickets,
        profit: Number(profit.toFixed(2)),
        bestOdd: Number(user.bestOdd || 0),
        winRate: Number(winRate.toFixed(1)),
        title: user.title || '',
        score: Number(profit.toFixed(2)),
        status: 'Leyenda',
        coverageRate: 0,
        riskRate: 0,
        cleanRate: 100
      };
    })
    .sort((a, b) => {
      const activityA = (a.bets > 0 || a.won > 0 || a.profit !== 0) ? 1 : 0;
      const activityB = (b.bets > 0 || b.won > 0 || b.profit !== 0) ? 1 : 0;
      return (
        activityB - activityA
        || b.won - a.won
        || b.bets - a.bets
        || b.winRate - a.winRate
        || b.profit - a.profit
        || b.bestOdd - a.bestOdd
      );
    })
    .slice(0, HISTORICAL_RANKING_LIMIT)
    .map((row, index) => ({ ...row, pos: index + 1 }));
}

function isRowInPeriod(row, periodInfo) {
  const createdAt = new Date(row?.created_at || '');
  if (!Number.isFinite(createdAt.getTime())) return false;
  return createdAt >= periodInfo.start && createdAt < periodInfo.end;
}

function createMonthlyStandingUser(seed = {}) {
  return {
    key: seed.key || '',
    name: seed.name || 'Brutality',
    title: seed.title || '',
    points: 0,
    weeksPlayed: 0,
    weeklyWins: 0,
    podiums: 0,
    bestWeeklyFinish: 999,
    totalWeeklyPosition: 0,
    totalWeeklyScore: 0,
    totalWeeklyProfit: 0,
    totalWeeklyWinRate: 0,
    lastWeekPosition: null
  };
}

export function buildMonthlyRankingRowsFromWeeklyPeriods(periods = [], ticketRows = [], snapshotRows = [], profileRows = []) {
  const monthlyMap = new Map();

  periods.forEach((period) => {
    const weeklyRows = buildPeriodRankingRowsV2(
      ticketRows.filter((row) => isRowInPeriod(row, period)),
      snapshotRows.filter((row) => row.week_id === period.id),
      profileRows,
      { totalMatches: computeTotalMatches(ticketRows.filter((row) => isRowInPeriod(row, period))), limit: WEEKLY_RANKING_LIMIT }
    );

    weeklyRows.forEach((row) => {
      const key = String(row.key || getRankingKey('', row.name)).trim().toLowerCase();
      if (!key) return;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, createMonthlyStandingUser({
          key,
          name: row.name,
          title: row.title
        }));
      }

      const monthlyUser = monthlyMap.get(key);
      monthlyUser.name = row.name || monthlyUser.name;
      monthlyUser.title = row.title || monthlyUser.title;
      monthlyUser.weeksPlayed += 1;
      monthlyUser.points += Number(MONTHLY_POINTS_BY_POSITION[row.pos - 1] || 0);
      monthlyUser.weeklyWins += row.pos === 1 ? 1 : 0;
      monthlyUser.podiums += row.pos <= 3 ? 1 : 0;
      monthlyUser.bestWeeklyFinish = Math.min(monthlyUser.bestWeeklyFinish, row.pos);
      monthlyUser.totalWeeklyPosition += Number(row.pos || 0);
      monthlyUser.totalWeeklyScore += Number(row.score || 0);
      monthlyUser.totalWeeklyProfit += Number(row.profit || 0);
      monthlyUser.totalWeeklyWinRate += Number(row.winRate || 0);
      monthlyUser.lastWeekPosition = row.pos;
    });
  });

  return Array.from(monthlyMap.values())
    .map((user) => {
      const avgWeeklyFinish = user.weeksPlayed ? user.totalWeeklyPosition / user.weeksPlayed : 0;
      const avgWinRate = user.weeksPlayed ? user.totalWeeklyWinRate / user.weeksPlayed : 0;
      return {
        key: user.key,
        pos: 0,
        name: user.name || 'Brutality',
        title: user.title || '',
        points: Number(user.points || 0),
        bets: user.weeksPlayed,
        won: user.weeklyWins,
        podiums: user.podiums,
        bestWeeklyFinish: user.bestWeeklyFinish === 999 ? 0 : user.bestWeeklyFinish,
        avgWeeklyScore: Number((user.weeksPlayed ? user.totalWeeklyScore / user.weeksPlayed : 0).toFixed(2)),
        avgWeeklyFinish: Number(avgWeeklyFinish.toFixed(2)),
        avgWinRate: Number(avgWinRate.toFixed(1)),
        profit: Number(user.totalWeeklyProfit.toFixed(2)),
        lastWeekPosition: user.lastWeekPosition || 0,
        score: Number(user.points || 0),
        status: 'ACUMULADO'
      };
    })
    .sort((a, b) =>
      b.points - a.points
      || b.won - a.won
      || b.podiums - a.podiums
      || a.avgWeeklyFinish - b.avgWeeklyFinish
      || b.avgWeeklyScore - a.avgWeeklyScore
      || b.avgWinRate - a.avgWinRate
      || b.profit - a.profit
      || a.bestWeeklyFinish - b.bestWeeklyFinish
    )
    .slice(0, MONTHLY_RANKING_LIMIT)
    .map((row, index) => ({ ...row, pos: index + 1 }));
}

function normalizeClosedWeeklyRows(rows = []) {
  return rows
    .map((row) => ({
      key: getRankingKey(row.email, row.username),
      pos: Number(row.pos || 0),
      name: row.username || 'Brutality',
      title: row.title || '',
      bets: Number(row.bets || 0),
      won: Number(row.won || 0),
      lost: Number(row.lost || 0),
      pending: Number(row.pending || 0),
      contaminated: Number(row.contaminated || 0),
      profit: Number(row.profit || 0),
      bestOdd: Number(row.best_odd || 0),
      winRate: Number(row.win_rate || 0),
      riskRate: Number(row.risk_rate || 0),
      coverageRate: Number(row.coverage_rate || 0),
      cleanRate: Number(row.clean_rate || 0),
      score: Number(row.score || 0),
      status: row.status || 'OFICIAL'
    }))
    .filter((row) => row.key && row.pos > 0)
    .sort((a, b) => a.pos - b.pos);
}

export function buildMonthlyRankingRowsFromFrozenWeeks(periods = [], ticketRows = [], snapshotRows = [], profileRows = [], frozenWeeks = {}) {
  const monthlyMap = new Map();

  periods.forEach((period) => {
    const frozenRows = normalizeClosedWeeklyRows(frozenWeeks[period.id] || []);
    const weeklyRows = frozenRows.length
      ? frozenRows
      : buildPeriodRankingRowsV2(
          ticketRows.filter((row) => isRowInPeriod(row, period)),
          snapshotRows.filter((row) => row.week_id === period.id),
          profileRows,
          { totalMatches: computeTotalMatches(ticketRows.filter((row) => isRowInPeriod(row, period))), limit: WEEKLY_RANKING_LIMIT }
        );

    weeklyRows.forEach((row) => {
      const key = String(row.key || getRankingKey('', row.name)).trim().toLowerCase();
      if (!key) return;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, createMonthlyStandingUser({
          key,
          name: row.name,
          title: row.title
        }));
      }

      const monthlyUser = monthlyMap.get(key);
      monthlyUser.name = row.name || monthlyUser.name;
      monthlyUser.title = row.title || monthlyUser.title;
      monthlyUser.weeksPlayed += 1;
      monthlyUser.points += Number(MONTHLY_POINTS_BY_POSITION[row.pos - 1] || 0);
      monthlyUser.weeklyWins += row.pos === 1 ? 1 : 0;
      monthlyUser.podiums += row.pos <= 3 ? 1 : 0;
      monthlyUser.bestWeeklyFinish = Math.min(monthlyUser.bestWeeklyFinish, row.pos);
      monthlyUser.totalWeeklyPosition += Number(row.pos || 0);
      monthlyUser.totalWeeklyScore += Number(row.score || 0);
      monthlyUser.totalWeeklyProfit += Number(row.profit || 0);
      monthlyUser.totalWeeklyWinRate += Number(row.winRate || 0);
      monthlyUser.lastWeekPosition = row.pos;
    });
  });

  return Array.from(monthlyMap.values())
    .map((user) => {
      const avgWeeklyFinish = user.weeksPlayed ? user.totalWeeklyPosition / user.weeksPlayed : 0;
      const avgWinRate = user.weeksPlayed ? user.totalWeeklyWinRate / user.weeksPlayed : 0;
      return {
        key: user.key,
        pos: 0,
        name: user.name || 'Brutality',
        title: user.title || '',
        points: Number(user.points || 0),
        bets: user.weeksPlayed,
        won: user.weeklyWins,
        podiums: user.podiums,
        bestWeeklyFinish: user.bestWeeklyFinish === 999 ? 0 : user.bestWeeklyFinish,
        avgWeeklyScore: Number((user.weeksPlayed ? user.totalWeeklyScore / user.weeksPlayed : 0).toFixed(2)),
        avgWeeklyFinish: Number(avgWeeklyFinish.toFixed(2)),
        avgWinRate: Number(avgWinRate.toFixed(1)),
        profit: Number(user.totalWeeklyProfit.toFixed(2)),
        lastWeekPosition: user.lastWeekPosition || 0,
        score: Number(user.points || 0),
        status: 'ACUMULADO'
      };
    })
    .sort((a, b) =>
      b.points - a.points
      || b.won - a.won
      || b.podiums - a.podiums
      || a.avgWeeklyFinish - b.avgWeeklyFinish
      || b.avgWeeklyScore - a.avgWeeklyScore
      || b.avgWinRate - a.avgWinRate
      || b.profit - a.profit
      || a.bestWeeklyFinish - b.bestWeeklyFinish
    )
    .slice(0, MONTHLY_RANKING_LIMIT)
    .map((row, index) => ({ ...row, pos: index + 1 }));
}

async function buildWeeklyRankingPayload() {
  const weekInfo = getCurrentWeekInfo();
  const [ticketRows, snapshotRows, profileRows] = await Promise.all([
    fetchSupabaseRows('bet_tickets', [
      ['select', 'email,username,status,picks,stake,payout,total_odd,created_at'],
      ['created_at', `gte.${weekInfo.start.toISOString()}`],
      ['created_at', `lt.${weekInfo.end.toISOString()}`],
      ['username', 'not.is.null'],
      ['username', 'neq.']
    ]),
    fetchSupabaseRows('weekly_rank_snapshots', [
      ['select', 'email,username,starting_coins'],
      ['week_id', `eq.${weekInfo.id}`]
    ]),
    fetchSupabaseRows('profiles', [
      ['select', 'email,username,coins,title'],
      ['username', 'not.is.null'],
      ['username', 'neq.']
    ])
  ]);

  return {
    type: 'weekly',
    unavailable: false,
    weekInfo,
    rows: buildPeriodRankingRowsV2(ticketRows, snapshotRows, profileRows, {
      totalMatches: computeTotalMatches(ticketRows),
      limit: WEEKLY_RANKING_LIMIT
    })
  };
}

function buildInFilter(values = []) {
  const clean = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => `"${value.replace(/"/g, '\\"')}"`);
  return clean.length ? `in.(${clean.join(',')})` : '';
}

async function buildMonthlyRankingPayload() {
  const monthInfo = getCurrentMonthInfo();
  const periods = getMonthlyWeeklyPeriods();
  if (!periods.length) {
    return { type: 'monthly', unavailable: false, monthInfo, periods, rows: [] };
  }

  const rangeStart = periods[0].start.toISOString();
  const rangeEnd = periods[periods.length - 1].end.toISOString();
  const weekIds = periods.map((period) => period.id);

  const [ticketRows, snapshotRows, profileRows] = await Promise.all([
    fetchSupabaseRows('bet_tickets', [
      ['select', 'email,username,status,picks,stake,payout,total_odd,created_at'],
      ['created_at', `gte.${rangeStart}`],
      ['created_at', `lt.${rangeEnd}`],
      ['username', 'not.is.null'],
      ['username', 'neq.']
    ]),
    fetchSupabaseRows('weekly_rank_snapshots', [
      ['select', 'week_id,email,username,starting_coins'],
      ['week_id', buildInFilter(weekIds)]
    ]),
    fetchSupabaseRows('profiles', [
      ['select', 'email,username,coins,title'],
      ['username', 'not.is.null'],
      ['username', 'neq.']
    ])
  ]);

  let frozenRows = [];
  try {
    frozenRows = await fetchSupabaseRows('weekly_rank_results', [
      ['select', 'week_id,email,username,title,pos,status,score,win_rate,risk_rate,coverage_rate,clean_rate,profit,best_odd,bets,won,lost,pending,contaminated,closed_at'],
      ['week_id', buildInFilter(weekIds)]
    ]);
  } catch {
    frozenRows = [];
  }

  const frozenWeeks = frozenRows.reduce((acc, row) => {
    const weekId = String(row.week_id || '').trim();
    if (!weekId) return acc;
    if (!acc[weekId]) acc[weekId] = [];
    acc[weekId].push(row);
    return acc;
  }, {});

  return {
    type: 'monthly',
    unavailable: false,
    monthInfo,
    periods,
    rows: buildMonthlyRankingRowsFromFrozenWeeks(periods, ticketRows, snapshotRows, profileRows, frozenWeeks)
  };
}

async function buildHistoricalRankingPayload() {
  const [ticketRows, profileRows] = await Promise.all([
    fetchSupabaseRows('bet_tickets', [
      ['select', 'email,username,status,stake,payout,total_odd,created_at'],
      ['username', 'not.is.null'],
      ['username', 'neq.']
    ]),
    fetchSupabaseRows('profiles', [
      ['select', 'email,username,title'],
      ['username', 'not.is.null'],
      ['username', 'neq.']
    ])
  ]);

  return {
    type: 'historical',
    unavailable: false,
    rows: buildHistoricalRankingRowsV2(ticketRows, profileRows)
  };
}

export default async function handler(req, res) {
  try {
    setRankingCacheHeaders(res, String(req.query?.type || 'weekly'));
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    if (!hasTrustedOrigin(req)) {
      return res.status(403).json({ error: 'forbidden_origin' });
    }

    const type = ['weekly', 'monthly', 'historical'].includes(String(req.query?.type || 'weekly'))
      ? String(req.query?.type || 'weekly')
      : 'weekly';

    const cached = getCacheEntry(type);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    let payload;
    if (type === 'historical') payload = await buildHistoricalRankingPayload();
    else if (type === 'monthly') payload = await buildMonthlyRankingPayload();
    else payload = await buildWeeklyRankingPayload();

    payload.generatedAt = new Date().toISOString();
    payload.cached = false;
    setCacheEntry(type, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('ranking_api_error', error);
    return res.status(500).json({
      error: 'ranking_unavailable',
      message: String(error?.message || 'unknown_error')
    });
  }
}
