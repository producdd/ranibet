from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import json
import re
import time
import os
import shutil
import traceback
from urllib.parse import urljoin

from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from urllib.request import Request, urlopen


LIMA_TZ = ZoneInfo("America/Lima")
LIVE_BREAK_STATUSES = {"ht", "descanso", "break"}
ODDS_FRAGMENTS = [
    "#/comparacion-de-cuotas/1x2-cuotas/final-del-partido",
    "#/odds-comparison/1x2-odds/full-time",
    "#/cuotas/1x2-cuotas/final-del-partido",
]


def parse_kickoff(time_text):
    txt = (time_text or "").strip()
    now = datetime.now(LIMA_TZ)
    low = txt.lower()

    if not txt or any(word in low for word in ["aplazado", "cancelado", "finalizado", "postp"]):
        return None, ""

    m_relative = re.search(r"(hoy|m[aá]nana|manana)\s+(\d{1,2}):(\d{2})", low)
    if m_relative:
        ref, hour, minute = m_relative.groups()
        hour = int(hour)
        minute = int(minute)
        base = now if ref == "hoy" else now + timedelta(days=1)
        dt = datetime(base.year, base.month, base.day, hour, minute, tzinfo=LIMA_TZ)
        return dt, f"{hour:02d}:{minute:02d}"

    m_full = re.search(r"(\d{2})\.(\d{2})\.\s*(\d{1,2}):(\d{2})", txt)
    if m_full:
        day, month, hour, minute = map(int, m_full.groups())
        dt_this_year = datetime(now.year, month, day, hour, minute, tzinfo=LIMA_TZ)
        dt_next_year = datetime(now.year + 1, month, day, hour, minute, tzinfo=LIMA_TZ)
        dt = min([dt_this_year, dt_next_year], key=lambda candidate: abs((candidate - now).total_seconds()))
        return dt, f"{hour:02d}:{minute:02d}"

    m_hour = re.search(r"(\d{1,2}):(\d{2})", txt)
    if m_hour:
        hour, minute = map(int, m_hour.groups())
        dt = datetime(now.year, now.month, now.day, hour, minute, tzinfo=LIMA_TZ)
        return dt, f"{hour:02d}:{minute:02d}"

    return None, ""


def first_text(elem, selectors):
    for selector in selectors:
        try:
            value = elem.find_element(By.CSS_SELECTOR, selector).text.strip()
            if value:
                return value
        except NoSuchElementException:
            pass
        except Exception:
            pass
    return ""


def accept_cookies_if_present(driver):
    for selector in ["#onetrust-accept-btn-handler", "button#onetrust-accept-btn-handler"]:
        try:
            btn = WebDriverWait(driver, 3).until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
            btn.click()
            time.sleep(0.7)
            return
        except Exception:
            pass


def enable_odds_view(driver):
    xpaths = [
        "//*[self::a or self::button or self::div][contains(normalize-space(.), 'Cuotas')]",
        "//*[self::a or self::button or self::div][contains(normalize-space(.), 'Odds')]",
    ]
    for xpath in xpaths:
        try:
            for el in driver.find_elements(By.XPATH, xpath)[:5]:
                if not el.is_displayed():
                    continue
                driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                time.sleep(0.2)
                driver.execute_script("arguments[0].click();", el)
                time.sleep(2)
                return True
        except Exception:
            pass
    return False


def empty_odds_payload(source=""):
    return {
        "cuota_local": "",
        "cuota_empate": "",
        "cuota_visitante": "",
        "mejor_cuota_local": "",
        "mejor_cuota_empate": "",
        "mejor_cuota_visitante": "",
        "odds_detalle": [],
        "odds_source": source,
        "odds_verified": False,
    }


def normalize_odd(raw):
    txt = str(raw or "").strip().replace(",", ".")
    match = re.search(r"\b(\d{1,3}\.\d{2})\b", txt)
    if not match:
        return ""
    value = float(match.group(1))
    if value < 1.01 or value > 100:
        return ""
    return f"{value:.2f}"


def collect_odds_from_context(context):
    selectors = [
        ".event__odd",
        "[class*='event__odd']",
        "[class*='oddsCell__odd']",
        "[class*='oddsCell']",
        "[data-testid*='odds']",
    ]
    values = []
    details = []
    seen = set()
    for selector in selectors:
        try:
            cells = context.find_elements(By.CSS_SELECTOR, selector)
        except Exception:
            cells = []
        for cell in cells:
            raw_parts = [
                cell.text,
                cell.get_attribute("title"),
                cell.get_attribute("aria-label"),
                cell.get_attribute("data-testid"),
            ]
            for raw in raw_parts:
                value = normalize_odd(raw)
                if not value or (selector, value, len(values)) in seen:
                    continue
                values.append(value)
                details.append({"valor": value, "meta": (cell.get_attribute("title") or cell.get_attribute("aria-label") or "").strip()})
                seen.add((selector, value, len(values)))
                break
    return values, details


def collect_odds_from_page_text(context):
    try:
        page_text = context.find_element(By.TAG_NAME, "body").text
    except Exception:
        return [], []

    lines = [ln.strip() for ln in page_text.splitlines() if ln.strip()]
    # Prefer lines around 1X2 labels.
    candidate_chunks = []
    for i, ln in enumerate(lines):
        low = ln.lower()
        if "1x2" in low or "final del partido" in low or "full-time" in low:
            start = max(0, i - 25)
            end = min(len(lines), i + 120)
            candidate_chunks.extend(lines[start:end])
    if not candidate_chunks:
        candidate_chunks = lines[:400]

    joined = "\n".join(candidate_chunks)
    nums = re.findall(r"\b\d{1,2}[.,]\d{2}\b", joined)
    values = []
    details = []
    for raw in nums:
        v = normalize_odd(raw)
        if not v:
            continue
        f = float(v)
        if f < 1.01 or f > 30:
            continue
        values.append(v)
        details.append({"valor": v, "meta": "text-fallback"})
        if len(values) >= 18:
            break
    return values, details


def build_odds_payload(values, details, source):
    if len(values) < 3:
        return empty_odds_payload(source)

    triples = []
    for i in range(0, len(values) - 2, 3):
        try:
            triples.append([float(values[i]), float(values[i + 1]), float(values[i + 2])])
        except Exception:
            pass

    if not triples:
        return empty_odds_payload(source)

    first = triples[0]
    best_h = max(t[0] for t in triples)
    best_d = max(t[1] for t in triples)
    best_a = max(t[2] for t in triples)
    return {
        "cuota_local": f"{first[0]:.2f}",
        "cuota_empate": f"{first[1]:.2f}",
        "cuota_visitante": f"{first[2]:.2f}",
        "mejor_cuota_local": f"{best_h:.2f}",
        "mejor_cuota_empate": f"{best_d:.2f}",
        "mejor_cuota_visitante": f"{best_a:.2f}",
        "odds_detalle": details,
        "odds_source": source,
        "odds_verified": True,
    }


def extract_odds_from_match(elem):
    values, details = collect_odds_from_context(elem)
    return build_odds_payload(values, details, "flashscore-list")


def get_detail_url(elem):
    try:
        href = elem.find_element(By.CSS_SELECTOR, "a[href*='/partido/']").get_attribute("href")
        if href:
            return href.split("#")[0]
    except Exception:
        pass
    try:
        href = elem.get_attribute("href")
        if href and "/partido/" in href:
            return href.split("#")[0]
    except Exception:
        pass
    try:
        href = elem.get_attribute("id") or ""
        if href.startswith("g_"):
            return ""
    except Exception:
        pass
    return ""


def slug_to_team_name(slug):
    txt = re.sub(r"-[A-Za-z0-9]{6,10}$", "", slug or "").replace("-", " ").strip()
    txt = re.sub(r"\s+", " ", txt)
    return txt


def norm_team_name(name):
    txt = (name or "").lower().strip()
    txt = txt.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    txt = txt.replace(".", " ").replace("fc", " ").replace("cf", " ").replace("club", " ")
    txt = re.sub(r"\s+", " ", txt)
    return txt.strip()


def extract_detail_links_from_league_url(source_url):
    req = Request(source_url, headers={"User-Agent": "Mozilla/5.0"})
    html = urlopen(req, timeout=20).read().decode("utf-8", errors="ignore")
    links = sorted(set(re.findall(r"/partido/futbol/[^\"'#? ]+", html)))
    mapping = []
    for rel in links:
        full = urljoin("https://www.flashscore.pe", rel)
        chunks = rel.strip("/").split("/")
        if len(chunks) < 5:
            continue
        # /partido/futbol/<team-a>/<team-b>/
        team_a = slug_to_team_name(chunks[2])
        team_b = slug_to_team_name(chunks[3])
        mapping.append({
            "home_norm": norm_team_name(team_a),
            "away_norm": norm_team_name(team_b),
            "url": full,
        })
    return mapping


def guess_detail_url(local, visitante, source_url, league_links):
    local_n = norm_team_name(local)
    away_n = norm_team_name(visitante)
    for row in league_links:
        if row["home_norm"] in local_n and row["away_norm"] in away_n:
            return row["url"]
        if local_n in row["home_norm"] and away_n in row["away_norm"]:
            return row["url"]
    for row in league_links:
        if row["home_norm"] in away_n and row["away_norm"] in local_n:
            return row["url"]
        if away_n in row["home_norm"] and local_n in row["away_norm"]:
            return row["url"]
    return ""


def extract_odds_from_detail(driver, detail_url):
    if not detail_url:
        return empty_odds_payload("flashscore-detail")

    for fragment in ODDS_FRAGMENTS:
        try:
            driver.get(detail_url.split("#")[0] + fragment)
            accept_cookies_if_present(driver)
            WebDriverWait(driver, 8).until(
                lambda d: len(collect_odds_from_context(d)[0]) >= 3
                or "No hay cuotas" in d.page_source
                or "Sin cuotas" in d.page_source
            )
            time.sleep(1.2)
            values, details = collect_odds_from_context(driver)
            if len(values) < 3:
                # Some layouts lazy-render odds table after scroll.
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight * 0.6);")
                time.sleep(0.8)
                values, details = collect_odds_from_context(driver)
            if len(values) < 3:
                # Last-resort extraction from visible text around 1X2 section.
                values, details = collect_odds_from_page_text(driver)
            payload = build_odds_payload(values, details, "flashscore-detail")
            if payload["odds_verified"]:
                return payload
        except Exception:
            pass
    return empty_odds_payload("flashscore-detail")


def extract_live_state(elem):
    cls = (elem.get_attribute("class") or "").lower()
    status_text = first_text(elem, [".event__stage", ".event__stage--block", ".event__time"])
    status_low = status_text.lower()
    is_live = (
        "live" in cls
        or "en vivo" in status_low
        or status_low in LIVE_BREAK_STATUSES
        or bool(re.search(r"\d{1,3}(?:\+?\d{0,2})?['’]$", status_text.strip()))
    )

    minute = ""
    if is_live:
        if status_low in LIVE_BREAK_STATUSES:
            minute = status_text.strip().upper()
        else:
            minute_match = re.search(r"(\d{1,3}(?:\+?\d{0,2})?)\s*['’]?$", status_text.strip())
            if minute_match:
                minute = minute_match.group(1)

    score_text = first_text(elem, [".event__scores", ".event__score", ".event__part--home", ".event__part"])
    if not re.search(r"\d+\s*[-:]\s*\d+", score_text):
        home_score = first_text(elem, [".event__score--home", ".event__participantScore--home"])
        away_score = first_text(elem, [".event__score--away", ".event__participantScore--away"])
        if re.match(r"^\d+$", home_score) and re.match(r"^\d+$", away_score):
            score_text = f"{home_score}-{away_score}"

    score_text = score_text.replace(":", "-").strip()
    if not re.search(r"^\d+\s*-\s*\d+$", score_text):
        score_text = ""

    return {"live": bool(is_live), "minute": minute, "score": score_text, "status": status_text}


def collect_matches_from_page(driver, torneo, source_url, league_links):
    try:
        WebDriverWait(driver, 12).until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".event__match")))
    except Exception:
        time.sleep(4)
    matches = driver.find_elements(By.CSS_SELECTOR, ".event__match")
    collected = []
    for elem in matches[:30]:
        try:
            local = first_text(elem, [".event__participant--home", "[class*='event__homeParticipant']", "[class*='homeParticipant']"])
            visitante = first_text(elem, [".event__participant--away", "[class*='event__awayParticipant']", "[class*='awayParticipant']"])
            if not local or not visitante:
                continue

            time_text = first_text(elem, [".event__time", "[class*='event__stage']", "[class*='event__round']"])
            kickoff_dt, kickoff_hour = parse_kickoff(time_text)
            odds_data = extract_odds_from_match(elem)
            live_data = extract_live_state(elem)
            detail_url = get_detail_url(elem) or guess_detail_url(local, visitante, source_url, league_links)
            collected.append({
                "torneo": torneo,
                "local": local,
                "visitante": visitante,
                **odds_data,
                "hora_partido": kickoff_hour,
                "fecha_partido": kickoff_dt.strftime("%Y-%m-%d %H:%M:%S") if kickoff_dt else "",
                "match_datetime": kickoff_dt.isoformat() if kickoff_dt else "",
                "live": live_data["live"],
                "minute": live_data["minute"],
                "score": live_data["score"],
                "status": live_data["status"],
                "time_text": time_text,
                "fuente_url": source_url,
                "detalle_url": detail_url,
                "fecha_scrape": datetime.now(LIMA_TZ).isoformat(),
            })
        except Exception:
            pass
    return collected


def create_driver():
    candidate_bins = [
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        shutil.which("chromium-browser"),
        shutil.which("chromium"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
    ]
    candidate_bins = [p for p in candidate_bins if p and os.path.exists(p)]

    driver_paths = [
        "/usr/bin/chromedriver",
        shutil.which("chromedriver"),
    ]
    driver_paths = [p for p in driver_paths if p and os.path.exists(p)]
    service = Service(driver_paths[0]) if driver_paths else Service()

    last_error = None
    for browser_bin in candidate_bins or [None]:
        for headless_arg in ["--headless=new", "--headless"]:
            options = Options()
            options.add_argument(headless_arg)
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_argument("--window-size=1440,1200")
            options.add_argument("--lang=es-PE")
            options.add_argument("--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
            if browser_bin:
                options.binary_location = browser_bin
            try:
                driver = webdriver.Chrome(service=service, options=options)
                driver.execute_cdp_cmd("Emulation.setTimezoneOverride", {"timezoneId": "America/Lima"})
                print(f"Driver OK with binary={browser_bin or 'default'} headless={headless_arg}")
                return driver
            except Exception as exc:
                last_error = exc
                print(f"Driver init failed with binary={browser_bin or 'default'} headless={headless_arg}: {exc}")

    raise RuntimeError(f"No se pudo iniciar Chrome/Chromium en Actions. Último error: {last_error}")


def write_output(rows):
    with open("partidos.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)


def main():
    competitions = [
        ("Liga 1 Peruana", "https://www.flashscore.pe/futbol/peru/liga-1/"),
        ("Copa Libertadores", "https://www.flashscore.pe/futbol/sudamerica/copa-libertadores/partidos/"),
        ("UEFA Champions League", "https://www.flashscore.pe/futbol/europa/champions-league/partidos/"),
    ]

    driver = None
    todos = []
    try:
        driver = create_driver()
        for torneo, url in competitions:
            urls_to_try = [url]
            if "champions-league/partidos/" in url:
                urls_to_try.append("https://www.flashscore.pe/futbol/europa/champions-league/")
            if "copa-libertadores/partidos/" in url:
                urls_to_try.append("https://www.flashscore.pe/futbol/sudamerica/copa-libertadores/")

            matches = []
            league_links = []
            for source_url in urls_to_try:
                try:
                    league_links = extract_detail_links_from_league_url(source_url)
                    driver.get(source_url)
                    accept_cookies_if_present(driver)
                    enable_odds_view(driver)
                    matches = collect_matches_from_page(driver, torneo, source_url, league_links)
                    if matches:
                        break
                except Exception as comp_exc:
                    print(f"Error en competencia {torneo} url={source_url}: {comp_exc}")

            for match in matches:
                if not match.get("odds_verified") and match.get("detalle_url"):
                    odds_data = extract_odds_from_detail(driver, match["detalle_url"])
                    match.update(odds_data)
                    match["fecha_scrape"] = datetime.now(LIMA_TZ).isoformat()
                todos.append(match)
    except Exception as fatal:
        print(f"ERROR FATAL SCRAPER: {fatal}")
        traceback.print_exc()
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass

    verified = sum(1 for row in todos if row.get("odds_verified"))
    write_output(todos)
    print(f"{len(todos)} partidos; cuotas verificadas Flashscore: {verified}")


if __name__ == "__main__":
    main()
