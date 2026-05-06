// RANIBET engine: RaniCoins, logros/ranking y datos para feed en vivo.
const SUPABASE_URL = 'https://gdntslyfogqzvzevcbnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y7mTO19Wp96L5QwHiEwWAg_2OH4RtEB';
const GOOGLE_CLIENT_ID = '6300462154-9uoaapb6jcbbe6semt477k2adv6s8f1p.apps.googleusercontent.com';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
let settlementWarningShown = false;

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
  throw new Error('server_settlement_required');
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
    const {data:{session}} = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
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

  const {data, error} = await supabaseClient.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential
  });

  if(error){
    console.warn('Error al iniciar sesión con Google en Supabase.', error);
    showToast('Activa Google Provider en Supabase Auth','error');
    return;
  }

  currentUser = data.user;
  await loadUserProfile();
  await loadUserAchievements();
  ensureUsernameGate();
  updateAuthUI();
  renderTicket();
  renderRanking();
  showToast('Sesión iniciada con Google ??','success');
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
  document.getElementById('balAmt').textContent = balance;

  if(checkDailyBonus && numericBalance > previousBalance){
    showToast('¡Rana puntual! ?? Has recibido tus 100 monedas del día','success');
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

  hint.textContent = 'Nombre Brutality listo para entrar al ranking ??';
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
  showToast('Username Brutality activado ????','success');
}

async function signOutUser(){
  if(supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  bootProfileLoaded = false;
  balance = 500;
  betsHistory = [...DEMO_HISTORY];
  document.getElementById('balAmt').textContent = balance;
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
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality ????','error');return;}
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
      showToast('¡OIGA OIGA! ?? Ya reclamaste este botín antes','error');
      return;
    }
    if(message.includes('promo_not_found') || message.includes('promo_inactive') || message.includes('invalid_code')){
      showToast('¡NO PUEEEE! ?? Ese código no existe','error');
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
  showToast('¡EXITO !GOLAZO! ??? Has ganado +100 Rani Coins','success');
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

function profileToHistoricalRow(profile, index){
  const profit = Number(profile.profit || profile.score || 0);
  const bets = Number(profile.bets || 0);
  const won = Number(profile.won || 0);
  const winRate = profile.win_rate ?? (bets ? won / bets * 100 : 0);

  return {
    pos:index + 1,
    name:profile.username || 'Brutality',
    bets,
    won,
    profit,
    bestOdd:Number(profile.best_odd || 0),
    winRate:Number(winRate),
    title:profile.title || '',
    score:profit,
    status:'Leyenda',
    coverageRate:0,
    riskRate:0,
    cleanRate:1
  };
}

async function fetchHistoricalRankingLegacy(){
  if(!supabaseClient) return null;

  const {data, error} = await supabaseClient
    .from('profiles')
    .select('email,username,coins,score,bets,won,profit,best_odd,win_rate,title')
    .not('username', 'is', null)
    .neq('username', '')
    .order('profit', {ascending:false})
    .order('won', {ascending:false})
    .limit(HISTORICAL_RANKING_LIMIT);

  if(error){
    console.warn('No se pudo cargar Ranking HistÃ³rico desde Supabase.', error);
    return null;
  }

  return (data || [])
    .map(profileToHistoricalRow)
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

async function fetchGlobalRanking(){
  return fetchHistoricalRanking();
}

function getRankingKey(email, username){
  return String(email || username || '').trim().toLowerCase();
}

function createWeeklyUserState(seed = {}){
  return {
    key: seed.key || '',
    name: seed.name || 'Brutality',
    title: seed.title || '',
    initialBankroll: Number(seed.initialBankroll || 0),
    totalStaked: 0,
    totalPayout: 0,
    matches: new Map()
  };
}

function getOrCreateWeeklyUser(map, key, seed = {}){
  if(!map.has(key)) map.set(key, createWeeklyUserState({key, ...seed}));
  const user = map.get(key);
  if(seed.name) user.name = seed.name;
  if(seed.title) user.title = seed.title;
  if(seed.initialBankroll && !user.initialBankroll) user.initialBankroll = Number(seed.initialBankroll);
  return user;
}

function buildWeeklyRankingRows(ticketRows = [], snapshotRows = [], profileRows = []){
  const rankingMap = new Map();
  const totalWeekMatches = Math.max(MATCHES.length, 1);

  snapshotRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    getOrCreateWeeklyUser(rankingMap, key, {
      name: row.username || 'Brutality',
      initialBankroll: Number(row.starting_coins || 0)
    });
  });

  profileRows.forEach(row => {
    const key = getRankingKey(row.email, row.username);
    if(!key) return;
    getOrCreateWeeklyUser(rankingMap, key, {
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

    const user = getOrCreateWeeklyUser(rankingMap, key, {name: row.username || 'Brutality'});
    const stakeShare = Number(row.stake || 0) / picks.length;
    const payoutShare = Number(row.payout || 0) / picks.length;

    picks.forEach(pick => {
      const matchKey = String(pick.matchId || pick.match || '').trim();
      if(!matchKey) return;

      if(!user.matches.has(matchKey)){
        user.matches.set(matchKey, {
          match: pick.match || `Partido ${matchKey}`,
          sides: new Set(),
          stake: 0,
          payout: 0,
          hasWon: false,
          hasLost: false,
          hasPending: false
        });
      }

      const matchSummary = user.matches.get(matchKey);
      if(pick.type) matchSummary.sides.add(pick.type);
      matchSummary.stake += stakeShare;
      matchSummary.payout += payoutShare;
      if(row.status === 'WON') matchSummary.hasWon = true;
      if(row.status === 'LOST') matchSummary.hasLost = true;
      if(row.status === 'PENDING') matchSummary.hasPending = true;

      user.totalStaked += stakeShare;
      user.totalPayout += payoutShare;
    });
  });

  const rows = Array.from(rankingMap.values()).map(user => {
    let won = 0;
    let lost = 0;
    let contaminated = 0;
    let pending = 0;
    let cleanResolved = 0;

    user.matches.forEach(match => {
      const contaminatedMatch = match.sides.size > 1 || (match.hasWon && match.hasLost);
      if(contaminatedMatch){
        contaminated++;
        if(match.hasWon || match.hasLost) cleanResolved += 0;
        return;
      }
      if(match.hasWon){
        won++;
        cleanResolved++;
        return;
      }
      if(match.hasLost){
        lost++;
        cleanResolved++;
        return;
      }
      pending++;
    });

    const played = user.matches.size;
    const resolved = won + lost + contaminated;
    const winRate = resolved ? won / resolved : 0;
    const coverageRate = played / totalWeekMatches;
    const baseBankroll = Math.max(Number(user.initialBankroll || 0), 1);
    const riskRateRaw = user.totalStaked / baseBankroll;
    const riskRate = clamp(riskRateRaw, 0, 1);
    const cleanRate = played ? (played - contaminated) / played : 1;
    const weeklyScore = (winRate * 50) + (riskRate * 25) + (coverageRate * 20) + (cleanRate * 5);
    const weeklyProfit = user.totalPayout - user.totalStaked;
    const official = resolved >= 3;

    return {
      pos: 0,
      name: user.name || 'Brutality',
      title: user.title || '',
      bets: played,
      won,
      lost,
      pending,
      contaminated,
      profit: Number(weeklyProfit.toFixed(2)),
      bestOdd: 0,
      winRate: Number((winRate * 100).toFixed(1)),
      riskRate: Number((riskRate * 100).toFixed(1)),
      coverageRate: Number((coverageRate * 100).toFixed(1)),
      cleanRate: Number((cleanRate * 100).toFixed(1)),
      score: Number(weeklyScore.toFixed(2)),
      status: official ? 'OFICIAL' : 'PROVISIONAL'
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

  return rows.slice(0, WEEKLY_RANKING_LIMIT).map((row, index) => ({...row, pos:index + 1}));
}

async function fetchWeeklyRankingLegacy(){
  if(!supabaseClient) return {rows: [], unavailable: true};

  const weekInfo = getCurrentWeekInfo();
  const [ticketsRes, snapshotsRes, profilesRes] = await Promise.all([
    supabaseClient
      .from('bet_tickets')
      .select('email,username,status,picks,stake,payout,created_at')
      .gte('created_at', weekInfo.start.toISOString())
      .lt('created_at', weekInfo.end.toISOString())
      .not('username', 'is', null)
      .neq('username', ''),
    supabaseClient
      .from('weekly_rank_snapshots')
      .select('email,username,starting_coins')
      .eq('week_id', weekInfo.id),
    supabaseClient
      .from('profiles')
      .select('email,username,coins,title')
      .not('username', 'is', null)
      .neq('username', '')
  ]);

  if(ticketsRes.error){
    console.warn('No se pudo cargar Ranking Semanal desde bet_tickets.', ticketsRes.error);
    return {rows: [], unavailable: true, weekInfo};
  }

  if(snapshotsRes.error) console.warn('No se pudo cargar weekly_rank_snapshots.', snapshotsRes.error);
  if(profilesRes.error) console.warn('No se pudo cargar perfiles de apoyo para ranking semanal.', profilesRes.error);

  return {
    rows: buildWeeklyRankingRows(ticketsRes.data || [], snapshotsRes.data || [], profilesRes.data || []),
    unavailable: false,
    weekInfo
  };
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

async function fetchWeeklyRanking(){
  const weekInfo = getCurrentWeekInfo();
  const result = await fetchPeriodRankingV2(weekInfo, 'weekly_rank_snapshots', 'week_id', WEEKLY_RANKING_LIMIT);
  return {rows: result.rows, unavailable: result.unavailable, weekInfo};
}

async function fetchMonthlyRanking(){
  const monthInfo = getCurrentMonthInfo();
  const result = await fetchPeriodRankingV2(monthInfo, 'monthly_rank_snapshots', 'month_id', MONTHLY_RANKING_LIMIT);
  return {rows: result.rows, unavailable: result.unavailable, monthInfo};
}

async function fetchHistoricalRanking(){
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
    console.warn('No se pudo cargar Ranking HistÃ³rico desde bet_tickets.', ticketsRes.error);
    return null;
  }
  if(profilesRes.error) console.warn('No se pudo cargar perfiles para ranking histÃ³rico.', profilesRes.error);

  return buildHistoricalRankingRowsV2(ticketsRes.data || [], profilesRes.data || []);
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
  document.getElementById('tickerInner').innerHTML = html;
}

function renderMatches(filter = 'all'){
  currentLeague = filter;
  const list = document.getElementById('matchesList');
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
    else{ticket[existing] = {matchId,type,league:match.leagueName,match:`${match.home} vs ${match.away}`,pick:pickLabels[type],odd};showToast('Selección cambiada ?');}
  }else{
    ticket.push({matchId,type,league:match.leagueName,match:`${match.home} vs ${match.away}`,pick:pickLabels[type],odd});
    showToast('¡Añadido al ticket! ??');
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
  document.getElementById('tttSingle').classList.toggle('active', type === 'simple');
  document.getElementById('tttCombo').classList.toggle('active', type === 'combinada');
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
  document.getElementById('ticketBadge').textContent = ticket.length;
  if(!ticket.length){
    body.innerHTML = `<div class="ticket-empty"><div class="ticket-empty-title">Ticket vacío</div><div class="ticket-empty-sub">Haz click en una cuota para añadir tu selección al ticket.</div></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = `<div class="ticket-items-wrap">${ticket.map((t,i) => `<div class="ticket-item"><button class="ticket-item-rm" onclick="removePick(${i})">?</button><div class="ticket-item-league">${escapeHtml(t.league)}</div><div class="ticket-item-match">${escapeHtml(t.match)}</div><div class="ticket-item-pick">${escapeHtml(t.pick)}</div><div class="ticket-item-odd-row"><span class="ticket-item-odd-label">Cuota</span><span class="ticket-item-odd-val">${safeNumber(t.odd).toFixed(2)}</span></div></div>`).join('')}</div>`;
  const total = getTotalOdd();
  const stakeVal = clamp(safeNumber(document.getElementById('stakeValInput')?.value, 10), 1, Math.max(1, safeNumber(balance, 1)));
  foot.innerHTML = `<div class="ticket-footer"><div class="tfoot-row"><span class="tfoot-label">SELECCIONES</span><span class="tfoot-val">${ticket.length}</span></div><div class="tfoot-row"><span class="tfoot-label">CUOTA TOTAL</span><span class="tfoot-val tfoot-odd">${total.toFixed(2)}</span></div><div class="stake-wrap"><div class="stake-lbl">MONTO A APOSTAR (R) <span onclick="stakeAll()">MAX</span></div><div class="stake-presets"><button class="preset-btn" onclick="setStake(5)">R5</button><button class="preset-btn" onclick="setStake(10)">R10</button><button class="preset-btn" onclick="setStake(25)">R25</button><button class="preset-btn" onclick="setStake(50)">R50</button></div><input type="number" class="stake-input" id="stakeValInput" value="${stakeVal}" min="1" max="${balance}" oninput="updatePotential()"></div><div class="potential-box"><span class="pot-label">Ganancia Potencial</span><span class="pot-val" id="potVal">R${(total * stakeVal).toFixed(2)}</span></div><button class="btn-clear-t" onclick="clearTicket()">Limpiar ticket</button><button class="btn-bet-main" onclick="placeBet()">APOSTAR AHORA</button></div>`;
}

function setStake(v){document.getElementById('stakeValInput').value = v;updatePotential();}
function stakeAll(){document.getElementById('stakeValInput').value = balance;updatePotential();}
function updatePotential(){const total = getTotalOdd();const stake = safeNumber(document.getElementById('stakeValInput')?.value, 0);const el = document.getElementById('potVal');if(el) el.textContent = `R${(total * stake).toFixed(2)}`;}
function removePick(i){ticket.splice(i,1);updateOddBtnStates();renderTicket();}
function clearTicket(){ticket = [];updateOddBtnStates();renderTicket();showToast('Ticket limpiado ??');}

async function placeBet(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para guardar tus RaniCoins','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality ????','error');return;}
  if(!ticket.length){showToast('¡Añade picks al ticket!','error');return;}
  const stake = safeNumber(document.getElementById('stakeValInput')?.value, 0);
  if(!Number.isFinite(stake) || stake < 1){showToast('Mínimo R1 para apostar','error');return;}
  if(stake > balance){showToast('No tienes suficientes RaniCoins ??','error');return;}
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
  document.getElementById('mTicketId').textContent = ticketRow.id;
  document.getElementById('mPicks').textContent = ticket.length;
  document.getElementById('mBetDetails').innerHTML = ticketRow.picks
    .map(p => `<div class="modal-pick-item">${escapeHtml(p.match)} <strong>→ ${escapeHtml(p.pick)}</strong></div>`)
    .join('');
  document.getElementById('mOdd').textContent = totalOdd.toFixed(2);
  document.getElementById('mStake').textContent = 'R' + stake;
  document.getElementById('mPotential').textContent = 'R' + payout.toFixed(2);
  document.getElementById('ticketModal').classList.add('open');
  ticket = [];
  updateOddBtnStates();
  renderTicket();
  await refreshBetHistoryUI();
}

function closeModal(){document.getElementById('ticketModal').classList.remove('open');}
async function addCoins(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para recargar RaniCoins','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality ????','error');return;}
  showToast('Recargas pausadas temporalmente. No se agregó crédito.','info');
}

function renderHistory(filter = null){
  const list = document.getElementById('historyList');
  if(!list) return;
  const data = filter ? betsHistory.filter(b => b.status === filter) : betsHistory;
  const won = betsHistory.filter(b => b.status === 'WON');
  const settled = betsHistory.filter(b => b.status !== 'PENDING');
  const profit = betsHistory.reduce((a,b) => b.status === 'WON' ? a + (b.payout - b.stake) : b.status === 'LOST' ? a - b.stake : a, 0);
  const rate = settled.length ? Math.round(won.length / settled.length * 100) : 0;
  document.getElementById('statTotal').textContent = betsHistory.length;
  document.getElementById('statWon').textContent = won.length;
  document.getElementById('statRate').textContent = rate + '%';
  document.getElementById('statProfit').textContent = 'R' + profit.toFixed(0);
  if(!data.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">?? No hay apuestas en esta categoría</div>';return;}
  list.innerHTML = data.map(b => historyCardHTML(b)).join('');
}

function renderWon(){
  const won = betsHistory.filter(b => b.status === 'WON');
  const total = won.reduce((a,b) => a + b.payout, 0);
  const best = won.length ? Math.max(...won.map(b => b.totalOdd)) : 0;
  let streak = 0;
  for(let i = 0; i < betsHistory.length; i++){if(betsHistory[i].status === 'WON') streak++; else break;}
  document.getElementById('wonCount').textContent = won.length;
  document.getElementById('wonCoins').textContent = 'R' + total.toFixed(0);
  document.getElementById('wonBestOdd').textContent = best > 0 ? best.toFixed(2) : '-';
  document.getElementById('wonStreak').textContent = streak;
  const list = document.getElementById('wonList');
  if(!won.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">?? Aún no tienes apuestas ganadas</div>';return;}
  list.innerHTML = won.map(b => historyCardHTML(b)).join('');
}

function historyCardHTML(b){
  const status = ['WON', 'LOST', 'PENDING'].includes(b.status) ? b.status : 'PENDING';
  const bClass = {WON:'badge-won',LOST:'badge-lost',PENDING:'badge-pending'}[status];
  const bLabel = {WON:'? GANADA',LOST:'? PERDIDA',PENDING:'? PENDIENTE'}[status];
  const payColor = status === 'WON' ? 'hf-won' : status === 'LOST' ? 'hf-lost' : '';
  const payout = safeNumber(b.payout);
  const payVal = status === 'WON' ? 'R' + payout.toFixed(2) : status === 'LOST' ? '-' : 'R' + payout.toFixed(2) + '*';
  const picks = Array.isArray(b.picks) ? b.picks : [];
  return `<div class="h-card"><div class="h-card-head"><div><div class="h-card-id">${escapeHtml(b.id)}</div><div class="h-card-date">${escapeHtml(b.date)}</div></div><div class="badge ${bClass}">${bLabel}</div></div><div class="h-picks">${picks.map(p => `<div class="h-pick"><div class="h-pick-info"><div class="h-pick-match">${escapeHtml(p.match)}</div><div class="h-pick-sel">${escapeHtml(p.pick)}</div></div><div class="h-pick-odd">${safeNumber(p.odd).toFixed(2)}</div></div>`).join('')}</div><div class="h-fin"><div class="hf"><div class="hf-lbl">Cuota</div><div class="hf-val">${safeNumber(b.totalOdd).toFixed(2)}</div></div><div class="hf"><div class="hf-lbl">Apostado</div><div class="hf-val">R${safeNumber(b.stake).toFixed(2)}</div></div><div class="hf"><div class="hf-lbl">${status === 'WON' ? 'Cobrado' : status === 'PENDING' ? 'Potencial' : 'Perdido'}</div><div class="hf-val ${payColor}">${payVal}</div></div></div></div>`;
}

async function renderRankingLegacy(){
  const list = document.getElementById('rankList');
  const rankingRows = await fetchGlobalRanking() || [];
  if(!rankingRows.length){
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">?? Aún no hay usuarios en el ranking global</div>';
    document.getElementById('rlTotal').textContent = '0';
    document.getElementById('rlAvgRate').textContent = '0%';
    document.getElementById('rlTopProfit').textContent = 'R0';
    return;
  }
  const avgRate = Math.round(rankingRows.reduce((a,r) => a + safeNumber(r.winRate), 0) / rankingRows.length);
  const topProfit = Math.max(...rankingRows.map(r => safeNumber(r.profit)));
  document.getElementById('rlTotal').textContent = rankingRows.length;
  document.getElementById('rlAvgRate').textContent = avgRate + '%';
  document.getElementById('rlTopProfit').textContent = 'R' + topProfit;
  const medals = {1:'\uD83E\uDD47',2:'\uD83E\uDD48',3:'\uD83E\uDD49'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};
  list.innerHTML = rankingRows.map(r => {
    const pos = safeNumber(r.pos);
    const winRate = clamp(safeNumber(r.winRate), 0, 100);
    return `<div class="rank-card ${cardClass[pos] || ''}"><div class="rank-pos ${posClass[pos] || 'pn'}">${pos <= 3 ? medals[pos] : pos}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${escapeHtml(r.name)}</div>${r.title ? `<span class="rank-frog-tag">\uD83D\uDC38 ${escapeHtml(r.title)}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${safeNumber(r.bets)}</div><div class="rs-lbl">Picks</div></div><div class="rank-stat"><div class="rs-val">${safeNumber(r.won)}</div><div class="rs-lbl">Won</div></div><div class="rank-stat"><div class="rs-val">${winRate.toFixed(0)}%</div><div class="rs-lbl">Rate</div></div><div class="rank-stat"><div class="rs-val">${safeNumber(r.bestOdd).toFixed(2)}</div><div class="rs-lbl">Best</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${winRate}%"></div></div></div><div class="rank-profit"><div class="rp-val">R${safeNumber(r.profit)}</div><div class="rp-lbl">Puntaje</div></div></div>`;
  }).join('');
}

function setRankingTab(tab, el){
  rankingTab = tab === 'historical' ? 'historical' : tab === 'monthly' ? 'monthly' : 'weekly';
  document.querySelectorAll('.rank-tab').forEach(button => button.classList.remove('active'));
  if(el) el.classList.add('active');
  renderRanking();
}

function renderRankingEmptyState(message){
  const list = document.getElementById('rankList');
  document.getElementById('rlTotal').textContent = '0';
  document.getElementById('rlAvgRate').textContent = '0%';
  document.getElementById('rlTopProfit').textContent = 'R0';
  list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">${escapeHtml(message)}</div>`;
}

function renderWeeklyRankCards(rows){
  const medals = {1:'\uD83E\uDD47',2:'\uD83E\uDD48',3:'\uD83E\uDD49'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};

  return rows.map(r => {
    const statusClass = r.status === 'OFICIAL' ? '' : ' provisional';
    const duplicateTag = r.contaminated > 0 ? `<span class="rank-status-tag clean-warning">${r.contaminated} duplicado${r.contaminated > 1 ? 's' : ''}</span>` : '';
    return `<div class="rank-card ${cardClass[r.pos] || ''}"><div class="rank-pos ${posClass[r.pos] || 'pn'}">${r.pos <= 3 ? medals[r.pos] : r.pos}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${escapeHtml(r.name)}</div><span class="rank-status-tag${statusClass}">${r.status}</span>${duplicateTag}${r.title ? `<span class="rank-frog-tag">\uD83D\uDC38 ${escapeHtml(r.title)}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${r.won}/${r.bets}</div><div class="rs-lbl">Partidos</div></div><div class="rank-stat"><div class="rs-val">${r.winRate.toFixed(0)}%</div><div class="rs-lbl">Acierto</div></div><div class="rank-stat"><div class="rs-val">${r.riskRate.toFixed(0)}%</div><div class="rs-lbl">Riesgo</div></div><div class="rank-stat"><div class="rs-val">${r.coverageRate.toFixed(0)}%</div><div class="rs-lbl">Cobertura</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${clamp(r.score, 0, 100)}%"></div></div></div><div class="rank-profit"><div class="rp-val">${r.score.toFixed(1)}</div><div class="rp-lbl">Score</div><div class="rp-lbl" style="margin-top:6px">R${r.profit.toFixed(0)}</div></div></div>`;
  }).join('');
}

function renderHistoricalRankCards(rows){
  const medals = {1:'\uD83E\uDD47',2:'\uD83E\uDD48',3:'\uD83E\uDD49'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};

  return rows.map(r => `<div class="rank-card ${cardClass[r.pos] || ''}"><div class="rank-pos ${posClass[r.pos] || 'pn'}">${r.pos <= 3 ? medals[r.pos] : r.pos}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${escapeHtml(r.name)}</div>${r.title ? `<span class="rank-frog-tag">\uD83D\uDC38 ${escapeHtml(r.title)}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${r.bets}</div><div class="rs-lbl">Tickets</div></div><div class="rank-stat"><div class="rs-val">${r.won}</div><div class="rs-lbl">Ganadas</div></div><div class="rank-stat"><div class="rs-val">${r.winRate.toFixed(0)}%</div><div class="rs-lbl">Acierto</div></div><div class="rank-stat"><div class="rs-val">${r.bestOdd.toFixed(2)}</div><div class="rs-lbl">Best</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${clamp(r.winRate, 0, 100)}%"></div></div></div><div class="rank-profit"><div class="rp-val">R${r.profit.toFixed(0)}</div><div class="rp-lbl">Profit</div></div></div>`).join('');
}

async function renderRanking(){
  const list = document.getElementById('rankList');
  const weekInfo = getCurrentWeekInfo();
  const monthInfo = getCurrentMonthInfo();
  document.getElementById('rankTabWeekly')?.classList.toggle('active', rankingTab === 'weekly');
  document.getElementById('rankTabMonthly')?.classList.toggle('active', rankingTab === 'monthly');
  document.getElementById('rankTabHistorical')?.classList.toggle('active', rankingTab === 'historical');
  document.getElementById('rankingRange').textContent = rankingTab === 'weekly'
    ? `Semana del ${weekInfo.label}`
    : rankingTab === 'monthly'
      ? `Mes actual: ${monthInfo.rangeLabel}`
      : 'Trayectoria total de la comunidad';
  document.getElementById('rankingWeekBadge').textContent = rankingTab === 'weekly' ? `SEMANA ${weekInfo.weekNumber}` : 'HISTÓRICO';
  document.getElementById('rankingTitle').textContent = rankingTab === 'weekly' ? '🐸 RANKING TIPSTER SEMANAL' : '🐸 RANKING TIPSTER HISTÓRICO';

  if(rankingTab === 'monthly'){
    document.getElementById('rankingWeekBadge').textContent = monthInfo.label.toUpperCase();
    document.getElementById('rankingTitle').textContent = 'RANKING TIPSTER MENSUAL';
  }else if(rankingTab === 'historical'){
    document.getElementById('rankingWeekBadge').textContent = 'HISTORICO';
    document.getElementById('rankingTitle').textContent = 'RANKING TIPSTER HISTORICO';
  }else{
    document.getElementById('rankingTitle').textContent = 'RANKING TIPSTER SEMANAL';
  }

  if(rankingTab === 'historical'){
    const rankingRows = await fetchHistoricalRanking() || [];
    if(!rankingRows.length){
      renderRankingEmptyState('Aún no hay usuarios en el ranking histórico');
      return;
    }
    const avgRate = Math.round(rankingRows.reduce((acc, row) => acc + row.winRate, 0) / rankingRows.length);
    const topProfit = Math.max(...rankingRows.map(row => row.profit));
    document.getElementById('rlTotal').textContent = rankingRows.length;
    document.getElementById('rlTotalLabel').textContent = `Leyendas Top ${HISTORICAL_RANKING_LIMIT}`;
    document.getElementById('rlAvgRate').textContent = `${avgRate}%`;
    document.getElementById('rlAvgRateLabel').textContent = '% Acierto Hist.';
    document.getElementById('rlTopProfit').textContent = `R${topProfit.toFixed(0)}`;
    document.getElementById('rlTopProfitLabel').textContent = 'Profit Total';
    list.innerHTML = renderHistoricalRankCards(rankingRows);
    return;
  }

  if(rankingTab === 'monthly'){
    const monthlyResult = await fetchMonthlyRanking();
    if(monthlyResult.unavailable){
      renderRankingEmptyState('El ranking mensual necesita lectura publica de tickets y snapshots mensuales en Supabase.');
      return;
    }

    const rankingRows = monthlyResult.rows || [];
    if(!rankingRows.length){
      renderRankingEmptyState('Aun no hay apuestas suficientes para el ranking mensual');
      return;
    }

    const avgRate = Math.round(rankingRows.reduce((acc, row) => acc + row.winRate, 0) / rankingRows.length);
    const topScore = Math.max(...rankingRows.map(row => row.score));
    document.getElementById('rlTotal').textContent = rankingRows.length;
    document.getElementById('rlTotalLabel').textContent = `Mensual Top ${MONTHLY_RANKING_LIMIT}`;
    document.getElementById('rlAvgRate').textContent = `${avgRate}%`;
    document.getElementById('rlAvgRateLabel').textContent = '% Acierto Mes';
    document.getElementById('rlTopProfit').textContent = topScore.toFixed(1);
    document.getElementById('rlTopProfitLabel').textContent = 'Mejor Score';
    list.innerHTML = renderWeeklyRankCards(rankingRows);
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
  document.getElementById('rlTotal').textContent = rankingRows.length;
  document.getElementById('rlTotalLabel').textContent = `Top ${WEEKLY_RANKING_LIMIT}`;
  document.getElementById('rlAvgRate').textContent = `${avgRate}%`;
  document.getElementById('rlAvgRateLabel').textContent = '% Acierto Sem.';
  document.getElementById('rlTopProfit').textContent = topScore.toFixed(1);
  document.getElementById('rlTopProfitLabel').textContent = 'Mejor Score';
  list.innerHTML = renderWeeklyRankCards(rankingRows);
}

function renderLive(){
  const live = MATCHES.filter(m => m.live);
  const el = document.getElementById('liveMatchList');
  if(!live.length){el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">?? No hay partidos en vivo ahora</div>';return;}
  el.innerHTML = live.map(m => matchCardHTML(m)).join('');
  updateOddBtnStates();
}

function showPage(pg,el){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.hc-pill').forEach(p => p.classList.remove('active-pg'));
  document.getElementById('page-' + pg).classList.add('active');
  if(el) el.classList.add('active-pg');
  document.getElementById('subNav').style.display = pg === 'sports' || pg === 'live' ? 'flex' : 'none';
  if(pg === 'history') renderHistory();
  if(pg === 'won') renderWon();
  if(pg === 'ranking') renderRanking();
  if(pg === 'live') renderLive();
  if(pg === 'sports') renderMatches(currentLeague);
}

function filterLeague(league,el){document.querySelectorAll('.snav-item').forEach(s => s.classList.remove('active'));el.classList.add('active');renderMatches(league);}
function filterHistory(status,el){document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));el.classList.add('active');renderHistory(status);}

function showToast(msg,type = 'success'){
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => {t.classList.remove('show');setTimeout(() => t.remove(),350);},2600);
}

function findMatchByTeams(homeName, awayName){
  return MATCHES.find(m => m.home === homeName && m.away === awayName)
    || MATCHES.find(m => homeName.includes(m.home) && awayName.includes(m.away))
    || MATCHES.find(m => m.home.includes(homeName) && m.away.includes(awayName))
    || null;
}

function loadScrapedMatches(scrapedMatches){
  if(!Array.isArray(scrapedMatches)){showToast('El scraper debe devolver un array de partidos','error');return;}
  if(replaceScrapedLeagueMatches(scrapedMatches)) showToast('Partidos actualizados desde scraping ??','success');
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

function createMatchFromScraper(item, idx, nextId){
  const home = String(item?.local || '').trim();
  const away = String(item?.visitante || '').trim();
  if(!home || !away) return null;
  const league = resolveScraperLeague(item);
  if(!league || !SCRAPER_LEAGUE_CONFIG[league]) return null;
  const matchDate = parseScraperMatchDate(item);
  const cfg = SCRAPER_LEAGUE_CONFIG[league];
  const verifiedOdds = getVerifiedOddsFromFlashscore(item);
  const odds = verifiedOdds || {h: null, d: null, a: null};
  
// ?? LOGICA EN VIVO REAL (FIX crítico)
  let isLive = isMatchStillLive(item);
  const minuteRaw = String(item?.minute || item?.status || '').trim().toUpperCase();
  const score = String(item?.score || '').replace(':', '-').trim();

  const liveMinute = isLive ? (minuteRaw || 'EN VIVO') : null;
  const liveScore = score;

  return {
    id: generatePersistentId({home, away, league}), // ?? ID FIJO
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

function replaceScrapedLeagueMatches(scrapedRows){
  document.getElementById('matchesList').innerHTML = '';
  document.getElementById('liveMatchList').innerHTML = '';
  
  const rows = Array.isArray(scrapedRows) ? scrapedRows : [];
  const selectedRows = PRIORITY_LEAGUES.flatMap(league => {
    const leagueRows = rows.filter(row => resolveScraperLeague(row) === league);
    return keepTodayAndNextJornadaByGroup(leagueRows, league);
  });

  if(!selectedRows.length) return false;

  const newMatches = selectedRows
    .map(row => createMatchFromScraper(row, 0, 0))
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

function isUpcomingMatch(match) {
  const now = new Date();
  const matchTime = new Date(match.time || now);
  return (matchTime - now) < 48 * 60 * 60 * 1000; // Próximos 48h
}

async function syncLeaguesFromFeed(notify = false){
  try{
    let response = await fetch(`/api/partidos?ts=${Date.now()}`, {cache:'no-store'});
    if(!response.ok){
      response = await fetch(`./partidos.json?ts=${Date.now()}`, {cache:'no-store'});
    }
    if(!response.ok) return;
    const data = await response.json();
    const changed = replaceScrapedLeagueMatches(data);
    if(changed && notify) showToast('Ligas actualizadas desde feed en vivo','success');
  }catch(error){
    console.warn('No se pudo actualizar ligas desde partidos.json', error);
  }
}

function keepOnlyScraperLeaguesInMemory(){
  // Modo estricto: mostrar solo partidos que vienen del scraping (partidos.json).
  MATCHES.splice(0, MATCHES.length);
}

// ?? SISTEMA DE POLLING Y DETECCIÓN DE GOLES (MEJORADO)
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
  
  if(minEl) minEl.textContent = formatLiveStatusText(minute);
  if(scoreEl) scoreEl.textContent = score;
  if(badgeEl) badgeEl.textContent = formatLiveMinuteLabel(minute);
  
  const tickerItems = document.querySelectorAll('.ticker-item');
  tickerItems.forEach(item => {
    const teams = item.querySelector('.ticker-teams');
    const scoreBadge = item.querySelector('.ticker-score');
    if(teams && teams.textContent.includes(document.querySelector(`#mc-${matchId} .team-name`)?.textContent || '')){
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
  showToast(`? ¡EXITO !GOLAZO! ??? ${goal.match} (${goal.currentScore}) - MIN ${goal.minute}`, 'success');
  
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification('?? RANIBET - ¡GOLAZO!', {
      body: `${goal.match}: ${goal.currentScore}`,
      icon: '??'
    });
  }
}

async function checkPendingBetsOutcomes(scrapedData) {
  if(!currentUser?.email) return;

  const hasPending = betsHistory.some(bet => bet.status === 'PENDING');
  const hasFinished = Array.isArray(scrapedData) && scrapedData.some(isFinishedMatch);
  if(hasPending && hasFinished && !settlementWarningShown){
    settlementWarningShown = true;
    console.info('Auto-settlement remoto desactivado por seguridad. Liquida tickets desde un proceso de servidor confiable.');
  }
}

async function pollMatchUpdates(){
  if(pollingInFlight) return;
  pollingInFlight = true;
  try{
    let response = await fetch(`/api/partidos?ts=${Date.now()}`, {cache:'no-store'});
    if(!response.ok){
      response = await fetch(`./partidos.json?ts=${Date.now()}`, {cache:'no-store'});
    }
    if(!response.ok) return;
    const data = await response.json();
    
    // ?? NUEVO: AUTO-SETTLEMENT antes de actualizar partidos
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

