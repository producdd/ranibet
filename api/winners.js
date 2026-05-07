import { fetchSupabaseRows, getCurrentMonthInfo, getMonthlyWeeklyPeriods, buildMonthlyRankingRowsFromWeeklyPeriods } from './ranking.js';

const CACHE_TTL_SECONDS = 86400;
const WINNERS_CACHE = new Map();
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

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

function setHeaders(res) {
  res.setHeader('Cache-Control', `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function getCached(key) {
  const entry = WINNERS_CACHE.get(key);
  if (!entry) return null;
  if ((Date.now() - entry.createdAt) > CACHE_TTL_SECONDS * 1000) {
    WINNERS_CACHE.delete(key);
    return null;
  }
  return entry.payload;
}

function setCached(key, payload) {
  WINNERS_CACHE.set(key, { createdAt: Date.now(), payload });
}

function formatMonthLabel(monthId) {
  const [yearTxt, monthTxt] = String(monthId || '').split('-');
  const year = Number(yearTxt);
  const monthIndex = Number(monthTxt) - 1;
  const monthLabel = MONTHS_ES[monthIndex] || monthTxt || '';
  return `${monthLabel} ${year}`.trim();
}

function createMonthInfoFromId(monthId) {
  const [yearTxt, monthTxt] = String(monthId || '').split('-');
  const year = Number(yearTxt);
  const month = Number(monthTxt);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return getCurrentMonthInfo(new Date(year, month - 1, 15));
}

function getClosedMonthIds(ticketRows = []) {
  const nowMonth = getCurrentMonthInfo();
  const ids = new Set();
  ticketRows.forEach((row) => {
    const createdAt = new Date(row?.created_at || '');
    if (!Number.isFinite(createdAt.getTime())) return;
    const monthInfo = getCurrentMonthInfo(createdAt);
    if (monthInfo.id >= nowMonth.id) return;
    ids.add(monthInfo.id);
  });
  return Array.from(ids).sort().reverse();
}

function buildMonthlyWinnerHistory(ticketRows = [], snapshotRows = [], profileRows = []) {
  const closedMonthIds = getClosedMonthIds(ticketRows);
  return closedMonthIds.map((monthId) => {
    const monthInfo = createMonthInfoFromId(monthId);
    if (!monthInfo) return null;
    const periods = getMonthlyWeeklyPeriods(new Date(monthInfo.start.getFullYear(), monthInfo.start.getMonth(), 15))
      .filter((period) => period.end <= monthInfo.end);

    const rangeStart = monthInfo.start.getTime();
    const rangeEnd = monthInfo.end.getTime();
    const rows = buildMonthlyRankingRowsFromWeeklyPeriods(
      periods,
      ticketRows.filter((row) => {
        const createdAt = new Date(row?.created_at || '');
        return Number.isFinite(createdAt.getTime()) && createdAt.getTime() >= rangeStart && createdAt.getTime() < rangeEnd;
      }),
      snapshotRows.filter((row) => periods.some((period) => period.id === row.week_id)),
      profileRows
    );

    if (!rows.length) return null;
    const winner = rows[0];
    return {
      monthId,
      monthLabel: formatMonthLabel(monthId),
      seasonLabel: `Temporada ${monthInfo.start.getFullYear()}`,
      winnerName: winner.name,
      winnerTitle: `Campeón de ${formatMonthLabel(monthId)}`,
      points: Number(winner.points || 0),
      podiums: Number(winner.podiums || 0),
      weeklyWins: Number(winner.won || 0),
      avgWinRate: Number(winner.avgWinRate || 0),
      weeksCount: Number(rows[0]?.bets || 0),
      leaderboard: rows.slice(0, 3).map((row) => ({
        pos: row.pos,
        name: row.name,
        points: row.points
      }))
    };
  }).filter(Boolean);
}

export default async function handler(req, res) {
  try {
    setHeaders(res);

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    if (!hasTrustedOrigin(req)) {
      return res.status(403).json({ error: 'forbidden_origin' });
    }

    const cached = getCached('monthly');
    if (cached) return res.status(200).json({ ...cached, cached: true });

    const [ticketRows, snapshotRows, profileRows] = await Promise.all([
      fetchSupabaseRows('bet_tickets', [
        ['select', 'email,username,status,picks,stake,payout,total_odd,created_at'],
        ['username', 'not.is.null'],
        ['username', 'neq.']
      ]),
      fetchSupabaseRows('weekly_rank_snapshots', [
        ['select', 'week_id,email,username,starting_coins']
      ]),
      fetchSupabaseRows('profiles', [
        ['select', 'email,username,coins,title'],
        ['username', 'not.is.null'],
        ['username', 'neq.']
      ])
    ]);

    const payload = {
      type: 'monthly_winners',
      rows: buildMonthlyWinnerHistory(ticketRows, snapshotRows, profileRows),
      generatedAt: new Date().toISOString(),
      cached: false
    };

    setCached('monthly', payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('winners_api_error', error);
    return res.status(500).json({
      error: 'winners_unavailable',
      message: String(error?.message || 'unknown_error')
    });
  }
}
