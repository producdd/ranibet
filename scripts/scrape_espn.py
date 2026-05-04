from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json
from urllib.request import Request, urlopen


LIMA_TZ = ZoneInfo("America/Lima")
TARGET_LEAGUES = {
    "PER.1": "Liga 1 Peruana",
    "UEFA.CHAMPIONS": "UEFA Champions League",
    "CONMEBOL.LIBERTADORES": "Copa Libertadores",
}


def fetch_json(url):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    raw = urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
    return json.loads(raw)


def american_to_decimal(raw):
    if raw is None:
        return ""
    try:
        val = int(str(raw).strip())
    except Exception:
        return ""
    if val > 0:
        dec = 1.0 + (val / 100.0)
    elif val < 0:
        dec = 1.0 + (100.0 / abs(val))
    else:
        return ""
    return f"{dec:.2f}"


def normalize_minute(status):
    short = str(status.get("shortDetail") or "").strip()
    if not short:
        return ""
    up = short.upper()
    if up in {"HT", "FT"}:
        return up
    if "'" in short:
        return short.replace("'", "").replace("’", "")
    return short


def is_live(status):
    state = str(status.get("type", {}).get("state") or "").lower()
    if state == "in":
        return True
    short = str(status.get("shortDetail") or "").upper()
    if short in {"HT", "1H", "2H"}:
        return True
    if "'" in short or "’" in short:
        return True
    return False


def map_event(event, league_name, source_url):
    comp = (event.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []
    home = next((c for c in competitors if c.get("homeAway") == "home"), None)
    away = next((c for c in competitors if c.get("homeAway") == "away"), None)
    if not home or not away:
        return None

    home_name = str(home.get("team", {}).get("displayName") or "").strip()
    away_name = str(away.get("team", {}).get("displayName") or "").strip()
    if not home_name or not away_name:
        return None

    event_date_raw = str(event.get("date") or comp.get("date") or "").strip()
    event_dt = None
    if event_date_raw:
        try:
            event_dt = datetime.fromisoformat(event_date_raw.replace("Z", "+00:00")).astimezone(LIMA_TZ)
        except Exception:
            event_dt = None

    status_block = event.get("status", {}) or {}
    status_type = status_block.get("type", {}) or {}
    minute = normalize_minute(status_block)
    live = is_live(status_block)

    home_score = str(home.get("score") or "").strip()
    away_score = str(away.get("score") or "").strip()
    score = ""
    if home_score.isdigit() and away_score.isdigit():
        score = f"{home_score}-{away_score}"

    odds_list = comp.get("odds") or []
    odd_h = odd_d = odd_a = ""
    odds_verified = False
    if odds_list:
        first = odds_list[0]
        ml = first.get("moneyline") or {}
        home_ml = (((ml.get("home") or {}).get("close") or {}).get("odds"))
        away_ml = (((ml.get("away") or {}).get("close") or {}).get("odds"))
        draw_ml = (((ml.get("draw") or {}).get("close") or {}).get("odds"))
        if draw_ml is None:
            draw_ml = (first.get("drawOdds") or {}).get("moneyLine")

        odd_h = american_to_decimal(home_ml)
        odd_d = american_to_decimal(draw_ml)
        odd_a = american_to_decimal(away_ml)
        odds_verified = bool(odd_h and odd_d and odd_a)

    return {
        "torneo": league_name,
        "local": home_name,
        "visitante": away_name,
        "cuota_local": odd_h,
        "cuota_empate": odd_d,
        "cuota_visitante": odd_a,
        "mejor_cuota_local": odd_h,
        "mejor_cuota_empate": odd_d,
        "mejor_cuota_visitante": odd_a,
        "odds_detalle": [],
        "odds_source": "espn",
        "odds_verified": odds_verified,
        "hora_partido": event_dt.strftime("%H:%M") if event_dt else "",
        "fecha_partido": event_dt.strftime("%Y-%m-%d %H:%M:%S") if event_dt else "",
        "match_datetime": event_dt.isoformat() if event_dt else "",
        "live": live,
        "minute": minute,
        "score": score,
        "status": str(status_type.get("description") or status_block.get("shortDetail") or "").strip(),
        "time_text": str(status_block.get("shortDetail") or "").strip(),
        "fuente_url": source_url,
        "fecha_scrape": datetime.now(LIMA_TZ).isoformat(),
    }


def load_league_events(code):
    days = [datetime.now(LIMA_TZ).date(), (datetime.now(LIMA_TZ) + timedelta(days=1)).date()]
    events = []
    seen = set()
    for d in days:
        ymd = d.strftime("%Y%m%d")
        url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{code}/scoreboard?dates={ymd}"
        payload = fetch_json(url)
        for event in payload.get("events", []):
            eid = str(event.get("id") or "")
            if not eid or eid in seen:
                continue
            seen.add(eid)
            mapped = map_event(event, TARGET_LEAGUES[code], url)
            if mapped:
                events.append(mapped)
    return events


def main():
    all_rows = []
    for code in TARGET_LEAGUES:
        try:
            rows = load_league_events(code)
            print(f"[scraper] {code} rows={len(rows)}", flush=True)
            all_rows.extend(rows)
        except Exception as exc:
            print(f"[scraper] {code} error={exc}", flush=True)

    all_rows.sort(key=lambda r: (0 if r.get("live") else 1, r.get("match_datetime") or "9999"))
    verified = sum(1 for row in all_rows if row.get("odds_verified"))
    with open("partidos.json", "w", encoding="utf-8") as f:
        json.dump(all_rows, f, indent=2, ensure_ascii=False)
    print(f"{len(all_rows)} partidos; cuotas verificadas ESPN: {verified}", flush=True)


if __name__ == "__main__":
    main()
