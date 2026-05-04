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
  const displayClean = display.replace(/['’]/g, "");
  if (!short) {
    const clockMatch = displayClean.match(/^(\d{1,3}):\d{2}$/);
    return clockMatch ? clockMatch[1] : displayClean;
  }

  const up = short.toUpperCase();
  if (up === "HT" || up === "HALFTIME") return "MT";
  if (up === "FT" || up === "FULL TIME") return "FT";
  if (up === "1H" || up === "1ST HALF") return displayClean || "1T";
  if (up === "2H" || up === "2ND HALF") return displayClean || "2T";
  if (short.includes("'") || short.includes("’")) return short.replace(/['’]/g, "");

  if ((up === "LIVE" || up === "EN VIVO" || up === "IN PROGRESS") && displayClean) {
    const m = displayClean.match(/^(\d{1,3}):\d{2}$/);
    return m ? m[1] : displayClean;
  }

  const shortClock = short.match(/^(\d{1,3}):\d{2}$/);
  if (shortClock) return shortClock[1];
  return short;
}

function isLive(status = {}) {
  const state = String(status?.type?.state || "").toLowerCase();
  const short = String(status.shortDetail || "").toUpperCase();
  return (
    state === "in" ||
    short === "HT" ||
    short === "HALFTIME" ||
    short === "1H" ||
    short === "2H" ||
    short.includes("'") ||
    short.includes("’")
  );
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseMinute(minuteRaw) {
  const txt = String(minuteRaw || "").trim().toUpperCase();
  const clock = txt.match(/^(\d{1,3}):\d{2}$/);
  if (clock) {
    const mm = Number(clock[1]);
    return Number.isFinite(mm) ? Math.max(1, Math.min(130, mm)) : null;
  }
  const m = txt.match(/^(\d{1,3})(?:\+(\d{1,2}))?$/);
  if (!m) return null;
  const base = Number(m[1]);
  const extra = Number(m[2] || 0);
  const minute = base + extra;
  return Number.isFinite(minute) ? Math.max(1, Math.min(130, minute)) : null;
}

function decimalToProb(odd) {
  const n = toNumber(odd);
  if (!n || n <= 1.01) return null;
  return 1 / n;
}

function probsToOdds(probH, probD, probA) {
  const margin = 1.07;
  const oh = 1 / Math.max(0.01, probH * margin);
  const od = 1 / Math.max(0.01, probD * margin);
  const oa = 1 / Math.max(0.01, probA * margin);
  return {
    h: Math.max(1.01, Math.min(80, oh)).toFixed(2),
    d: Math.max(1.01, Math.min(80, od)).toFixed(2),
    a: Math.max(1.01, Math.min(80, oa)).toFixed(2),
  };
}

function dynamicLiveOdds({ baseH, baseD, baseA, homeScore, awayScore, minute }) {
  const pH0 = decimalToProb(baseH) ?? 0.45;
  const pD0 = decimalToProb(baseD) ?? 0.28;
  const pA0 = decimalToProb(baseA) ?? 0.27;
  const norm = pH0 + pD0 + pA0;
  const pH = pH0 / norm;
  const pD = pD0 / norm;
  const pA = pA0 / norm;

  const t = Math.max(1, Math.min(120, minute || 1));
  const gd = (homeScore ?? 0) - (awayScore ?? 0);
  const pressure = Math.min(1.45, t / 85);
  const goalDiffAbs = Math.abs(gd);

  const lH = Math.log(Math.max(1e-6, pH));
  const lD = Math.log(Math.max(1e-6, pD));
  const lA = Math.log(Math.max(1e-6, pA));

  const scoreImpact = 0.32 + 0.95 * pressure;
  const drawPenaltyIfWinning = 0.22 + 0.90 * pressure;
  const drawBoostIfDraw = 0.03 + 0.12 * pressure;

  const sH = lH + gd * scoreImpact;
  const sA = lA - gd * scoreImpact;
  const sD = lD + (gd === 0 ? drawBoostIfDraw : -Math.abs(gd) * drawPenaltyIfWinning);

  const eH = Math.exp(sH);
  const eD = Math.exp(sD);
  const eA = Math.exp(sA);
  const den = eH + eD + eA;

  const modelH = eH / den;
  const modelD = eD / den;
  const modelA = eA / den;
  const decisiveBoost =
    Math.min(0.44, goalDiffAbs * 0.20) +
    (t >= 55 ? 0.10 : 0) +
    (goalDiffAbs >= 2 && t >= 40 ? 0.10 : 0);
  const modelWeight = Math.min(0.95, 0.30 + pressure * 0.26 + decisiveBoost);
  const baseWeight = 1 - modelWeight;

  const blendH = pH * baseWeight + modelH * modelWeight;
  const blendD = pD * baseWeight + modelD * modelWeight;
  const blendA = pA * baseWeight + modelA * modelWeight;

  return probsToOdds(blendH, blendD, blendA);
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

  let oddH = "";
  let oddD = "";
  let oddA = "";
  let oddsVerified = false;
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

  let finalH = oddH;
  let finalD = oddD;
  let finalA = oddA;
  let oddsSource = "espn";
  if (isLive(status)) {
    const m = parseMinute(normalizeMinute(status));
    const hs = toNumber(homeScore) ?? 0;
    const as = toNumber(awayScore) ?? 0;
    const liveModel = dynamicLiveOdds({
      baseH: oddH || "2.20",
      baseD: oddD || "3.10",
      baseA: oddA || "3.20",
      homeScore: hs,
      awayScore: as,
      minute: m ?? 1,
    });
    finalH = liveModel.h;
    finalD = liveModel.d;
    finalA = liveModel.a;
    oddsVerified = true;
    oddsSource = "espn-live-model";
  }

  return {
    torneo: leagueName,
    local: homeName,
    visitante: awayName,
    cuota_local: finalH,
    cuota_empate: finalD,
    cuota_visitante: finalA,
    mejor_cuota_local: finalH,
    mejor_cuota_empate: finalD,
    mejor_cuota_visitante: finalA,
    odds_detalle: [],
    odds_source: oddsSource,
    odds_verified: oddsVerified,
    hora_partido: dt
      ? dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Lima" })
      : "",
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
    rows.sort((a, b) =>
      a.live === b.live
        ? String(a.match_datetime || "").localeCompare(String(b.match_datetime || ""))
        : a.live
          ? -1
          : 1
    );
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: "feed_error", message: String(err && err.message ? err.message : err) });
  }
}
