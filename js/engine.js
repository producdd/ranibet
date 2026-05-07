// RANIBET engine: RaniCoins, logros/ranking y datos para feed en vivo.
const SUPABASE_URL = 'https://gdntslyfogqzvzevcbnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y7mTO19Wp96L5QwHiEwWAg_2OH4RtEB';
const GOOGLE_CLIENT_ID = '6300462154-9uoaapb6jcbbe6semt477k2adv6s8f1p.apps.googleusercontent.com';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function clearLegacySupabaseCookie() {
  document.cookie = 'supabaseSession=; Max-Age=0; path=/; SameSite=Lax';
}
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

let currentUser = null;
let currentProfile = null;
let usernameReady = false;
let bootProfileLoaded = false;

const MATCHES = [
  {id:1,league:'liga1',leagueName:'Liga 1 Betsson',home:'Alianza Lima',away:'Universitario',homeEmoji:'🔵',awayEmoji:'🟡',time:'Sab 18:00',odds:{h:2.10,d:3.20,a:3.80},live:true,score:'2-1',minute:'73'},
  {id:2,league:'liga1',leagueName:'Liga 1 Betsson',home:'Sporting Cristal',away:'San Martín',homeEmoji:'🔵',awayEmoji:'⚪',time:'Sab 15:30',odds:{h:1.85,d:3.50,a:4.20},live:true,score:'0-0',minute:'45+2'},
  {id:3,league:'liga1',leagueName:'Liga 1 Betsson',home:'Cienciano',away:'FBC Melgar',homeEmoji:'🔴',awayEmoji:'⚫',time:'Dom 16:00',odds:{h:2.40,d:3.10,a:2.90}},
  {id:4,league:'liga1',leagueName:'Liga 1 Betsson',home:'ADT',away:'César Vallejo',homeEmoji:'⚪',awayEmoji:'🟠',time:'Dom 20:00',odds:{h:3.10,d:3.00,a:2.20}},
  {id:5,league:'copa',leagueName:'Copa Perú',home:'Garcilaso',away:'Alfonso Ugarte',homeEmoji:'🔵',awayEmoji:'🔴',time:'Vie 15:00',odds:{h:1.95,d:3.30,a:3.70}},
  {id:6,league:'copa',leagueName:'Copa Perú',home:'Los Caimanes',away:'Juan Aurich',homeEmoji:'🟢',awayEmoji:'🟡',time:'Sab 13:00',odds:{h:2.60,d:3.20,a:2.50}},
  {id:7,league:'champions',leagueName:'UEFA Champions League',home:'Real Madrid',away:'Man. City',homeEmoji:'⚪',awayEmoji:'🔵',time:'Mar 21:00',odds:{h:2.30,d:3.40,a:3.10},live:true,score:'3-1',minute:'88'},
  {id:8,league:'champions',leagueName:'UEFA Champions League',home:'Bayern Munich',away:'Arsenal',homeEmoji:'🔴',awayEmoji:'🔴',time:'Mié 21:00',odds:{h:1.70,d:3.80,a:5.00}},
  {id:9,league:'champions',leagueName:'UEFA Champions League',home:'Barcelona',away:'Inter Milán',homeEmoji:'🔵',awayEmoji:'⚫',time:'Mar 21:00',odds:{h:2.05,d:3.50,a:3.60}},
  {id:10,league:'laliga',leagueName:'La Liga EA Sports',home:'Atl. Madrid',away:'Sevilla',homeEmoji:'🔴',awayEmoji:'⚪',time:'Dom 16:15',odds:{h:1.65,d:3.80,a:5.50}},
  {id:11,league:'laliga',leagueName:'La Liga EA Sports',home:'Real Betis',away:'Valencia',homeEmoji:'🟢',awayEmoji:'⚪',time:'Sab 20:45',odds:{h:2.20,d:3.30,a:3.20}},
  {id:12,league:'premier',leagueName:'Premier League',home:'Liverpool',away:'Chelsea',homeEmoji:'🔴',awayEmoji:'🔵',time:'Dom 17:30',odds:{h:1.80,d:3.60,a:4.50}},
  {id:13,league:'premier',leagueName:'Premier League',home:'Man. United',away:'Tottenham',homeEmoji:'🔴',awayEmoji:'⚪',time:'Sab 12:30',odds:{h:2.50,d:3.20,a:2.80}},
  {id:14,league:'libertadores',leagueName:'Copa Libertadores',home:'Flamengo',away:'River Plate',homeEmoji:'🔴',awayEmoji:'⚪',time:'Jue 21:30',odds:{h:2.00,d:3.40,a:3.50}},
  {id:15,league:'libertadores',leagueName:'Copa Libertadores',home:'Boca Juniors',away:'Nacional',homeEmoji:'🔵',awayEmoji:'⚪',time:'Mié 21:00',odds:{h:1.90,d:3.50,a:4.00}}
];

const DEMO_HISTORY = [];

let ticket = [];
let betType = 'combinada';
let balance = 500;
let betsHistory = [];
let latestScrapedRows = [];
let currentLeague = 'all';
let rankingTab = 'weekly';
const LIGA1_AUTO_REFRESH_MS = 60000;
const FEED_POLL_DEFAULT_MS = 60000; // 60s base
const FEED_POLL_LIVE_MS = 15000; // 15s cuando hay en vivo
const FEED_POLL_MIN_MS = 10000; // 10s mínimo permitido
const FEED_POLL_MAX_MS = 300000; // 5 min
const WEEKLY_RANKING_LIMIT = 50;
const MONTHLY_RANKING_LIMIT = 10;
const HISTORICAL_RANKING_LIMIT = 10;
const MONTHLY_POINTS_BY_POSITION = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const CLIENT_LOGS_KEY = 'ranibet_client_logs_v1';
const RANKING_POSITION_KEY = 'ranibet_rank_positions_v1';
const RANKING_SNAPSHOT_KEY = 'ranibet_ranking_snapshots_v1';
let settlementWarningShown = false;

function readJsonStorage(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}

function writeJsonStorage(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch{}
}

function logClientEvent(level, category, message, context = {}){
  const rows = readJsonStorage(CLIENT_LOGS_KEY, []);
  rows.push({
    ts: new Date().toISOString(),
    level,
    category,
    message: String(message || ''),
    context
  });
  writeJsonStorage(CLIENT_LOGS_KEY, rows.slice(-120));
}

function ensureClientErrorLogging(){
  if(window.__raniLogsBound) return;
  window.__raniLogsBound = true;
  window.addEventListener('error', (event) => {
    logClientEvent('error', 'window_error', event.message || 'window_error', {
      file: event.filename || '',
      line: event.lineno || 0
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    logClientEvent('error', 'promise_rejection', event.reason?.message || String(event.reason || 'promise_rejection'));
  });
}

window.RaniDebug = {
  getLogs(){ return readJsonStorage(CLIENT_LOGS_KEY, []); },
  clearLogs(){ localStorage.removeItem(CLIENT_LOGS_KEY); },
  async closeWeeklyRanking(){
    if(!supabaseClient) throw new Error('supabase_unavailable');
    const { data, error } = await supabaseClient.rpc('close_weekly_ranking_secure');
    if(error){
      logClientEvent('error', 'weekly_closure', 'No se pudo cerrar la semana', {message: error.message});
      throw error;
    }
    logClientEvent('info', 'weekly_closure', 'Semana cerrada manualmente', data || {});
    return data;
  }
};

async function callRpc(name, params = {}){
  if(!supabaseClient) throw new Error('Supabase SDK no disponible');
  const {data, error} = await supabaseClient.rpc(name, params);
  if(error) throw error;
  return data;
}

function isMissingRpcError(error){
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    error?.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    details.includes('no matches were found in the schema cache')
  );
}

function normalizeStoredPick(pick = {}){
  return {
    matchId: pick.matchId != null ? String(pick.matchId) : '',
    type: pick.type || '',
    match: String(pick.match || ''),
    pick: String(pick.pick || ''),
    odd: Number(pick.odd || 0),
    league: String(pick.league || '')
  };
}

function normalizeStoredBet(bet = {}){
  return {
    id: String(bet.id || `RNB-${Math.floor(10000 + Math.random() * 89999)}`),
    date: String(bet.date || getCurrentDateLabel()),
    createdAt: bet.createdAt || null,
    user: String(bet.user || currentProfile?.username || 'Brutality'),
    status: ['PENDING', 'WON', 'LOST'].includes(bet.status) ? bet.status : 'PENDING',
    picks: Array.isArray(bet.picks) ? bet.picks.map(normalizeStoredPick).filter(p => p.match) : [],
    totalOdd: Number(bet.totalOdd || 0),
    stake: Number(bet.stake || 0),
    payout: Number(bet.payout || 0)
  };
}

function mapSupabaseTicketToBet(row = {}){
  return normalizeStoredBet({
    id: row.ticket_code || row.id,
    date: row.created_at ? getCurrentDateLabel(new Date(row.created_at)) : getCurrentDateLabel(),
    createdAt: row.created_at || null,
    user: row.username || currentProfile?.username || 'Brutality',
    status: row.status || 'PENDING',
    picks: Array.isArray(row.picks) ? row.picks : [],
    totalOdd: row.total_odd,
    stake: row.stake,
    payout: row.payout
  });
}

function getStartOfWeek(date = new Date()){
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function getISOWeekNumber(date = new Date()){
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
}

function formatDateRangeShort(date){
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS_ES[date.getMonth()] || '';
  return `${day} ${month}`;
}

function getCurrentWeekInfo(now = new Date()){
  const start = getStartOfWeek(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const weekNumber = getISOWeekNumber(now);

  return {
    id: `${start.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`,
    weekNumber,
    start,
    end,
    label: `${formatDateRangeShort(start)} - ${formatDateRangeShort(endInclusive)} ${endInclusive.getFullYear()}`
  };
}

function getCurrentMonthInfo(now = new Date()){
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const monthLabel = MONTHS_ES[start.getMonth()] || '';

  return {
    id: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    start,
    end,
    monthNumber: start.getMonth() + 1,
    label: `${monthLabel} ${start.getFullYear()}`,
    rangeLabel: `${formatDateRangeShort(start)} - ${formatDateRangeShort(endInclusive)} ${endInclusive.getFullYear()}`
  };
}

function getWeekEndInclusive(weekInfo){
  const endInclusive = new Date(weekInfo.end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  return endInclusive;
}

function getMonthlyWeeklyPeriods(now = new Date()){
  const monthInfo = getCurrentMonthInfo(now);
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const lastVisibleDate = new Date(Math.min(today.getTime(), monthInfo.end.getTime() - 1));
  const periods = [];
  const seen = new Set();
  let cursor = getStartOfWeek(monthInfo.start);

  while(cursor <= lastVisibleDate){
    const weekInfo = getCurrentWeekInfo(cursor);
    const endInclusive = getWeekEndInclusive(weekInfo);
    const belongsToMonth = endInclusive.getFullYear() === monthInfo.start.getFullYear()
      && endInclusive.getMonth() === monthInfo.start.getMonth();

    if(belongsToMonth && !seen.has(weekInfo.id)){
      periods.push({...weekInfo, endInclusive});
      seen.add(weekInfo.id);
    }

    cursor = new Date(weekInfo.end);
  }

  return periods;
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

async function loadBetsHistory(){
  if(!supabaseClient || !currentUser?.email){
    betsHistory = [];
    return;
  }

  const {data, error} = await supabaseClient
    .from('bet_tickets')
    .select('id,ticket_code,username,status,picks,total_odd,stake,payout,created_at')
    .eq('email', currentUser.email)
    .order('created_at', {ascending:false});

  if(error){
    console.warn('No se pudo leer historial online de apuestas.', error);
    betsHistory = [];
    return;
  }

  betsHistory = (data || []).map(mapSupabaseTicketToBet);
}

async function insertBetTicket(ticketRow){
  throw new Error('secure_rpc_required');
}

async function ensureWeeklySnapshot(openingCoins = balance){
  return null;
}

async function updateBetTicket(ticketCode, patch = {}){
  if(!supabaseClient || !currentUser?.email || !ticketCode){
    throw new Error('settlement_context_missing');
  }

  const nextStatus = ['PENDING', 'WON', 'LOST'].includes(patch.status) ? patch.status : null;
  if(!nextStatus){
    throw new Error('invalid_settlement_status');
  }

  const payload = {
    status: nextStatus,
    settled_at: patch.settledAt || new Date().toISOString()
  };

  const {data, error} = await supabaseClient
    .from('bet_tickets')
    .update(payload)
    .eq('email', currentUser.email)
    .eq('ticket_code', ticketCode)
    .eq('status', 'PENDING')
    .select('ticket_code,status,settled_at')
    .maybeSingle();

  if(error) throw error;
  return data;
}

async function refreshBetHistoryUI(){
  await loadBetsHistory();
  renderHistory();
  renderWon();
}

async function initSupabaseProfile(){
  if(!supabaseClient){
    console.warn('Supabase SDK no está disponible. Ranibet usará datos demo locales.');
    return;
  }

  try{
    clearLegacySupabaseCookie();
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    if(!currentUser){
      const { data: { user } } = await supabaseClient.auth.getUser();
      currentUser = user || null;
    }
    renderGoogleButton();
    updateAuthUI();

    if(currentUser){
      await loadUserProfile();
      await loadUserAchievements();
      ensureUsernameGate();
    }
    subscribeToRanking();
  }catch(error){
    console.warn('No se pudo iniciar perfil Google/Supabase. Revisa Google provider, RLS y tablas.', error);
  }
}

function renderGoogleButton(){
  if(!window.google?.accounts?.id){
    setTimeout(renderGoogleButton, 250);
    return;
  }
  const btn = document.getElementById('googleSignInBtn');
  if(!btn || btn.dataset.rendered === 'true') return;

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential
  });

  window.google.accounts.id.renderButton(btn, {
    type: 'standard',
    theme: 'outline',
    size: 'medium',
    shape: 'pill',
    text: 'signin_with',
    logo_alignment: 'left',
    width: 190
  });

  btn.dataset.rendered = 'true';
}

async function handleGoogleCredential(response){
  if(!response?.credential || !supabaseClient){
    showToast('No se pudo leer la credencial de Google','error');
    return;
  }

  clearLegacySupabaseCookie();

  const {data, error} = await supabaseClient.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential
  });

  if(error){
    console.warn('Error al iniciar sesión con Google en Supabase.', error);
    showToast('Activa Google Provider en Supabase Auth','error');
    return;
  }

  currentUser = data?.user || data?.session?.user || null;
  if(!currentUser){
    const { data: sessionData } = await supabaseClient.auth.getSession();
    currentUser = sessionData?.session?.user || null;
  }
  if(!currentUser){
    showToast('No se pudo recuperar la sesión de Supabase','error');
    return;
  }

  await loadUserProfile();
  await loadUserAchievements();
  ensureUsernameGate();
  updateAuthUI();
  renderTicket();
  renderRanking();
  showToast('Sesión iniciada con Google','success');
}

function isValidUsername(value){
  return /^[A-Za-z0-9.-]{3,20}$/.test(value);
}

function updateBalanceDisplay(nextBalance, checkDailyBonus = false){
  const numericBalance = Number(nextBalance ?? 0);
  const balanceKey = currentUser?.email ? `ranibet_balance_seen_${currentUser.email}` : '';
  const storedBalance = balanceKey ? Number(sessionStorage.getItem(balanceKey) || NaN) : NaN;
  const previousBalance = Number.isFinite(storedBalance) ? storedBalance : Number(balance || 0);
  balance = numericBalance;
  const balanceNode = document.getElementById('balAmt');
  if(balanceNode) balanceNode.textContent = balance;

  if(checkDailyBonus && numericBalance > previousBalance){
    showToast('¡Rana puntual! Has recibido tus 100 monedas del día','success');
  }

  if(balanceKey) sessionStorage.setItem(balanceKey, String(numericBalance));
  bootProfileLoaded = true;
}

function sanitizeUsername(value){
  return value.replace(/[^A-Za-z0-9.-]/g, '').slice(0, 20);
}

function bindUsernameInput(){
  const input = document.getElementById('usernameInput');
  if(!input || input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';
  input.addEventListener('input', () => {
    const clean = sanitizeUsername(input.value);
    if(input.value !== clean) input.value = clean;
    validateUsernameInput();
  });
}

function validateUsernameInput(){
  const input = document.getElementById('usernameInput');
  const hint = document.getElementById('usernameHint');
  const count = document.getElementById('usernameCount');
  const btn = document.getElementById('usernameSaveBtn');
  if(!input || !hint || !count || !btn) return false;

  const value = input.value.trim();
  count.textContent = `${value.length}/20`;
  hint.classList.remove('ok','error');

  if(value.length === 0){
    hint.textContent = 'Letras, números, puntos y guiones. Máximo 20.';
    btn.disabled = true;
    return false;
  }

  if(!isValidUsername(value)){
    hint.textContent = 'Mínimo 3 caracteres. Solo letras, números, puntos y guiones.';
    hint.classList.add('error');
    btn.disabled = true;
    return false;
  }

  hint.textContent = 'Nombre Brutality listo para entrar al ranking';
  hint.classList.add('ok');
  btn.disabled = false;
  return true;
}

function ensureUsernameGate(){
  const gate = document.getElementById('usernameGate');
  const input = document.getElementById('usernameInput');
  if(!gate || !currentUser) return;

  bindUsernameInput();
  usernameReady = isValidUsername(currentProfile?.username?.trim() || '');
  gate.classList.toggle('open', !usernameReady);
  if(!usernameReady){
    const currentName = currentProfile?.username?.trim() || '';
    input.value = isValidUsername(currentName) ? currentName : '';
    validateUsernameInput();
    setTimeout(() => input.focus(), 80);
  }
}

async function saveBrutalityUsername(){
  const input = document.getElementById('usernameInput');
  const hint = document.getElementById('usernameHint');
  const btn = document.getElementById('usernameSaveBtn');
  if(!input || !validateUsernameInput() || !currentUser?.email) return;

  const username = input.value.trim();
  btn.disabled = true;
  let data = null;
  let error = null;
  try{
    data = await callRpc('set_username_secure', {p_username: username});
  }catch(rpcError){
    error = rpcError;
  }

  if(error){
    const duplicate = error.code === '23505' || String(error.message || '').includes('unique_username');
    hint.textContent = duplicate ? 'Ese nombre ya pertenece a otro guerrero Brutality' : 'No se pudo guardar. Intenta otra vez.';
    hint.classList.remove('ok');
    hint.classList.add('error');
    btn.disabled = false;
    return;
  }

  currentProfile = data;
  usernameReady = true;
  document.getElementById('usernameGate')?.classList.remove('open');
  updateAuthUI();
  renderRanking();
  showToast('Username Brutality activado','success');
}

async function signOutUser(){
  if(supabaseClient) await supabaseClient.auth.signOut();
  clearLegacySupabaseCookie();
  currentUser = null;
  currentProfile = null;
  usernameReady = false;
  bootProfileLoaded = false;
  balance = 500;
  betsHistory = [...DEMO_HISTORY];
  const balanceNode = document.getElementById('balAmt');
  if(balanceNode) balanceNode.textContent = balance;
  updateAuthUI();
  renderTicket();
  renderHistory();
  renderWon();
  renderRanking();
  showToast('Sesión cerrada','info');
}

function updateAuthUI(){
  const googleBtn = document.getElementById('googleSignInBtn');
  const userPill = document.getElementById('userInfoPill');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');

  if(currentUser){
    googleBtn?.classList.add('hidden');
    userPill?.classList.remove('hidden');
    userName.textContent = currentProfile?.username?.trim() || 'Brutality';
    const photo = currentProfile?.photo_url || currentUser.user_metadata?.avatar_url;
    userAvatar.textContent = '';
    if(photo){
      const img = document.createElement('img');
      img.src = photo;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      userAvatar.appendChild(img);
    }else{
      userAvatar.textContent = '\uD83D\uDC38';
    }
    return;
  }

  googleBtn?.classList.remove('hidden');
  userPill?.classList.add('hidden');
  bootProfileLoaded = false;
}

async function loadUserProfile(){
  if(!supabaseClient || !currentUser?.email) return;

  const meta = currentUser.user_metadata || {};
  const googlePhoto = meta.avatar_url || meta.picture || '';
  const googleHandle = '@' + currentUser.email.split('@')[0].replace(/[^a-z0-9_]/gi,'').slice(0,18).toLowerCase();

  try{
    currentProfile = await callRpc('bootstrap_profile_secure', {
      p_handle: googleHandle,
      p_photo_url: googlePhoto
    });
    updateBalanceDisplay(currentProfile?.coins ?? balance, true);
    updateAuthUI();
    await refreshBetHistoryUI();
    return;
  }catch(error){
    console.warn('No se pudo inicializar perfil seguro en Supabase.', error);
    showToast('Seguridad Supabase no disponible. Intenta de nuevo en unos segundos.','error');
    throw error;
  }
}

async function saveUserProfile(patch = {}){
  return currentProfile;
}

async function loadUserAchievements(){
  if(!supabaseClient || !currentUser?.email) return;

  const {data, error} = await supabaseClient
    .from('user_achievements')
    .select('id,achievement_key,title,points,created_at')
    .eq('email', currentUser.email)
    .order('created_at', {ascending:false});

  if(error){
    console.warn('No se pudieron leer logros desde Supabase. Tabla esperada: user_achievements.', error);
    return;
  }

  window.RaniLogros.userAchievements = data || [];
}

async function saveAchievement(achievementKey, title, points){
  if(!supabaseClient || !currentUser?.email) return;

  const {error} = await supabaseClient
    .from('user_achievements')
    .upsert({
      user_id: currentUser.id,
      email: currentUser.email,
      achievement_key: achievementKey,
      title,
      points,
      created_at: new Date().toISOString()
    }, {onConflict:'email,achievement_key'});

  if(error) console.warn('No se pudo guardar logro en Supabase.', error);
}

function normalizePromoCodeInput(){
  const input = document.getElementById('promoCodeInput');
  if(!input) return;
  input.value = input.value.replace(/[^A-Za-z0-9.-]/g, '').toUpperCase().slice(0, 24);
}

function bindPromoCodeInput(){
  const input = document.getElementById('promoCodeInput');
  if(!input || input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';
  input.addEventListener('input', normalizePromoCodeInput);
}

async function redeemPromoCode(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para canjear códigos','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality','error');return;}
  normalizePromoCodeInput();

  const input = document.getElementById('promoCodeInput');
  const code = input?.value.trim().toUpperCase();
  if(!code){showToast('Escribe un código Brutality primero','error');return;}

  let result;
  try{
    result = await callRpc('redeem_promo_code_secure', {p_code: code});
  }catch(error){
    const message = String(error?.message || '').toLowerCase();
    if(message.includes('already_used')){
      showToast('¡OIGA OIGA! Ya reclamaste este botín antes','error');
      return;
    }
    if(message.includes('promo_not_found') || message.includes('promo_inactive') || message.includes('invalid_code')){
      showToast('¡NO PUEEEE! Ese código no existe','error');
      return;
    }
    console.warn('Error canjeando promo_codes.', error);
    showToast('No se pudo canjear el código ahora','error');
    return;
  }

  const reward = Number(result?.reward_amount || 0);
  currentProfile = result?.profile || currentProfile;
  updateBalanceDisplay(currentProfile?.coins ?? balance, false);
  await saveAchievement('promo_' + code.toLowerCase(), 'Código Brutality ' + code, reward);
  input.value = '';
  showToast('¡Éxito! Has ganado +100 RaniCoins','success');
}

function getProfileWinRate(bets, won){
  return bets > 0 ? Number(((won / bets) * 100).toFixed(2)) : 0;
}

async function syncBetStats(stake, totalOdd){
  const nextBets = Number(currentProfile?.bets || 0);
  const nextBestOdd = Math.max(Number(currentProfile?.best_odd || 0), Number(totalOdd || 0));

  if(nextBets === 1) await saveAchievement('first_bet', 'Primera apuesta RANIBET', 25);
  if(totalOdd >= 4) await saveAchievement('high_odd', 'Cazador de cuota alta', 50);
}

async function fetchGlobalRanking(){
  return fetchHistoricalRanking();
}

function getRankingKey(email, username){
  return String(email || username || '').trim().toLowerCase();
}

function createRankingPeriodUser(seed = {}){
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

function getOrCreateRankingPeriodUser(map, key, seed = {}){
  if(!map.has(key)) map.set(key, createRankingPeriodUser({key, ...seed}));
  const user = map.get(key);
  if(seed.name) user.name = seed.name;
  if(seed.title) user.title = seed.title;
  if(seed.initialBankroll && !user.initialBankroll) user.initialBankroll = Number(seed.initialBankroll);
  return user;
}

function buildPeriodRankingRowsV2(ticketRows = [], snapshotRows = [], profileRows = [], options = {}){
  const totalMatches = Math.max(Number(options.totalMatches || MATCHES.length || 1), 1);
  const limit = Number(options.limit || WEEKLY_RANKING_LIMIT);
  const officialResolved = Number(options.officialResolved || 3);
  const rankingMap = new Map();

  snapshotRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    getOrCreateRankingPeriodUser(rankingMap, key, {
      name: row.username || 'Brutality',
      initialBankroll: Number(row.starting_coins || 0)
    });
  });

  profileRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    getOrCreateRankingPeriodUser(rankingMap, key, {
      name: row.username || 'Brutality',
      title: row.title || '',
      initialBankroll: Number(row.coins || 0)
    });
  });

  ticketRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    const picks = Array.isArray(row.picks) ? row.picks.map(normalizeStoredPick).filter(p => p.matchId || p.match) : [];
    if(!picks.length) return;

    const user = getOrCreateRankingPeriodUser(rankingMap, key, {name: row.username || 'Brutality'});
    const totalStake = Number(row.stake || 0);
    const totalPayout = Number(row.payout || 0);
    const totalOdd = Number(row.total_odd || row.totalOdd || 0);
    const stakeShare = totalStake / picks.length;
    const payoutShare = totalPayout / picks.length;

    user.totalTickets += 1;
    user.totalStaked += totalStake;
    user.totalPayout += totalPayout;
    user.bestOdd = Math.max(user.bestOdd, totalOdd);
    if(row.status === 'WON') user.wonTickets += 1;
    else if(row.status === 'LOST') user.lostTickets += 1;
    else user.pendingTickets += 1;

    picks.forEach(pick => {
      const matchKey = String(pick.matchId || pick.match || '').trim();
      if(!matchKey) return;
      if(!user.matches.has(matchKey)){
        user.matches.set(matchKey, {
          sides: new Set(),
          hasWon: false,
          hasLost: false,
          hasPending: false,
          stake: 0,
          payout: 0
        });
      }

      const summary = user.matches.get(matchKey);
      if(pick.type) summary.sides.add(pick.type);
      summary.stake += stakeShare;
      summary.payout += payoutShare;
      if(row.status === 'WON') summary.hasWon = true;
      if(row.status === 'LOST') summary.hasLost = true;
      if(row.status === 'PENDING') summary.hasPending = true;
    });
  });

  const rows = Array.from(rankingMap.values()).map(user => {
    let won = 0;
    let lost = 0;
    let contaminated = 0;
    let pending = 0;

    user.matches.forEach(match => {
      const contaminatedMatch = match.sides.size > 1 || (match.hasWon && match.hasLost);
      if(contaminatedMatch){
        contaminated++;
        return;
      }
      if(match.hasWon){
        won++;
        return;
      }
      if(match.hasLost){
        lost++;
        return;
      }
      pending++;
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

  return rows.slice(0, limit).map((row, index) => ({...row, pos:index + 1}));
}

function isRowInPeriod(row, periodInfo){
  const createdAt = new Date(row?.created_at || '');
  if(!Number.isFinite(createdAt.getTime())) return false;
  return createdAt >= periodInfo.start && createdAt < periodInfo.end;
}

function createMonthlyStandingUser(seed = {}){
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

function buildMonthlyRankingRowsFromWeeklyPeriods(periods = [], ticketRows = [], snapshotRows = [], profileRows = []){
  const monthlyMap = new Map();

  periods.forEach(period => {
    const weeklyRows = buildPeriodRankingRowsV2(
      ticketRows.filter(row => isRowInPeriod(row, period)),
      snapshotRows.filter(row => row.week_id === period.id),
      profileRows,
      {totalMatches: Math.max(MATCHES.length, 1), limit: WEEKLY_RANKING_LIMIT}
    );

    weeklyRows.forEach(row => {
      const key = String(row.key || getRankingKey('', row.name)).trim().toLowerCase();
      if(!key) return;

      if(!monthlyMap.has(key)){
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
    .map(user => {
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
    .map((row, index) => ({...row, pos:index + 1}));
}

function buildHistoricalRankingRowsV2(ticketRows = [], profileRows = []){
  const rankingMap = new Map();

  profileRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    getOrCreateRankingPeriodUser(rankingMap, key, {
      name: row.username || 'Brutality',
      title: row.title || ''
    });
  });

  ticketRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    const user = getOrCreateRankingPeriodUser(rankingMap, key, {name: row.username || 'Brutality'});
    const stake = Number(row.stake || 0);
    const payout = Number(row.payout || 0);
    const totalOdd = Number(row.total_odd || row.totalOdd || 0);

    user.totalTickets += 1;
    user.bestOdd = Math.max(user.bestOdd, totalOdd);
    if(row.status === 'WON'){
      user.wonTickets += 1;
      user.totalStaked += stake;
      user.totalPayout += payout;
    }else if(row.status === 'LOST'){
      user.lostTickets += 1;
      user.totalStaked += stake;
    }else{
      user.pendingTickets += 1;
    }
  });

  return Array.from(rankingMap.values())
    .map(user => {
      const settled = user.wonTickets + user.lostTickets;
      const winRate = settled ? (user.wonTickets / settled) * 100 : 0;
      const profit = user.totalPayout - user.totalStaked;
      return {
        pos: 0,
        name: user.name || 'Brutality',
        bets: user.totalTickets,
        won: user.wonTickets,
        profit: Number(profit.toFixed(2)),
        bestOdd: Number(user.bestOdd || 0),
        winRate: Number(winRate.toFixed(1)),
        title: user.title || '',
        score: Number(profit.toFixed(2)),
        status:'Leyenda',
        coverageRate:0,
        riskRate:0,
        cleanRate:100
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
    .map((row, index) => ({...row, pos:index + 1}));
}

async function fetchPeriodRankingV2(periodInfo, snapshotTable, idColumn, limit){
  if(!supabaseClient) return {rows: [], unavailable: true, info: periodInfo};

  const [ticketsRes, snapshotsRes, profilesRes] = await Promise.all([
    supabaseClient
      .from('bet_tickets')
      .select('email,username,status,picks,stake,payout,total_odd,created_at')
      .gte('created_at', periodInfo.start.toISOString())
      .lt('created_at', periodInfo.end.toISOString())
      .not('username', 'is', null)
      .neq('username', ''),
    supabaseClient
      .from(snapshotTable)
      .select('email,username,starting_coins')
      .eq(idColumn, periodInfo.id),
    supabaseClient
      .from('profiles')
      .select('email,username,coins,title')
      .not('username', 'is', null)
      .neq('username', '')
  ]);

  if(ticketsRes.error){
    console.warn(`No se pudo cargar ranking desde ${snapshotTable}.`, ticketsRes.error);
    return {rows: [], unavailable: true, info: periodInfo};
  }

  if(snapshotsRes.error) console.warn(`No se pudo cargar ${snapshotTable}.`, snapshotsRes.error);
  if(profilesRes.error) console.warn('No se pudo cargar perfiles para ranking.', profilesRes.error);

  return {
    rows: buildPeriodRankingRowsV2(ticketsRes.data || [], snapshotsRes.data || [], profilesRes.data || [], {
      totalMatches: Math.max(MATCHES.length, 1),
      limit
    }),
    unavailable: false,
    info: periodInfo
  };
}

async function fetchRankingFromApi(type){
  const response = await fetch(`/api/ranking?type=${encodeURIComponent(type)}`, {
    cache: 'no-store'
  });
  if(!response.ok) throw new Error(`ranking_api_${type}_${response.status}`);
  return response.json();
}

async function fetchMonthlyWinnersHistory(){
  try{
    const response = await fetch('/api/winners', {cache:'no-store'});
    if(!response.ok) throw new Error(`winners_api_${response.status}`);
    const data = await response.json();
    return Array.isArray(data?.rows) ? data.rows : [];
  }catch(error){
    logClientEvent('warn', 'monthly_winners', 'No se pudo cargar historial de ganadores mensuales', {message: String(error?.message || error)});
    return [];
  }
}

async function fetchWeeklyRankingLocal(){
  const weekInfo = getCurrentWeekInfo();
  const result = await fetchPeriodRankingV2(weekInfo, 'weekly_rank_snapshots', 'week_id', WEEKLY_RANKING_LIMIT);
  return {rows: result.rows, unavailable: result.unavailable, weekInfo};
}

async function fetchWeeklyRanking(){
  try{
    const result = await fetchRankingFromApi('weekly');
    return {
      rows: result?.rows || [],
      unavailable: Boolean(result?.unavailable),
      weekInfo: result?.weekInfo || getCurrentWeekInfo()
    };
  }catch(error){
    logClientEvent('warn', 'ranking_weekly', 'Fallo ranking semanal cacheado', {message: String(error?.message || error)});
    console.warn('Fallo /api/ranking?type=weekly. Se usará cálculo local.', error);
    return fetchWeeklyRankingLocal();
  }
}

async function fetchMonthlyRankingLocal(){
  const monthInfo = getCurrentMonthInfo();
  const periods = getMonthlyWeeklyPeriods();
  if(!supabaseClient) return {rows: [], unavailable: true, monthInfo, periods};
  if(!periods.length) return {rows: [], unavailable: false, monthInfo, periods};

  const rangeStart = periods[0].start.toISOString();
  const rangeEnd = periods[periods.length - 1].end.toISOString();
  const weekIds = periods.map(period => period.id);

  const [ticketsRes, snapshotsRes, profilesRes] = await Promise.all([
    supabaseClient
      .from('bet_tickets')
      .select('email,username,status,picks,stake,payout,total_odd,created_at')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)
      .not('username', 'is', null)
      .neq('username', ''),
    supabaseClient
      .from('weekly_rank_snapshots')
      .select('week_id,email,username,starting_coins')
      .in('week_id', weekIds),
    supabaseClient
      .from('profiles')
      .select('email,username,coins,title')
      .not('username', 'is', null)
      .neq('username', '')
  ]);

  if(ticketsRes.error){
    console.warn('No se pudo cargar ranking mensual acumulado desde bet_tickets.', ticketsRes.error);
    return {rows: [], unavailable: true, monthInfo, periods};
  }

  if(snapshotsRes.error) console.warn('No se pudo cargar weekly_rank_snapshots para ranking mensual.', snapshotsRes.error);
  if(profilesRes.error) console.warn('No se pudo cargar perfiles para ranking mensual.', profilesRes.error);

  return {
    rows: buildMonthlyRankingRowsFromWeeklyPeriods(
      periods,
      ticketsRes.data || [],
      snapshotsRes.data || [],
      profilesRes.data || []
    ),
    unavailable: false,
    monthInfo,
    periods
  };
}

async function fetchMonthlyRanking(){
  try{
    const result = await fetchRankingFromApi('monthly');
    return {
      rows: result?.rows || [],
      unavailable: Boolean(result?.unavailable),
      monthInfo: result?.monthInfo || getCurrentMonthInfo(),
      periods: result?.periods || getMonthlyWeeklyPeriods()
    };
  }catch(error){
    logClientEvent('warn', 'ranking_monthly', 'Fallo ranking mensual cacheado', {message: String(error?.message || error)});
    console.warn('Fallo /api/ranking?type=monthly. Se usará cálculo local.', error);
    return fetchMonthlyRankingLocal();
  }
}

async function fetchHistoricalRankingLocal(){
  if(!supabaseClient) return null;

  const [ticketsRes, profilesRes] = await Promise.all([
    supabaseClient
      .from('bet_tickets')
      .select('email,username,status,stake,payout,total_odd,created_at')
      .not('username', 'is', null)
      .neq('username', ''),
    supabaseClient
      .from('profiles')
      .select('email,username,title')
      .not('username', 'is', null)
      .neq('username', '')
  ]);

  if(ticketsRes.error){
    console.warn('No se pudo cargar Ranking Histórico desde bet_tickets.', ticketsRes.error);
    return null;
  }
  if(profilesRes.error) console.warn('No se pudo cargar perfiles para ranking histórico.', profilesRes.error);

  return buildHistoricalRankingRowsV2(ticketsRes.data || [], profilesRes.data || []);
}

async function fetchHistoricalRanking(){
  try{
    const result = await fetchRankingFromApi('historical');
    return result?.rows || [];
  }catch(error){
    logClientEvent('warn', 'ranking_historical', 'Fallo ranking histórico cacheado', {message: String(error?.message || error)});
    console.warn('Fallo /api/ranking?type=historical. Se usará cálculo local.', error);
    return fetchHistoricalRankingLocal();
  }
}

function subscribeToRanking(){
  if(!supabaseClient) return;

  supabaseClient
    .channel('ranking-live-updates')
    .on('postgres_changes', {event:'*', schema:'public', table:'profiles'}, () => {
      const rankingPage = document.getElementById('page-ranking');
      if(rankingPage?.classList.contains('active')) renderRanking();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'bet_tickets'}, () => {
      const rankingPage = document.getElementById('page-ranking');
      if(rankingPage?.classList.contains('active')) renderRanking();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'weekly_rank_snapshots'}, () => {
      const rankingPage = document.getElementById('page-ranking');
      if(rankingPage?.classList.contains('active')) renderRanking();
    })
    .on('postgres_changes', {event:'*', schema:'public', table:'monthly_rank_snapshots'}, () => {
      const rankingPage = document.getElementById('page-ranking');
      if(rankingPage?.classList.contains('active')) renderRanking();
    })
    .subscribe();
}

function buildTicker(){
  const tickerInner = document.getElementById('tickerInner');
  if(!tickerInner) return;
  const live = MATCHES.filter(m => m.live);
  let html = '';
  for(let pass = 0; pass < 2; pass++){
    live.forEach(m => {
      html += `<div class="ticker-item"><span class="ticker-live">EN VIVO</span><div class="ticker-dot"></div><span class="ticker-teams">${escapeHtml(m.home)} <span class="ticker-score">${escapeHtml(m.score || '-')}</span> ${escapeHtml(m.away)}</span><span class="ticker-min">${escapeHtml(formatLiveMinuteLabel(m.minute))}</span></div>`;
    });
    MATCHES.filter(m => !m.live).slice(0,4).forEach(m => {
      const leagueLabel = String(m.leagueName || '').split(' ')[0].toUpperCase();
      html += `<div class="ticker-item"><span style="color:var(--gold2);font-size:11px;font-weight:700">${escapeHtml(leagueLabel)}</span><span class="ticker-teams">${escapeHtml(m.home)} <span style="color:rgba(255,255,255,.4)">vs</span> ${escapeHtml(m.away)}</span><span style="color:rgba(255,255,255,.5);font-size:10px">${escapeHtml(m.time)}</span></div>`;
    });
  }
  tickerInner.innerHTML = html;
}

function renderMatches(filter = 'all'){
  currentLeague = filter;
  const list = document.getElementById('matchesList');
  if(!list) return;
  const data = filter === 'all' ? MATCHES : MATCHES.filter(m => m.league === filter);
  if(!data.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">No hay partidos en esta categoría</div>';return;}
  list.innerHTML = data.map(m => matchCardHTML(m)).join('');
  updateOddBtnStates();
}

function isMatchOddsVerified(m){
  return Boolean(
    m?.oddsVerified &&
    Number.isFinite(Number(m?.odds?.h)) &&
    Number.isFinite(Number(m?.odds?.d)) &&
    Number.isFinite(Number(m?.odds?.a))
  );
}

function formatOddValue(m, type){
  return isMatchOddsVerified(m) ? Number(m.odds[type]).toFixed(2) : 'Sin cuota';
}

function oddButtonHTML(m, safeMatchId, type, label){
  const verified = isMatchOddsVerified(m);
  const disabled = verified ? '' : ' disabled aria-disabled="true"';
  const noOddsClass = verified ? '' : ' no-odds';
  const click = verified ? ` onclick="addPick('${safeMatchId}','${type}')"` : '';
  return `<button class="odd-btn${noOddsClass}" id="ob-${safeHtmlId(m.id)}-${type}"${click}${disabled}><span class="odd-label">${escapeHtml(label)}</span><span class="odd-value">${escapeHtml(formatOddValue(m,type))}</span></button>`;
}

function matchCardHTML(m){
  const isLive = m.live;
  const safeMatchId = String(m.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const htmlMatchId = safeHtmlId(m.id);
  const liveBadgeTime = escapeHtml(formatLiveMinuteLabel(m.minute));
  const matchTime = escapeHtml(m.time);
  const homeFirst = String(m.home || '').split(' ')[0];
  const awayFirst = String(m.away || '').split(' ')[0];
  const center = isLive
    ? `<div class="score-live">${escapeHtml(m.score || '-')}</div><div class="score-min">${escapeHtml(formatLiveStatusText(m.minute))}</div>`
    : `<div class="vs-text">VS</div><div class="match-date-sub">${matchTime}</div>`;
  return `<div class="match-card" id="mc-${htmlMatchId}"><div class="match-header"><div class="match-league-name"><span class="match-league-flag">${leagueFlag(m.league)}</span>${escapeHtml(m.leagueName)}</div><div class="match-right-info">${isLive ? '<span class="live-badge">\uD83D\uDD34 EN VIVO</span>' : ''}<span class="match-time-badge">${isLive ? liveBadgeTime : matchTime}</span></div></div><div class="match-body"><div class="teams-row"><div class="team-side"><div class="team-icon">${escapeHtml(m.homeEmoji)}</div><div class="team-name">${escapeHtml(m.home)}</div></div><div class="match-center">${center}</div><div class="team-side"><div class="team-icon">${escapeHtml(m.awayEmoji)}</div><div class="team-name">${escapeHtml(m.away)}</div></div></div></div><div class="odds-row">${oddButtonHTML(m,safeMatchId,'h',`1 - ${homeFirst}`)}${oddButtonHTML(m,safeMatchId,'d','X - Empate')}${oddButtonHTML(m,safeMatchId,'a',`2 - ${awayFirst}`)}</div><div class="more-mkts"><button class="more-mkts-btn" onclick="showToast('Mercados adicionales próximamente','info')">+12 mercados \u26BD</button></div></div>`;
}

function leagueFlag(league){return {liga1:'\uD83C\uDDF5\uD83C\uDDEA',copa:'\uD83C\uDDF5\uD83C\uDDEA',champions:'\u2B50',laliga:'\uD83C\uDDEA\uD83C\uDDF8',premier:'\uD83C\uDDEC\uD83C\uDDE7',libertadores:'\uD83C\uDFC6',seriea:'\uD83C\uDDEE\uD83C\uDDF9'}[league] || '\u26BD';}

function addPick(matchId,type){
  const match = MATCHES.find(m => m.id === matchId);
  if(!match) return;
  if(!isMatchOddsVerified(match)){showToast('Cuotas no verificadas por el feed todavía','error');return;}
  const pickLabels = {h:`${match.home} gana`,d:'Empate',a:`${match.away} gana`};
  const odd = match.odds[type];
  const existing = ticket.findIndex(t => t.matchId === matchId);
  if(existing >= 0){
    if(ticket[existing].type === type){ticket.splice(existing,1);showToast('Selección retirada del ticket');}
    else{ticket[existing] = {matchId,type,league:match.leagueName,match:`${match.home} vs ${match.away}`,pick:pickLabels[type],odd};showToast('Selección cambiada');}
  }else{
    ticket.push({matchId,type,league:match.leagueName,match:`${match.home} vs ${match.away}`,pick:pickLabels[type],odd});
    showToast('¡Añadido al ticket!');
  }
  updateOddBtnStates();
  renderTicket();
}

function updateOddBtnStates(){
  document.querySelectorAll('.odd-btn').forEach(b => b.classList.remove('selected'));
  ticket.forEach(t => {const el = document.getElementById(`ob-${safeHtmlId(t.matchId)}-${t.type}`); if(el) el.classList.add('selected');});
}

function setBetType(type){
  betType = type;
  document.getElementById('tttSingle')?.classList.toggle('active', type === 'simple');
  document.getElementById('tttCombo')?.classList.toggle('active', type === 'combinada');
  renderTicket();
}

function getTotalOdd(){
  if(!ticket.length) return 1;
  const total = ticket.reduce((acc,t) => acc * safeNumber(t.odd), 1);
  return Number.isFinite(total) ? total : 0;
}

function renderTicket(){
  const body = document.getElementById('ticketBody');
  const foot = document.getElementById('ticketFoot');
  const badge = document.getElementById('ticketBadge');
  if(!body || !foot || !badge) return;
  badge.textContent = ticket.length;
  if(!ticket.length){
    body.innerHTML = `<div class="ticket-empty"><div class="ticket-empty-title">Ticket vacío</div><div class="ticket-empty-sub">Haz clic en una cuota para añadir tu selección al ticket.</div></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = `<div class="ticket-items-wrap">${ticket.map((t,i) => `<div class="ticket-item"><button class="ticket-item-rm" onclick="removePick(${i})">?</button><div class="ticket-item-league">${escapeHtml(t.league)}</div><div class="ticket-item-match">${escapeHtml(t.match)}</div><div class="ticket-item-pick">${escapeHtml(t.pick)}</div><div class="ticket-item-odd-row"><span class="ticket-item-odd-label">Cuota</span><span class="ticket-item-odd-val">${safeNumber(t.odd).toFixed(2)}</span></div></div>`).join('')}</div>`;
  const total = getTotalOdd();
  const stakeVal = clamp(safeNumber(document.getElementById('stakeValInput')?.value, 10), 1, Math.max(1, safeNumber(balance, 1)));
  foot.innerHTML = `<div class="ticket-footer"><div class="tfoot-row"><span class="tfoot-label">SELECCIONES</span><span class="tfoot-val">${ticket.length}</span></div><div class="tfoot-row"><span class="tfoot-label">CUOTA TOTAL</span><span class="tfoot-val tfoot-odd">${total.toFixed(2)}</span></div><div class="stake-wrap"><div class="stake-lbl">MONTO A APOSTAR (R) <span onclick="stakeAll()">MAX</span></div><div class="stake-presets"><button class="preset-btn" onclick="setStake(5)">R5</button><button class="preset-btn" onclick="setStake(10)">R10</button><button class="preset-btn" onclick="setStake(25)">R25</button><button class="preset-btn" onclick="setStake(50)">R50</button></div><input type="number" class="stake-input" id="stakeValInput" value="${stakeVal}" min="1" max="${balance}" oninput="updatePotential()"></div><div class="potential-box"><span class="pot-label">Ganancia Potencial</span><span class="pot-val" id="potVal">R${(total * stakeVal).toFixed(2)}</span></div><button class="btn-clear-t" onclick="clearTicket()">Limpiar ticket</button><button class="btn-bet-main" onclick="placeBet()">APOSTAR AHORA</button></div>`;
}

function setStake(v){
  const input = document.getElementById('stakeValInput');
  if(!input) return;
  input.value = v;
  updatePotential();
}
function stakeAll(){
  const input = document.getElementById('stakeValInput');
  if(!input) return;
  input.value = balance;
  updatePotential();
}
function updatePotential(){const total = getTotalOdd();const stake = safeNumber(document.getElementById('stakeValInput')?.value, 0);const el = document.getElementById('potVal');if(el) el.textContent = `R${(total * stake).toFixed(2)}`;}
function removePick(i){ticket.splice(i,1);updateOddBtnStates();renderTicket();}
function clearTicket(){ticket = [];updateOddBtnStates();renderTicket();showToast('Ticket limpiado');}

async function placeBet(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para guardar tus RaniCoins','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality','error');return;}
  if(!ticket.length){showToast('¡Añade picks al ticket!','error');return;}
  const stake = safeNumber(document.getElementById('stakeValInput')?.value, 0);
  if(!Number.isFinite(stake) || stake < 1){showToast('Mínimo R1 para apostar','error');return;}
  if(stake > balance){showToast('No tienes suficientes RaniCoins','error');return;}
  const totalOdd = getTotalOdd();
  if(!Number.isFinite(totalOdd) || totalOdd < 1.01 || totalOdd > 100000){showToast('Ticket inválido. Actualiza las cuotas e intenta de nuevo.','error');return;}
  const payout = totalOdd * stake;
  const tid = 'RNB-' + Math.floor(10000 + Math.random() * 89999);
  const ticketRow = normalizeStoredBet({
    id: tid,
    date: getCurrentDateLabel(),
    createdAt: new Date().toISOString(),
    user: currentProfile?.username || 'Brutality',
    status: 'PENDING',
    picks: ticket.map(t => ({matchId:t.matchId,type:t.type,match:t.match,pick:t.pick,odd:t.odd,league:t.league})),
    totalOdd,
    stake,
    payout
  });

  try{
    const result = await callRpc('place_bet_secure', {
      p_ticket_code: tid,
      p_picks: ticketRow.picks,
      p_total_odd: totalOdd,
      p_stake: stake
    });
    const serverTicket = result?.ticket || null;
    const serverProfile = result?.profile || null;
    if(serverTicket){
      ticketRow.id = serverTicket.ticket_code || ticketRow.id;
      ticketRow.createdAt = serverTicket.created_at || ticketRow.createdAt;
      ticketRow.user = serverTicket.username || ticketRow.user;
      ticketRow.payout = Number(serverTicket.payout || ticketRow.payout);
    }
    if(serverProfile){
      currentProfile = serverProfile;
      updateBalanceDisplay(serverProfile.coins ?? balance, false);
    }
  }catch(error){
    console.warn('No se pudo guardar ticket online.', error);
    showToast('No se pudo registrar la apuesta en Supabase','error');
    return;
  }

  betsHistory.unshift(ticketRow);
  await syncBetStats(stake, totalOdd);
  const modal = document.getElementById('ticketModal');
  const betDetails = document.getElementById('mBetDetails');
  setTextIfExists('mTicketId', ticketRow.id);
  setTextIfExists('mPicks', String(ticket.length));
  if(betDetails){
    betDetails.innerHTML = ticketRow.picks
      .map(p => `<div class="modal-pick-item">${escapeHtml(p.match)} <strong>→ ${escapeHtml(p.pick)}</strong></div>`)
      .join('');
  }
  setTextIfExists('mOdd', totalOdd.toFixed(2));
  setTextIfExists('mStake', 'R' + stake);
  setTextIfExists('mPotential', 'R' + payout.toFixed(2));
  if(modal) modal.classList.add('open');
  ticket = [];
  updateOddBtnStates();
  renderTicket();
  await refreshBetHistoryUI();
}

function closeModal(){
  const modal = document.getElementById('ticketModal');
  if(modal) modal.classList.remove('open');
}
async function addCoins(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para recargar RaniCoins','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality','error');return;}
  showToast('Recargas pausadas temporalmente. No se agregó crédito.','info');
}

function renderHistory(filter = null){
  const list = document.getElementById('historyList');
  if(!list) return;
  const rows = betsHistory.map(buildRenderableBet);
  const data = filter ? rows.filter(b => b.status === filter) : rows;
  const won = rows.filter(b => b.status === 'WON');
  const settled = rows.filter(b => b.status !== 'PENDING');
  const profit = rows.reduce((a,b) => b.status === 'WON' ? a + (b.payout - b.stake) : b.status === 'LOST' ? a - b.stake : a, 0);
  const rate = settled.length ? Math.round(won.length / settled.length * 100) : 0;
  setTextIfExists('statTotal', String(betsHistory.length));
  setTextIfExists('statWon', String(won.length));
  setTextIfExists('statRate', rate + '%');
  setTextIfExists('statProfit', 'R' + profit.toFixed(0));
  if(!data.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">No hay apuestas en esta categoría</div>';return;}
  list.innerHTML = data.map(b => historyCardHTML(b)).join('');
}

function renderWon(){
  const rows = betsHistory.map(buildRenderableBet);
  const won = rows.filter(b => b.status === 'WON');
  const total = won.reduce((a,b) => a + b.payout, 0);
  const best = won.length ? Math.max(...won.map(b => b.totalOdd)) : 0;
  let streak = 0;
  for(let i = 0; i < rows.length; i++){if(rows[i].status === 'WON') streak++; else break;}
  const list = document.getElementById('wonList');
  setTextIfExists('wonCount', String(won.length));
  setTextIfExists('wonCoins', 'R' + total.toFixed(0));
  setTextIfExists('wonBestOdd', best > 0 ? best.toFixed(2) : '-');
  setTextIfExists('wonStreak', String(streak));
  if(!list) return;
  if(!won.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">Aún no tienes apuestas ganadas</div>';return;}
  list.innerHTML = won.map(b => historyCardHTML(b)).join('');
}

function historyCardHTML(b){
  const status = ['WON', 'LOST', 'PENDING'].includes(b.status) ? b.status : 'PENDING';
  const bClass = {WON:'badge-won',LOST:'badge-lost',PENDING:'badge-pending'}[status];
  const bLabel = {WON:'GANADA',LOST:'PERDIDA',PENDING:'PENDIENTE'}[status];
  const payColor = status === 'WON' ? 'hf-won' : status === 'LOST' ? 'hf-lost' : '';
  const payout = safeNumber(b.payout);
  const payVal = status === 'WON' ? 'R' + payout.toFixed(2) : status === 'LOST' ? '-' : 'R' + payout.toFixed(2) + '*';
  const picks = Array.isArray(b.picks) ? b.picks : [];
  return `<div class="h-card"><div class="h-card-head"><div><div class="h-card-id">${escapeHtml(b.id)}</div><div class="h-card-date">${escapeHtml(b.date)}</div></div><div class="badge ${bClass}">${bLabel}</div></div><div class="h-picks">${picks.map(p => `<div class="h-pick"><div class="h-pick-info"><div class="h-pick-match">${escapeHtml(p.match)}</div><div class="h-pick-sel">${escapeHtml(p.pick)}</div></div><div class="h-pick-odd">${safeNumber(p.odd).toFixed(2)}</div></div>`).join('')}</div><div class="h-fin"><div class="hf"><div class="hf-lbl">Cuota</div><div class="hf-val">${safeNumber(b.totalOdd).toFixed(2)}</div></div><div class="hf"><div class="hf-lbl">Apostado</div><div class="hf-val">R${safeNumber(b.stake).toFixed(2)}</div></div><div class="hf"><div class="hf-lbl">${status === 'WON' ? 'Cobrado' : status === 'PENDING' ? 'Potencial' : 'Perdido'}</div><div class="hf-val ${payColor}">${payVal}</div></div></div></div>`;
}

function setRankingTab(tab, el){
  rankingTab = tab === 'historical' ? 'historical' : tab === 'monthly' ? 'monthly' : 'weekly';
  document.querySelectorAll('.rank-tab').forEach(button => button.classList.remove('active'));
  if(el) el.classList.add('active');
  renderRanking();
}

function renderRankingEmptyState(message){
  const list = document.getElementById('rankList');
  if(!list) return;
  setTextIfExists('rlTotal', '0');
  setTextIfExists('rlAvgRate', '0%');
  setTextIfExists('rlTopProfit', 'R0');
  list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">${escapeHtml(message)}</div>`;
}

function renderWeeklyRankCards(rows){
  const medals = {1:'\uD83E\uDD47',2:'\uD83E\uDD48',3:'\uD83E\uDD49'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};

  return rows.map(r => {
    const statusClass = r.status === 'OFICIAL' ? '' : ' provisional';
    const duplicateTag = r.contaminated > 0 ? `<span class="rank-status-tag clean-warning">${r.contaminated} duplicado${r.contaminated > 1 ? 's' : ''}</span>` : '';
    const specialTag = r.pos === 1 ? '<span class="rank-status-tag special-title">Rey de la Semana</span>' : r.pos <= 3 ? '<span class="rank-status-tag special-title">Podio Semanal</span>' : '';
    return `<div class="rank-card ${cardClass[r.pos] || ''}"><div class="rank-pos ${posClass[r.pos] || 'pn'}">${r.pos <= 3 ? medals[r.pos] : r.pos}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${escapeHtml(r.name)}</div><span class="rank-status-tag${statusClass}">${r.status}</span>${specialTag}${duplicateTag}${r.title ? `<span class="rank-frog-tag">\uD83D\uDC38 ${escapeHtml(r.title)}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${r.won}/${r.bets}</div><div class="rs-lbl">Partidos</div></div><div class="rank-stat"><div class="rs-val">${r.winRate.toFixed(0)}%</div><div class="rs-lbl">Acierto</div></div><div class="rank-stat"><div class="rs-val">${r.riskRate.toFixed(0)}%</div><div class="rs-lbl">Riesgo</div></div><div class="rank-stat"><div class="rs-val">${r.coverageRate.toFixed(0)}%</div><div class="rs-lbl">Cobertura</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${clamp(r.score, 0, 100)}%"></div></div></div><div class="rank-profit"><div class="rp-val">${r.score.toFixed(1)}</div><div class="rp-lbl">Puntaje</div><div class="rp-lbl" style="margin-top:6px">R${r.profit.toFixed(0)}</div></div></div>`;
  }).join('');
}

function renderMonthlyRankCards(rows){
  const medals = {1:'🥇',2:'🥈',3:'🥉'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};

  return rows.map(r => {
    const lastWeekLabel = r.lastWeekPosition > 0 ? `Sem. actual #${r.lastWeekPosition}` : 'Sin semana puntuada';
    const specialTag = r.pos === 1 ? '<span class="rank-status-tag special-title">Líder del Mes</span>' : r.pos <= 3 ? '<span class="rank-status-tag special-title">Candidato Mensual</span>' : '';
    return `<div class="rank-card ${cardClass[r.pos] || ''}"><div class="rank-pos ${posClass[r.pos] || 'pn'}">${r.pos <= 3 ? medals[r.pos] : r.pos}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${escapeHtml(r.name)}</div><span class="rank-status-tag">${r.status}</span>${specialTag}${r.title ? `<span class="rank-frog-tag">🐸 ${escapeHtml(r.title)}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${safeNumber(r.bets)}</div><div class="rs-lbl">Semanas</div></div><div class="rank-stat"><div class="rs-val">${safeNumber(r.won)}</div><div class="rs-lbl">Victorias</div></div><div class="rank-stat"><div class="rs-val">${safeNumber(r.podiums)}</div><div class="rs-lbl">Podios</div></div><div class="rank-stat"><div class="rs-val">${safeNumber(r.avgWinRate).toFixed(0)}%</div><div class="rs-lbl">Acierto prom.</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${clamp((safeNumber(r.points) / Math.max(MONTHLY_POINTS_BY_POSITION[0] * Math.max(safeNumber(r.bets), 1), 1)) * 100, 0, 100)}%"></div></div></div><div class="rank-profit"><div class="rp-val">${safeNumber(r.points)}</div><div class="rp-lbl">Puntos</div><div class="rp-lbl" style="margin-top:6px">${escapeHtml(lastWeekLabel)}</div></div></div>`;
  }).join('');
}

function renderHistoricalRankCards(rows){
  const medals = {1:'\uD83E\uDD47',2:'\uD83E\uDD48',3:'\uD83E\uDD49'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};

  return rows.map(r => {
    const specialTag = r.pos === 1 ? '<span class="rank-status-tag special-title">Leyenda Suprema</span>' : r.pos <= 3 ? '<span class="rank-status-tag special-title">Salón de Honor</span>' : '';
    return `<div class="rank-card ${cardClass[r.pos] || ''}"><div class="rank-pos ${posClass[r.pos] || 'pn'}">${r.pos <= 3 ? medals[r.pos] : r.pos}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${escapeHtml(r.name)}</div>${specialTag}${r.title ? `<span class="rank-frog-tag">\uD83D\uDC38 ${escapeHtml(r.title)}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${r.bets}</div><div class="rs-lbl">Tickets</div></div><div class="rank-stat"><div class="rs-val">${r.won}</div><div class="rs-lbl">Ganadas</div></div><div class="rank-stat"><div class="rs-val">${r.winRate.toFixed(0)}%</div><div class="rs-lbl">Acierto</div></div><div class="rank-stat"><div class="rs-val">${r.bestOdd.toFixed(2)}</div><div class="rs-lbl">Mejor cuota</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${clamp(r.winRate, 0, 100)}%"></div></div></div><div class="rank-profit"><div class="rp-val">R${r.profit.toFixed(0)}</div><div class="rp-lbl">Ganancia</div></div></div>`;
  }).join('');
}

function renderMonthlyWinnersSection(rows = []){
  const section = document.getElementById('monthlyWinnersSection');
  const list = document.getElementById('monthlyWinnersList');
  if(!section || !list) return;
  if(!rows.length){
    list.innerHTML = '<div style="padding:16px;color:var(--muted);text-align:center">Aún no hay campeones mensuales cerrados.</div>';
    return;
  }
  list.innerHTML = rows.map(row => `<div class="month-winner-card"><div class="month-winner-medal">🏆</div><div class="month-winner-info"><div class="month-winner-name">${escapeHtml(row.winnerName)}<span class="month-winner-pill">${escapeHtml(row.winnerTitle)}</span></div><div class="month-winner-meta"><span>${escapeHtml(row.monthLabel)}</span><span>${escapeHtml(row.seasonLabel)}</span><span>${safeNumber(row.weeklyWins)} victoria${safeNumber(row.weeklyWins) === 1 ? '' : 's'} semanal${safeNumber(row.weeklyWins) === 1 ? '' : 'es'}</span></div></div><div class="month-winner-score"><div class="month-winner-score-val">${safeNumber(row.points)}</div><div class="month-winner-score-lbl">Puntos</div></div></div>`).join('');
}

function getRankingMovementStore(){
  return readJsonStorage(RANKING_POSITION_KEY, {});
}

function saveRankingMovementStore(data){
  writeJsonStorage(RANKING_POSITION_KEY, data);
}

function getRankingSnapshotStore(){
  return readJsonStorage(RANKING_SNAPSHOT_KEY, {});
}

function saveRankingSnapshotStore(data){
  writeJsonStorage(RANKING_SNAPSHOT_KEY, data);
}

function buildRankingSnapshot(rows = []){
  const snapshot = {};
  rows.forEach((row) => {
    const key = String(row?.name || '').trim().toLowerCase();
    if(key && row?.pos) snapshot[key] = Number(row.pos);
  });
  return snapshot;
}

function getTopMoversFromSnapshots(type, rows = []){
  const snapshots = getRankingSnapshotStore();
  const previous = snapshots[type] || {};
  const current = buildRankingSnapshot(rows);

  let bestUp = null;
  let bestDown = null;
  let bestNew = null;

  rows.forEach((row) => {
    const key = String(row?.name || '').trim().toLowerCase();
    if(!key || !row?.pos) return;
    const prevPos = Number(previous[key] || 0);
    if(!prevPos){
      if(!bestNew || row.pos < bestNew.pos) bestNew = {...row};
      return;
    }
    const delta = prevPos - row.pos;
    if(delta > 0 && (!bestUp || delta > bestUp.delta)){
      bestUp = {...row, delta, prevPos};
    }
    if(delta < 0 && (!bestDown || Math.abs(delta) > Math.abs(bestDown.delta))){
      bestDown = {...row, delta, prevPos};
    }
  });

  return {bestUp, bestDown, bestNew, hasPrevious: Object.keys(previous).length > 0, current};
}

function persistRankingSnapshot(type, rows = []){
  const snapshots = getRankingSnapshotStore();
  snapshots[type] = buildRankingSnapshot(rows);
  saveRankingSnapshotStore(snapshots);
}

function renderTopMovers(type, rows = []){
  const section = document.getElementById('topMoversSection');
  const list = document.getElementById('topMoversList');
  const sub = document.getElementById('topMoversSub');
  if(!section || !list || !sub) return;

  const labels = {
    weekly: 'Movimientos del ranking semanal',
    monthly: 'Movimientos del acumulado mensual',
    historical: 'Movimientos del ranking histórico'
  };
  sub.textContent = labels[type] || 'Movimientos recientes del ranking';

  const {bestUp, bestDown, bestNew, hasPrevious} = getTopMoversFromSnapshots(type, rows);

  if(!rows.length){
    list.innerHTML = '<div class="rank-mover-card"><div class="rank-mover-label">Sin datos</div><div class="rank-mover-name">Aún no hay movimientos para mostrar.</div></div>';
    return;
  }

  if(!hasPrevious){
    list.innerHTML = '<div class="rank-mover-card new"><div class="rank-mover-label">Top Movers</div><div class="rank-mover-value new">Listo</div><div class="rank-mover-name">La comparación se activará en la próxima actualización.</div><div class="rank-mover-meta">Necesita una foto anterior del ranking.</div></div>';
    persistRankingSnapshot(type, rows);
    return;
  }

  const upCard = bestUp
    ? `<div class="rank-mover-card up"><div class="rank-mover-label">Sube más</div><div class="rank-mover-value up">+${bestUp.delta}</div><div class="rank-mover-name">${escapeHtml(bestUp.name)}</div><div class="rank-mover-meta">Del #${bestUp.prevPos} al #${bestUp.pos}</div></div>`
    : `<div class="rank-mover-card up"><div class="rank-mover-label">Sube más</div><div class="rank-mover-value up">0</div><div class="rank-mover-name">Sin subida fuerte</div><div class="rank-mover-meta">Nadie mejoró posición en esta actualización.</div></div>`;

  const downCard = bestDown
    ? `<div class="rank-mover-card down"><div class="rank-mover-label">Baja más</div><div class="rank-mover-value down">${bestDown.delta}</div><div class="rank-mover-name">${escapeHtml(bestDown.name)}</div><div class="rank-mover-meta">Del #${bestDown.prevPos} al #${bestDown.pos}</div></div>`
    : `<div class="rank-mover-card down"><div class="rank-mover-label">Baja más</div><div class="rank-mover-value down">0</div><div class="rank-mover-name">Sin caída fuerte</div><div class="rank-mover-meta">Nadie perdió posición en esta actualización.</div></div>`;

  const newCard = bestNew
    ? `<div class="rank-mover-card new"><div class="rank-mover-label">Entra al radar</div><div class="rank-mover-value new">#${bestNew.pos}</div><div class="rank-mover-name">${escapeHtml(bestNew.name)}</div><div class="rank-mover-meta">Aparece por primera vez en esta vista.</div></div>`
    : `<div class="rank-mover-card new"><div class="rank-mover-label">Entra al radar</div><div class="rank-mover-value new">-</div><div class="rank-mover-name">Sin ingreso nuevo</div><div class="rank-mover-meta">No hubo nuevos nombres en esta actualización.</div></div>`;

  list.innerHTML = `${upCard}${downCard}${newCard}`;
  persistRankingSnapshot(type, rows);
}

function maybeNotifyRankingMovement(type, rows = []){
  const username = String(currentProfile?.username || '').trim().toLowerCase();
  if(!username || !rows.length) return;
  const row = rows.find(item => String(item?.name || '').trim().toLowerCase() === username);
  if(!row || !row.pos) return;
  const store = getRankingMovementStore();
  const key = `${type}:${username}`;
  const prevPos = Number(store[key] || 0);
  store[key] = row.pos;
  saveRankingMovementStore(store);
  if(!prevPos || prevPos === row.pos) return;

  const label = type === 'weekly' ? 'semanal' : type === 'monthly' ? 'mensual' : 'histórico';
  if(row.pos === 1 && prevPos !== 1){
    showToast(`¡Ahora lideras el ranking ${label}!`, 'success');
    logClientEvent('info', 'ranking_movement', 'Usuario tomó el liderato', {type, prevPos, nextPos: row.pos});
    return;
  }
  if(prevPos > 3 && row.pos <= 3){
    showToast(`Entraste al Top 3 ${label}`, 'success');
    logClientEvent('info', 'ranking_movement', 'Usuario entró al top 3', {type, prevPos, nextPos: row.pos});
    return;
  }
  if(row.pos < prevPos){
    showToast(`Subiste del #${prevPos} al #${row.pos} en ${label}`, 'success');
    logClientEvent('info', 'ranking_movement', 'Usuario subió posiciones', {type, prevPos, nextPos: row.pos});
    return;
  }
  if(row.pos > prevPos){
    showToast(`Bajaste del #${prevPos} al #${row.pos} en ${label}`, 'info');
    logClientEvent('info', 'ranking_movement', 'Usuario bajó posiciones', {type, prevPos, nextPos: row.pos});
  }
}

async function renderRanking(){
  const list = document.getElementById('rankList');
  if(!list) return;
  renderMonthlyWinnersSection(await fetchMonthlyWinnersHistory());
  const weekInfo = getCurrentWeekInfo();
  const monthInfo = getCurrentMonthInfo();
  document.getElementById('rankTabWeekly')?.classList.toggle('active', rankingTab === 'weekly');
  document.getElementById('rankTabMonthly')?.classList.toggle('active', rankingTab === 'monthly');
  document.getElementById('rankTabHistorical')?.classList.toggle('active', rankingTab === 'historical');
  setTextIfExists('rankingRange', rankingTab === 'weekly'
    ? `Semana del ${weekInfo.label}`
    : rankingTab === 'monthly'
      ? `Mes actual: ${monthInfo.rangeLabel}`
      : 'Trayectoria total de la comunidad');
  setTextIfExists('rankingWeekBadge', rankingTab === 'weekly' ? `SEMANA ${weekInfo.weekNumber}` : 'HISTÓRICO');
  setTextIfExists('rankingTitle', rankingTab === 'weekly' ? '🐸 RANKING TIPSTER SEMANAL' : '🐸 RANKING TIPSTER HISTÓRICO');

  if(rankingTab === 'monthly'){
    setTextIfExists('rankingWeekBadge', monthInfo.label.toUpperCase());
    setTextIfExists('rankingTitle', 'RANKING TIPSTER MENSUAL');
  }else if(rankingTab === 'historical'){
    setTextIfExists('rankingWeekBadge', 'HISTÓRICO');
    setTextIfExists('rankingTitle', 'RANKING TIPSTER HISTÓRICO');
  }else{
    setTextIfExists('rankingTitle', 'RANKING TIPSTER SEMANAL');
  }

  if(rankingTab === 'historical'){
    const rankingRows = await fetchHistoricalRanking() || [];
    if(!rankingRows.length){
      renderRankingEmptyState('Aún no hay usuarios en el ranking histórico');
      return;
    }
    const avgRate = Math.round(rankingRows.reduce((acc, row) => acc + row.winRate, 0) / rankingRows.length);
    const topProfit = Math.max(...rankingRows.map(row => row.profit));
    setTextIfExists('rlTotal', String(rankingRows.length));
    setTextIfExists('rlTotalLabel', `Leyendas Top ${HISTORICAL_RANKING_LIMIT}`);
    setTextIfExists('rlAvgRate', `${avgRate}%`);
    setTextIfExists('rlAvgRateLabel', '% Acierto Hist.');
    setTextIfExists('rlTopProfit', `R${topProfit.toFixed(0)}`);
    setTextIfExists('rlTopProfitLabel', 'Ganancia total');
    list.innerHTML = renderHistoricalRankCards(rankingRows);
    renderTopMovers('historical', rankingRows);
    maybeNotifyRankingMovement('historical', rankingRows);
    return;
  }

  if(rankingTab === 'monthly'){
    const monthlyResult = await fetchMonthlyRanking();
    if(monthlyResult.unavailable){
      renderRankingEmptyState('El ranking mensual necesita lectura pública de tickets y snapshots semanales en Supabase.');
      return;
    }

    const rankingRows = monthlyResult.rows || [];
    if(!rankingRows.length){
      renderRankingEmptyState('Aún no hay apuestas suficientes para el ranking mensual');
      return;
    }

    const weeksCount = monthlyResult.periods?.length || 0;
    const leaderPoints = Math.max(...rankingRows.map(row => row.points || 0));
    setTextIfExists('rlTotal', String(rankingRows.length));
    setTextIfExists('rlTotalLabel', `Mensual Top ${MONTHLY_RANKING_LIMIT}`);
    setTextIfExists('rlAvgRate', String(weeksCount));
    setTextIfExists('rlAvgRateLabel', 'Semanas contadas');
    setTextIfExists('rlTopProfit', String(leaderPoints));
    setTextIfExists('rlTopProfitLabel', 'Puntos líder');
    list.innerHTML = renderMonthlyRankCards(rankingRows);
    renderTopMovers('monthly', rankingRows);
    maybeNotifyRankingMovement('monthly', rankingRows);
    return;
  }

  const weeklyResult = await fetchWeeklyRanking();
  if(weeklyResult.unavailable){
    renderRankingEmptyState('El ranking semanal necesita lectura pública de tickets y snapshots semanales en Supabase.');
    return;
  }

  const rankingRows = weeklyResult.rows || [];
  if(!rankingRows.length){
    renderRankingEmptyState('Aún no hay apuestas suficientes para el ranking semanal');
    return;
  }

  const avgRate = Math.round(rankingRows.reduce((acc, row) => acc + row.winRate, 0) / rankingRows.length);
  const topScore = Math.max(...rankingRows.map(row => row.score));
  setTextIfExists('rlTotal', String(rankingRows.length));
  setTextIfExists('rlTotalLabel', `Top ${WEEKLY_RANKING_LIMIT}`);
  setTextIfExists('rlAvgRate', `${avgRate}%`);
  setTextIfExists('rlAvgRateLabel', '% Acierto Sem.');
  setTextIfExists('rlTopProfit', topScore.toFixed(1));
  setTextIfExists('rlTopProfitLabel', 'Mejor puntaje');
  list.innerHTML = renderWeeklyRankCards(rankingRows);
  renderTopMovers('weekly', rankingRows);
  maybeNotifyRankingMovement('weekly', rankingRows);
}

function renderLive(){
  const live = MATCHES.filter(m => m.live);
  const el = document.getElementById('liveMatchList');
  if(!el) return;
  if(!live.length){el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">No hay partidos en vivo ahora</div>';return;}
  el.innerHTML = live.map(m => matchCardHTML(m)).join('');
  updateOddBtnStates();
}

function showPage(pg,el){
  const targetPage = document.getElementById('page-' + pg);
  const subNav = document.getElementById('subNav');
  if(!targetPage) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.hc-pill').forEach(p => p.classList.remove('active-pg'));
  targetPage.classList.add('active');
  if(el) el.classList.add('active-pg');
  if(subNav) subNav.style.display = pg === 'sports' || pg === 'live' ? 'flex' : 'none';
  if(pg === 'history') renderHistory();
  if(pg === 'won') renderWon();
  if(pg === 'ranking') renderRanking();
  if(pg === 'live') renderLive();
  if(pg === 'sports') renderMatches(currentLeague);
}

function filterLeague(league,el){document.querySelectorAll('.snav-item').forEach(s => s.classList.remove('active'));if(el) el.classList.add('active');renderMatches(league);}
function filterHistory(status,el){document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));if(el) el.classList.add('active');renderHistory(status);}

function showToast(msg,type = 'success'){
  const wrap = document.getElementById('toastWrap');
  if(!wrap){
    console[type === 'error' ? 'error' : 'log'](msg);
    return;
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => {t.classList.remove('show');setTimeout(() => t.remove(),350);},2600);
}

function loadScrapedMatches(scrapedMatches){
  if(!Array.isArray(scrapedMatches)){showToast('El scraper debe devolver un array de partidos','error');return;}
  if(replaceScrapedLeagueMatches(scrapedMatches)) showToast('Partidos actualizados desde scraping','success');
}

function getCurrentDateLabel(now = new Date()){
  const dd = String(now.getDate()).padStart(2, '0');
  const month = MONTHS_ES[now.getMonth()] || '';
  const yyyy = now.getFullYear();
  return `${dd} ${month} ${yyyy}`;
}

function escapeHtml(value){
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHtmlId(value){
  return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function safeNumber(value, fallback = 0){
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function setTextIfExists(id, value){
  const node = document.getElementById(id);
  if(node) node.textContent = value;
}

function parseScraperMatchDate(item){
  const candidates = [
    item?.match_datetime,
    item?.fecha_partido_iso,
    item?.fecha_partido,
    item?.fecha
  ].filter(Boolean);

  for(const rawValue of candidates){
    const raw = String(rawValue).trim();
    if(!raw) continue;
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const dt = new Date(normalized);
    if(Number.isFinite(dt.getTime())) return dt;
  }

  return null;
}

function toDateKey(dt){
  if(!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseScraperTimestamp(item){
  const raw = String(item?.fecha_scrape || '').trim();
  if(!raw) return null;
  const dt = new Date(raw);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function formatLiveMinuteLabel(minute){
  const raw = String(minute || '').trim().toUpperCase();
  if(!raw) return 'EN VIVO';
  if(raw === 'HT' || raw === 'HALFTIME') return 'MT';
  if(raw === 'MT') return 'MT';
  if(raw === '1H' || raw === '1T') return '1T';
  if(raw === '2H' || raw === '2T') return '2T';
  if(/^\d{1,3}(?:\+\d{1,2})?$/.test(raw)) return `${raw}'`;
  const clock = raw.match(/^(\d{1,3}):\d{2}$/);
  if(clock) return `${clock[1]}'`;
  return raw;
}

function formatLiveStatusText(minute){
  const raw = String(minute || '').trim().toUpperCase();
  if(!raw) return 'EN VIVO';
  if(raw === 'HT' || raw === 'HALFTIME' || raw === 'MT') return 'MT';
  if(raw === '1H' || raw === '1T') return '1T';
  if(raw === '2H' || raw === '2T') return '2T';
  if(/^\d{1,3}(?:\+\d{1,2})?$/.test(raw)) return `MIN ${raw}`;
  const clock = raw.match(/^(\d{1,3}):\d{2}$/);
  if(clock) return `MIN ${clock[1]}`;
  return raw;
}

function formatLiga1KickoffLabel(item, matchDate){
  const hourRaw = String(item?.hora_partido || '').trim();
  const fallbackHour = Number.isFinite(matchDate?.getTime())
    ? `${String(matchDate.getHours()).padStart(2, '0')}:${String(matchDate.getMinutes()).padStart(2, '0')}`
    : '';
  const hour = /^\d{1,2}:\d{2}$/.test(hourRaw) ? hourRaw.padStart(5, '0') : fallbackHour;

  if(Number.isFinite(matchDate?.getTime())){
    const now = new Date();
    const isToday = toDateKey(matchDate) === toDateKey(now);
    const dd = String(matchDate.getDate()).padStart(2, '0');
    const mm = String(matchDate.getMonth() + 1).padStart(2, '0');
    if(isToday) return hour ? `Hoy ${hour}` : 'Hoy';
    return hour ? `Próximamente ${dd}/${mm} ${hour}` : `Próximamente ${dd}/${mm}`;
  }

  if(hour) return `Próximamente ${hour}`;
  return 'Próximamente';
}

function isUpcomingScrapedMatch(scrapedItem){
  const matchDate = parseScraperMatchDate(scrapedItem);
  return Boolean(matchDate && matchDate.getTime() >= Date.now());
}

function hasFinishedScrapedState(scrapedItem){
  const rawMinute = String(scrapedItem?.minute || scrapedItem?.status || scrapedItem?.time_text || '').trim().toUpperCase();
  const state = String(scrapedItem?.live_state || '').trim().toLowerCase();
  return (
    /^(FT|AET|PEN|FIN|FINALIZADO)$/.test(rawMinute) ||
    rawMinute.includes('POSTP') ||
    rawMinute.includes('CANCEL') ||
    state === 'post'
  );
}

function keepTodayAndNextJornadaByGroup(rows, league){
  const rawRows = Array.isArray(rows) ? rows : [];
  const now = new Date();
  const liveRows = rawRows.filter(row => isMatchStillLive(row));

  const enriched = rawRows.map(row => ({row, matchDate: parseScraperMatchDate(row)}));
  const withDate = enriched.filter(item => Number.isFinite(item.matchDate?.getTime())).sort((a, b) => a.matchDate - b.matchDate);
  const withoutDate = enriched.filter(item => !Number.isFinite(item.matchDate?.getTime()));

  const upcomingRows = withDate.filter(item => item.matchDate.getTime() >= now.getTime());
  const futureRows = upcomingRows;
  // En vivo + hoy + próxima jornada para todas las ligas principales.
  const nextFutureKeys = [...new Set(futureRows.map(item => toDateKey(item.matchDate)))].slice(0, 3);
  const nextJornadaRows = nextFutureKeys.length
    ? futureRows.filter(item => nextFutureKeys.includes(toDateKey(item.matchDate)))
    : [];

  const selected = [...liveRows.map(row => ({row, matchDate: parseScraperMatchDate(row)})), ...nextJornadaRows];
  if(selected.length){
    const seen = new Set();
    return selected.filter(item => {
      const key = `${item.row?.torneo || ''}|${item.row?.local || ''}|${item.row?.visitante || ''}|${item.row?.match_datetime || ''}|${item.row?.time_text || ''}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(item => item.row);
  }
  if(futureRows.length){
    const fallbackKeys = [...new Set(futureRows.map(item => toDateKey(item.matchDate)))].slice(0, 3);
    return futureRows
      .filter(item => fallbackKeys.includes(toDateKey(item.matchDate)))
      .map(item => item.row);
  }
  return withoutDate
    .filter(item => shouldDisplayScrapedMatch(item.row))
    .slice(0, 10)
    .map(item => item.row);
}

const PRIORITY_LEAGUES = ['liga1', 'champions', 'libertadores', 'premier', 'seriea'];

const SCRAPER_LEAGUE_CONFIG = {
  liga1: {leagueName: 'Liga 1 Peruana', homeEmoji: '🔴', awayEmoji: '🔵'},
  libertadores: {leagueName: 'Copa Libertadores', homeEmoji: '🟡', awayEmoji: '⚫'},
  champions: {leagueName: 'UEFA Champions League', homeEmoji: '🟣', awayEmoji: '⚪'},
  premier: {leagueName: 'Premier League', homeEmoji: '🔴', awayEmoji: '🔵'},
  seriea: {leagueName: 'Serie A', homeEmoji: '🔵', awayEmoji: '⚫'}
};

function isMatchStillLive(scrapedItem) {
  if(scrapedItem?.live !== true) {
    return false;
  }
  const rawMinute = String(scrapedItem.minute || scrapedItem.status || scrapedItem.time_text || '').trim().toUpperCase();
  const state = String(scrapedItem.live_state || '').trim().toLowerCase();
  const scrapeTimestamp = parseScraperTimestamp(scrapedItem);
  const matchStart = parseScraperMatchDate(scrapedItem);

  if(scrapeTimestamp && (Date.now() - scrapeTimestamp.getTime()) > 20 * 60 * 1000){
    return false;
  }

  if(/^(FT|AET|PEN|FIN|FINALIZADO)$/.test(rawMinute) || rawMinute.includes('POSTP') || rawMinute.includes('CANCEL')){
    return false;
  }

  // ESPN state "in" is authoritative for live kickoff, even before first score.
  if(state === 'in') return true;

  if(matchStart && (Date.now() - matchStart.getTime()) > 4 * 60 * 60 * 1000){
    return false;
  }

  if(rawMinute === 'HT' || rawMinute === 'HALFTIME' || rawMinute === 'MT' || rawMinute === 'DESCANSO' || rawMinute === 'BREAK'){
    return true;
  }

  const minuteMatch = rawMinute.match(/^(\d{1,3})(?:\+\d{1,2})?$/);
  if(!minuteMatch) return false;

  const minuteNum = parseInt(minuteMatch[1], 10);
  return Number.isFinite(minuteNum) && minuteNum <= 130;
}

function isFinishedMatch(scrapedItem){
  if(isMatchStillLive(scrapedItem)) return false;
  if(hasFinishedScrapedState(scrapedItem)) return true;
  if(!scrapedItem?.score || !scrapedItem?.local || !scrapedItem?.visitante) return false;

  const matchDate = parseScraperMatchDate(scrapedItem);
  if(matchDate){
    return Date.now() >= matchDate.getTime() + (2 * 60 * 60 * 1000);
  }

  return true;
}

function shouldDisplayScrapedMatch(scrapedItem){
  if(isMatchStillLive(scrapedItem)) return true;
  if(hasFinishedScrapedState(scrapedItem)) return false;
  if(isUpcomingScrapedMatch(scrapedItem)) return true;
  return !isFinishedMatch(scrapedItem);
}

function generatePersistentId(match) {
  const key = `${match.home}|${match.away}|${match.league}`.toLowerCase();
  let hash = 0;
  for(let i = 0; i < key.length; i++){
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return `m${Math.abs(hash).toString(16)}`;
}

function resolveScraperLeague(item){
  const torneo = String(item?.torneo || '').toLowerCase();
  if(torneo.includes('liga 1')) return 'liga1';
  if(torneo.includes('libertador')) return 'libertadores';
  if(torneo.includes('champions')) return 'champions';
  if(torneo.includes('premier')) return 'premier';
  if(torneo.includes('serie a') || torneo.includes('italian serie a')) return 'seriea';
  return null;
}

function getVerifiedOddsFromFlashscore(item){
  const home = Number(item?.mejor_cuota_local ?? item?.cuota_local);
  const draw = Number(item?.mejor_cuota_empate ?? item?.cuota_empate);
  const away = Number(item?.mejor_cuota_visitante ?? item?.cuota_visitante);
  const isValidOdd = (v) => Number.isFinite(v) && v >= 1.01 && v <= 100;
  if(!isValidOdd(home) || !isValidOdd(draw) || !isValidOdd(away)) return null;
  return {h: home, d: draw, a: away};
}

function createMatchFromScraper(item){
  const home = String(item?.local || '').trim();
  const away = String(item?.visitante || '').trim();
  if(!home || !away) return null;
  const league = resolveScraperLeague(item);
  if(!league || !SCRAPER_LEAGUE_CONFIG[league]) return null;
  const matchDate = parseScraperMatchDate(item);
  const cfg = SCRAPER_LEAGUE_CONFIG[league];
  const verifiedOdds = getVerifiedOddsFromFlashscore(item);
  const odds = verifiedOdds || {h: null, d: null, a: null};

  let isLive = isMatchStillLive(item);
  const minuteRaw = String(item?.minute || item?.status || '').trim().toUpperCase();
  const score = String(item?.score || '').replace(':', '-').trim();

  const liveMinute = isLive ? (minuteRaw || 'EN VIVO') : null;
  const liveScore = score;

  return {
    id: generatePersistentId({home, away, league}),
    league,
    leagueName: cfg.leagueName,
    home,
    away,
    homeEmoji: cfg.homeEmoji,
    awayEmoji: cfg.awayEmoji,
    time: isLive ? (liveMinute || 'EN VIVO') : formatLiga1KickoffLabel(item, matchDate),
    odds,
    oddsVerified: Boolean(verifiedOdds),
    source: 'espn',
    live: isLive,
    score: liveScore,
    minute: isLive ? liveMinute : undefined,
    matchDateISO: Number.isFinite(matchDate?.getTime()) ? matchDate.toISOString() : '',
    scrapeTimestamp: item?.fecha_scrape || ''
  };
}

async function fetchFeedRows(){
  const ts = Date.now();
  let response = null;

  try{
    response = await fetch(`/api/partidos?ts=${ts}`, {cache:'no-store'});
  }catch(apiError){
    console.warn('No se pudo leer /api/partidos. Se intentará el fallback local.', apiError);
  }

  if(!response?.ok){
    response = await fetch(`./partidos.json?ts=${ts}`, {cache:'no-store'});
  }

  if(!response.ok) throw new Error(`feed_unavailable_${response.status}`);

  const data = await response.json();
  latestScrapedRows = Array.isArray(data) ? data : [];
  return latestScrapedRows;
}

function replaceScrapedLeagueMatches(scrapedRows){
  const rows = Array.isArray(scrapedRows) ? scrapedRows : [];
  const selectedRows = PRIORITY_LEAGUES.flatMap(league => {
    const leagueRows = rows.filter(row => resolveScraperLeague(row) === league);
    return keepTodayAndNextJornadaByGroup(leagueRows, league);
  });

  if(!selectedRows.length) return false;

  const matchesList = document.getElementById('matchesList');
  const liveMatchList = document.getElementById('liveMatchList');
  if(matchesList) matchesList.innerHTML = '';
  if(liveMatchList) liveMatchList.innerHTML = '';

  const newMatches = selectedRows
    .map(row => createMatchFromScraper(row))
    .filter(Boolean)
    .sort((a, b) => {
      if(a.live !== b.live) return a.live ? -1 : 1;
      const aTime = a.matchDateISO ? new Date(a.matchDateISO).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.matchDateISO ? new Date(b.matchDateISO).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  
  MATCHES.splice(0, MATCHES.length, ...newMatches);
  
  renderMatches(currentLeague);
  renderLive();
  buildTicker();
  
  const verifiedCount = newMatches.filter(m => m.oddsVerified).length;
  const pendingOddsCount = newMatches.length - verifiedCount;
  if(pendingOddsCount > 0){
    console.warn('Partidos visibles sin cuota verificada del feed:', pendingOddsCount);
  }
  console.log('Feed actualizado:', newMatches.length, 'cuotas verificadas:', verifiedCount, 'sin cuota:', pendingOddsCount, 'live:', newMatches.filter(m=>m.live).length);
  return true;
}

async function syncLeaguesFromFeed(notify = false){
  try{
    const data = await fetchFeedRows();
    const changed = replaceScrapedLeagueMatches(data);
    if(changed && notify) showToast('Ligas actualizadas desde el feed en vivo','success');
  }catch(error){
    console.warn('No se pudo actualizar ligas desde el feed.', error);
  }
}

function keepOnlyScraperLeaguesInMemory(){
  // Modo estricto: mostrar solo partidos que vienen del scraping (partidos.json).
  MATCHES.splice(0, MATCHES.length);
}

// Sistema de polling y detección de goles.
let previousScores = {};
let pollingIntervalId = null;
let pollingInFlight = false;

function getFlashscorePollIntervalMs(){
  const raw = Number(localStorage.getItem('rani_flashscore_poll_ms'));
  if(Number.isFinite(raw) && raw >= FEED_POLL_MIN_MS && raw <= FEED_POLL_MAX_MS){
    return raw;
  }
  return FEED_POLL_DEFAULT_MS;
}

function getAdaptivePollIntervalMs(){
  const hasLive = MATCHES.some(m => m.live);
  if(hasLive) return FEED_POLL_LIVE_MS;
  return getFlashscorePollIntervalMs();
}

function storeCurrentScores(){
  previousScores = {};
  MATCHES.forEach(m => {
    if(m.live && m.score) previousScores[m.id] = m.score;
  });
}

function parseScore(scoreStr){
  if(!scoreStr) return null;
  const match = String(scoreStr).match(/(\d+)-(\d+)/);
  if(!match) return null;
  return {home: parseInt(match[1], 10), away: parseInt(match[2], 10)};
}

function normalizeSettlementText(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function buildPickMatchKey(home, away){
  return `${normalizeSettlementText(home)}|${normalizeSettlementText(away)}`;
}

function tokenizeSettlementName(value){
  return normalizeSettlementText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 3);
}

function namesLookSimilar(a, b){
  const normA = normalizeSettlementText(a);
  const normB = normalizeSettlementText(b);
  if(!normA || !normB) return false;
  if(normA === normB) return true;
  if(normA.includes(normB) || normB.includes(normA)) return true;

  const tokensA = tokenizeSettlementName(a);
  const tokensB = tokenizeSettlementName(b);
  if(!tokensA.length || !tokensB.length) return false;

  const shared = tokensA.filter(token => tokensB.includes(token));
  return shared.length >= Math.min(2, tokensA.length, tokensB.length);
}

function parsePickTeams(matchLabel){
  const raw = String(matchLabel || '').trim();
  if(!raw) return null;
  const parts = raw.split(/\s+vs\s+/i).map(part => part.trim()).filter(Boolean);
  if(parts.length !== 2) return null;
  return {home: parts[0], away: parts[1]};
}

function buildFinishedMatchLookup(scrapedRows){
  const byId = new Map();
  const byTeams = new Map();
  const rows = [];

  (Array.isArray(scrapedRows) ? scrapedRows : []).forEach(row => {
    if(!isFinishedMatch(row)) return;

    const home = String(row?.local || '').trim();
    const away = String(row?.visitante || '').trim();
    const league = resolveScraperLeague(row);
    const score = parseScore(String(row?.score || '').replace(':', '-').trim());
    if(!home || !away || !score) return;

    const matchInfo = {home, away, league, score};
    rows.push(matchInfo);
    byTeams.set(buildPickMatchKey(home, away), matchInfo);

    if(league){
      byId.set(generatePersistentId({home, away, league}), matchInfo);
    }
  });

  return {byId, byTeams, rows};
}

function resolveSettledMatchForPick(pick, lookup){
  const matchId = String(pick?.matchId || '').trim();
  if(matchId && lookup.byId.has(matchId)) return lookup.byId.get(matchId);

  const parsedTeams = parsePickTeams(pick?.match);
  if(!parsedTeams) return null;

  const exact = lookup.byTeams.get(buildPickMatchKey(parsedTeams.home, parsedTeams.away));
  if(exact) return exact;

  const normalizedLeague = normalizeSettlementText(pick?.league);
  return (lookup.rows || []).find(row => {
    const leagueMatches = !normalizedLeague
      || normalizeSettlementText(row.league).includes(normalizedLeague)
      || normalizedLeague.includes(normalizeSettlementText(row.league));

    if(!leagueMatches) return false;

    return namesLookSimilar(parsedTeams.home, row.home) && namesLookSimilar(parsedTeams.away, row.away);
  }) || null;
}

function evaluatePickOutcome(pick, matchInfo){
  const pickType = String(pick?.type || '').trim().toLowerCase();
  const homeGoals = Number(matchInfo?.score?.home);
  const awayGoals = Number(matchInfo?.score?.away);
  if(!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return 'PENDING';

  if(pickType === 'h') return homeGoals > awayGoals ? 'WON' : 'LOST';
  if(pickType === 'd') return homeGoals === awayGoals ? 'WON' : 'LOST';
  if(pickType === 'a') return awayGoals > homeGoals ? 'WON' : 'LOST';
  return 'PENDING';
}

function resolveBetSettlementStatus(bet, lookup){
  const picks = Array.isArray(bet?.picks) ? bet.picks.map(normalizeStoredPick) : [];
  if(!picks.length) return 'PENDING';

  let resolvedCount = 0;
  for(const pick of picks){
    const matchInfo = resolveSettledMatchForPick(pick, lookup);
    if(!matchInfo) return 'PENDING';

    const outcome = evaluatePickOutcome(pick, matchInfo);
    if(outcome === 'LOST') return 'LOST';
    if(outcome === 'WON') {
      resolvedCount += 1;
      continue;
    }
    return 'PENDING';
  }

  return resolvedCount === picks.length ? 'WON' : 'PENDING';
}

function getBetEffectiveStatus(bet, scrapedRows = latestScrapedRows){
  if(!bet) return 'PENDING';
  if(bet.status === 'WON' || bet.status === 'LOST') return bet.status;
  if(!Array.isArray(scrapedRows) || !scrapedRows.length) return bet.status || 'PENDING';

  const lookup = buildFinishedMatchLookup(scrapedRows);
  const derivedStatus = resolveBetSettlementStatus(bet, lookup);
  return derivedStatus || bet.status || 'PENDING';
}

function buildRenderableBet(bet){
  return {
    ...bet,
    status: getBetEffectiveStatus(bet)
  };
}

function hasGoalHappened(prevScore, currentScore){
  if(!prevScore || !currentScore) return false;
  const prevTotal = prevScore.home + prevScore.away;
  const currTotal = currentScore.home + currentScore.away;
  return currTotal > prevTotal;
}

function updateMatchDOM(matchId, minute, score){
  const card = document.getElementById(`mc-${matchId}`);
  if(!card) return;
  
  const minEl = card.querySelector('.score-min');
  const scoreEl = card.querySelector('.score-live');
  const badgeEl = card.querySelector('.match-time-badge');
  const primaryTeamName = card.querySelector('.team-name')?.textContent || '';
  
  if(minEl) minEl.textContent = formatLiveStatusText(minute);
  if(scoreEl) scoreEl.textContent = score;
  if(badgeEl) badgeEl.textContent = formatLiveMinuteLabel(minute);
  
  const tickerItems = document.querySelectorAll('.ticker-item');
  tickerItems.forEach(item => {
    const teams = item.querySelector('.ticker-teams');
    const scoreBadge = item.querySelector('.ticker-score');
    if(teams && primaryTeamName && teams.textContent.includes(primaryTeamName)){
      if(scoreBadge) scoreBadge.textContent = score;
    }
  });
}

function detectedGoals(){
  const goals = [];
  MATCHES.forEach(m => {
    if(!m.live || !m.score) return;
    
    const prevScore = previousScores[m.id];
    const currScore = parseScore(m.score);
    
    if(prevScore && currScore && hasGoalHappened(parseScore(prevScore), currScore)){
      goals.push({
        matchId: m.id,
        match: `${m.home} vs ${m.away}`,
        prevScore,
        currentScore: m.score,
        minute: m.minute
      });
    }
  });
  
  return goals;
}

function triggerGoalAlert(goal){
  showToast(`¡Éxito! ¡Golazo! ${goal.match} (${goal.currentScore}) - MIN ${goal.minute}`, 'success');
  
  if('Notification' in window && Notification.permission === 'granted'){
    try{
      new Notification('RANIBET - ¡GOLAZO!', {
        body: `${goal.match}: ${goal.currentScore}`,
        icon: '🐸'
      });
    }catch(error){
      console.warn('No se pudo mostrar la notificación del gol.', error);
    }
  }
}

async function checkPendingBetsOutcomes(scrapedData) {
  if(!currentUser?.email) return;

  const hasPending = betsHistory.some(bet => bet.status === 'PENDING');
  const hasFinished = Array.isArray(scrapedData) && scrapedData.some(isFinishedMatch);
  if(!hasPending || !hasFinished) return;

  const lookup = buildFinishedMatchLookup(scrapedData);
  const pendingBets = betsHistory.filter(bet => bet.status === 'PENDING');
  const updates = [];

  pendingBets.forEach(bet => {
    const nextStatus = resolveBetSettlementStatus(bet, lookup);
    if(nextStatus !== 'PENDING'){
      updates.push({bet, nextStatus});
    }
  });

  if(!updates.length) return;

  let settledCount = 0;
  let localSettledCount = 0;
  let wonCount = 0;
  let lostCount = 0;

  for(const update of updates){
    update.bet.status = update.nextStatus;
    localSettledCount += 1;
    if(update.nextStatus === 'WON') wonCount += 1;
    if(update.nextStatus === 'LOST') lostCount += 1;

    try{
      const saved = await updateBetTicket(update.bet.id, {
        status: update.nextStatus,
        settledAt: new Date().toISOString()
      });

      if(saved){
        settledCount += 1;
      }
    }catch(error){
      console.warn(`No se pudo liquidar el ticket ${update.bet.id}.`, error);
    }
  }

  if(localSettledCount > 0){
    settlementWarningShown = false;
    if(settledCount > 0){
      await refreshBetHistoryUI();
      renderRanking();
    }else{
      renderHistory();
      renderWon();
    }
    const summaryParts = [];
    if(wonCount) summaryParts.push(`${wonCount} ganada${wonCount > 1 ? 's' : ''}`);
    if(lostCount) summaryParts.push(`${lostCount} perdida${lostCount > 1 ? 's' : ''}`);
    showToast(`Se actualizaron ${localSettledCount} ticket(s): ${summaryParts.join(', ')}`, 'success');
  }
}

async function pollMatchUpdates(){
  if(pollingInFlight) return;
  pollingInFlight = true;
  try{
    const data = await fetchFeedRows();
    
    // Se mantiene el aviso, pero la liquidación remota sigue desactivada.
    await checkPendingBetsOutcomes(data);
    
    const detectedGoalsList = detectedGoals();
    
    replaceScrapedLeagueMatches(data);
    
    detectedGoalsList.forEach(goal => {
      const match = MATCHES.find(m => m.id === goal.matchId);
      if(match){
        updateMatchDOM(match.id, match.minute, match.score);
        triggerGoalAlert(goal);
      }
    });
    
    storeCurrentScores();
    buildTicker();
    
    if(document.getElementById('page-live')?.classList.contains('active')){
      renderLive();
    }
  }catch(error){
    console.warn('Error en polling de goles:', error);
  }finally{
    pollingInFlight = false;
  }
}

window.RaniSupabase = {initSupabaseProfile, loadUserProfile, fetchGlobalRanking, fetchHistoricalRanking, fetchWeeklyRanking, fetchMonthlyRanking};
window.RaniScraping = {loadScrapedMatches, MATCHES};
window.RaniLogros = {renderRanking, renderWon, saveAchievement, userAchievements:[]};
window.RaniCoins = Object.freeze({addCoins, placeBet, redeemPromoCode});

keepOnlyScraperLeaguesInMemory();
buildTicker();
renderMatches('all');
renderTicket();
bindPromoCodeInput();
syncLeaguesFromFeed(false);
storeCurrentScores();

function startAdaptivePolling(){
  if(pollingIntervalId) clearInterval(pollingIntervalId);
  let currentMs = getAdaptivePollIntervalMs();
  pollingIntervalId = setInterval(async () => {
    await pollMatchUpdates();
    const nextMs = getAdaptivePollIntervalMs();
    if(nextMs !== currentMs){
      currentMs = nextMs;
      startAdaptivePolling();
      return;
    }
    console.log('Feed poll', currentMs, 'ms - partidos:', MATCHES.length, 'live:', MATCHES.filter(m=>m.live).length);
  }, currentMs);
}

startAdaptivePolling();
ensureClientErrorLogging();

document.addEventListener('visibilitychange', async () => {
  if(document.visibilityState === 'visible'){
    await pollMatchUpdates();
  }
});

window.addEventListener('focus', async () => {
  await pollMatchUpdates();
});

initSupabaseProfile().then(() => {
  renderTicket();
  renderHistory();
  renderWon();
});
