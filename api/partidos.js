const TARGET_LEAGUES = {
  "PER.1": "Liga 1 Peruana",
  "UEFA.CHAMPIONS": "UEFA Champions League",
  "CONMEBOL.LIBERTADORES": "Copa Libertadores",
  "ENG.1": "Premier League",
  "ITA.1": "Serie A",
};

function americanToDecimal(raw) {
  if (raw === null || raw === undefined) return "";
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n === 0) return "";
  const dec = n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  return dec.toFixed(2);
}

function normalizeMinute(status = {}) {
  const short = String(status.shortDetail || "").trim();
  const display = String(status.displayClock || "").trim();
  if (!short) return display ? display.replace(/['’]/g, "") : "";
  const up = short.toUpperCase();
  if (up === "HT" || up === "FT") return up;
  if (short.includes("'") || short.includes("’")) return short.replace(/['’]/g, "");
  if ((up === "LIVE" || up === "EN VIVO" || up === "IN PROGRESS") && display) return display.replace(/['’]/g, "");
  return short;
}

function isLive(status = {}) {
  const state = String(status?.type?.state || "").toLowerCase();
  const short = String(status.shortDetail || "").toUpperCase();
  return state === "in" || short === "HT" || short === "1H" || short === "2H" || short.includes("'") || short.includes("’");
}

function mapEvent(event, leagueName, sourceUrl) {
  const comp = (event.competitions || [])[0] || {};
  const competitors = comp.competitors || [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const homeName = String(home?.team?.displayName || "").trim();
  const awayName = String(away?.team?.displayName || "").trim();
  if (!homeName || !awayName) return null;

  const iso = String(event.date || comp.date || "");
  let dt = null;
  if (iso) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) dt = parsed;
  }

  const status = event.status || {};
  const homeScore = String(home.score || "").trim();
  const awayScore = String(away.score || "").trim();
  const score = /^\d+$/.test(homeScore) && /^\d+$/.test(awayScore) ? `${homeScore}-${awayScore}` : "";

  let oddH = "", oddD = "", oddA = "", oddsVerified = false;
  const odds = (comp.odds || [])[0];
  if (odds) {
    const ml = odds.moneyline || {};
    const homeML = ml?.home?.close?.odds;
    const awayML = ml?.away?.close?.odds;
    const drawML = ml?.draw?.close?.odds ?? odds?.drawOdds?.moneyLine;
    oddH = americanToDecimal(homeML);
    oddD = americanToDecimal(drawML);
    oddA = americanToDecimal(awayML);
    oddsVerified = Boolean(oddH && oddD && oddA);
  }

  return {
    torneo: leagueName,
    local: homeName,
    visitante: awayName,
    cuota_local: oddH,
    cuota_empate: oddD,
    cuota_visitante: oddA,
    mejor_cuota_local: oddH,
    mejor_cuota_empate: oddD,
    mejor_cuota_visitante: oddA,
    odds_detalle: [],
    odds_source: "espn",
    odds_verified: oddsVerified,
    hora_partido: dt ? dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Lima" }) : "",
    fecha_partido: dt ? dt.toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ") : "",
    match_datetime: dt ? dt.toISOString() : "",
    live: isLive(status),
    live_state: String(status?.type?.state || "").toLowerCase(),
    minute: normalizeMinute(status),
    score,
    status: String(status?.type?.description || status.shortDetail || "").trim(),
    time_text: String(status.shortDetail || "").trim(),
    fuente_url: sourceUrl,
    fecha_scrape: new Date().toISOString(),
  };
}

async function fetchLeague(code) {
  const now = new Date();
  const dates = [now, new Date(now.getTime() + 24 * 60 * 60 * 1000)];
  const out = [];
  const seen = new Set();

  for (const d of dates) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const ymd = `${y}${m}${day}`;
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${ymd}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
    if (!res.ok) continue;
    const data = await res.json();
    for (const ev of data.events || []) {
      const id = String(ev.id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const mapped = mapEvent(ev, TARGET_LEAGUES[code], url);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const rows = [];
    for (const code of Object.keys(TARGET_LEAGUES)) {
      const leagueRows = await fetchLeague(code);
      rows.push(...leagueRows);
    }
    rows.sort((a, b) => (a.live === b.live ? String(a.match_datetime || "").localeCompare(String(b.match_datetime || "")) : a.live ? -1 : 1));
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: "feed_error", message: String(err && err.message ? err.message : err) });
  }
}
