// RANIBET engine: RaniCoins, logros/ranking y datos para scraping Flashscore.
const SUPABASE_URL = 'https://gdntslyfogqzvzevcbnl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y7mTO19Wp96L5QwHiEwWAg_2OH4RtEB';
const GOOGLE_CLIENT_ID = '6300462154-9uoaapb6jcbbe6semt477k2adv6s8f1p.apps.googleusercontent.com';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CURRENT_DATE_LABEL = '01 May 2026';

let currentUser = null;
let currentProfile = null;
let usernameReady = false;
let bootProfileLoaded = false;

const MATCHES = [
  {id:1,league:'liga1',leagueName:'Liga 1 Betsson',home:'Alianza Lima',away:'Universitario',homeEmoji:'⚪',awayEmoji:'🔴',time:'Sab 18:00',odds:{h:2.10,d:3.20,a:3.80},live:true,score:'2-1',minute:'73'},
  {id:2,league:'liga1',leagueName:'Liga 1 Betsson',home:'Sporting Cristal',away:'San Martín',homeEmoji:'🔵',awayEmoji:'🟤',time:'Sab 15:30',odds:{h:1.85,d:3.50,a:4.20},live:true,score:'0-0',minute:'45+2'},
  {id:3,league:'liga1',leagueName:'Liga 1 Betsson',home:'Cienciano',away:'FBC Melgar',homeEmoji:'🔴',awayEmoji:'⚫',time:'Dom 16:00',odds:{h:2.40,d:3.10,a:2.90}},
  {id:4,league:'liga1',leagueName:'Liga 1 Betsson',home:'ADT',away:'César Vallejo',homeEmoji:'🟡',awayEmoji:'🟡',time:'Dom 20:00',odds:{h:3.10,d:3.00,a:2.20}},
  {id:5,league:'copa',leagueName:'Copa Perú',home:'Garcilaso',away:'Alfonso Ugarte',homeEmoji:'🟤',awayEmoji:'🟢',time:'Vie 15:00',odds:{h:1.95,d:3.30,a:3.70}},
  {id:6,league:'copa',leagueName:'Copa Perú',home:'Los Caimanes',away:'Juan Aurich',homeEmoji:'🟢',awayEmoji:'🟡',time:'Sab 13:00',odds:{h:2.60,d:3.20,a:2.50}},
  {id:7,league:'champions',leagueName:'UEFA Champions League',home:'Real Madrid',away:'Man. City',homeEmoji:'⚪',awayEmoji:'🔵',time:'Mar 21:00',odds:{h:2.30,d:3.40,a:3.10},live:true,score:'3-1',minute:'88'},
  {id:8,league:'champions',leagueName:'UEFA Champions League',home:'Bayern Munich',away:'Arsenal',homeEmoji:'🔴',awayEmoji:'🔴',time:'Mié 21:00',odds:{h:1.70,d:3.80,a:5.00}},
  {id:9,league:'champions',leagueName:'UEFA Champions League',home:'Barcelona',away:'Inter Milán',homeEmoji:'🔵',awayEmoji:'⚫',time:'Mar 21:00',odds:{h:2.05,d:3.50,a:3.60}},
  {id:10,league:'laliga',leagueName:'La Liga EA Sports',home:'Atl. Madrid',away:'Sevilla',homeEmoji:'🔴',awayEmoji:'⚪',time:'Dom 16:15',odds:{h:1.65,d:3.80,a:5.50}},
  {id:11,league:'laliga',leagueName:'La Liga EA Sports',home:'Real Betis',away:'Valencia',homeEmoji:'🟢',awayEmoji:'🟠',time:'Sab 20:45',odds:{h:2.20,d:3.30,a:3.20}},
  {id:12,league:'premier',leagueName:'Premier League',home:'Liverpool',away:'Chelsea',homeEmoji:'🔴',awayEmoji:'🔵',time:'Dom 17:30',odds:{h:1.80,d:3.60,a:4.50}},
  {id:13,league:'premier',leagueName:'Premier League',home:'Man. United',away:'Tottenham',homeEmoji:'🔴',awayEmoji:'⚪',time:'Sab 12:30',odds:{h:2.50,d:3.20,a:2.80}},
  {id:14,league:'libertadores',leagueName:'Copa Libertadores',home:'Flamengo',away:'River Plate',homeEmoji:'🔴',awayEmoji:'⚪',time:'Jue 21:30',odds:{h:2.00,d:3.40,a:3.50}},
  {id:15,league:'libertadores',leagueName:'Copa Libertadores',home:'Boca Juniors',away:'Nacional',homeEmoji:'🔵',awayEmoji:'⚪',time:'Mié 21:00',odds:{h:1.90,d:3.50,a:4.00}}
];

const DEMO_HISTORY = [
  {id:'RNB-28471',date:'01 May 2026',user:'Brutality',status:'WON',picks:[{match:'Alianza vs Universitario',pick:'Alianza Lima gana',odd:2.10,league:'Liga 1'},{match:'Real Madrid vs City',pick:'Real Madrid gana',odd:2.30,league:'Champions'}],totalOdd:4.83,stake:20,payout:96.60},
  {id:'RNB-28330',date:'30 Abr 2026',user:'Brutality',status:'LOST',picks:[{match:'Cristal vs San Martín',pick:'Empate',odd:3.50,league:'Liga 1'}],totalOdd:3.50,stake:10,payout:0},
  {id:'RNB-28201',date:'29 Abr 2026',user:'Brutality',status:'PENDING',picks:[{match:'Barcelona vs Inter',pick:'Barcelona gana',odd:2.05,league:'Champions'},{match:'ADT vs Vallejo',pick:'Vallejo gana',odd:2.20,league:'Liga 1'}],totalOdd:4.51,stake:15,payout:0},
  {id:'RNB-28044',date:'28 Abr 2026',user:'Brutality',status:'WON',picks:[{match:'Bayern vs Arsenal',pick:'Bayern gana',odd:1.70,league:'Champions'}],totalOdd:1.70,stake:50,payout:85.00},
  {id:'RNB-27800',date:'27 Abr 2026',user:'Brutality',status:'WON',picks:[{match:'Melgar vs Cienciano',pick:'Melgar gana',odd:1.90,league:'Liga 1'}],totalOdd:1.90,stake:30,payout:57.00}
];

let ticket = [];
let betType = 'combinada';
let balance = 500;
let betsHistory = [...DEMO_HISTORY];
let currentLeague = 'all';
const LIGA1_AUTO_REFRESH_MS = 60000;

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
  showToast('Sesión iniciada con Google 🐸','success');
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
    showToast('¡Rana puntual! 🐸 Has recibido tus 100 monedas del día','success');
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

  hint.textContent = 'Nombre Brutality listo para entrar al ranking 🔥';
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

  const {data, error} = await supabaseClient
    .from('profiles')
    .update({
      username,
      updated_at: new Date().toISOString()
    })
    .eq('email', currentUser.email)
    .select('id,user_id,email,username,handle,avatar,photo_url,coins,score,bets,won,profit,best_odd,win_rate,title')
    .single();

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
  showToast('Username Brutality activado 💀🔥','success');
}

async function signOutUser(){
  if(supabaseClient) await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  bootProfileLoaded = false;
  balance = 500;
  document.getElementById('balAmt').textContent = balance;
  updateAuthUI();
  renderTicket();
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
    userAvatar.innerHTML = photo ? `<img src="${photo}" alt="">` : '🐸';
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

  const {data, error} = await supabaseClient
    .from('profiles')
    .select('id,user_id,email,username,handle,avatar,photo_url,coins,score,bets,won,profit,best_odd,win_rate,title')
    .eq('email', currentUser.email)
    .maybeSingle();

  if(error) throw error;

  if(data){
    const {data:updated, error:updateError} = await supabaseClient
      .from('profiles')
      .update({
        user_id: currentUser.id,
        handle: data.handle || googleHandle,
        avatar: googlePhoto || data.avatar || '🐸',
        photo_url: googlePhoto || data.photo_url,
        updated_at: new Date().toISOString()
      })
      .eq('email', currentUser.email)
      .select('id,user_id,email,username,handle,avatar,photo_url,coins,score,bets,won,profit,best_odd,win_rate,title')
      .single();

    if(updateError) throw updateError;
    currentProfile = updated;
    updateBalanceDisplay(updated.coins ?? balance, true);
    updateAuthUI();
    return;
  }

  currentProfile = {
    user_id: currentUser.id,
    email: currentUser.email,
    username: '',
    handle: googleHandle,
    avatar: googlePhoto || '🐸',
    photo_url: googlePhoto,
    coins: balance,
    score: 0,
    bets: 0,
    won: 0,
    profit: 0,
    best_odd: 0,
    win_rate: 0,
    title: 'Nueva Rana'
  };

  const {data:created, error:createError} = await supabaseClient
    .from('profiles')
    .insert(currentProfile)
    .select('id,user_id,email,username,handle,avatar,photo_url,coins,score,bets,won,profit,best_odd,win_rate,title')
    .single();

  if(createError) throw createError;
  currentProfile = created;
  updateBalanceDisplay(created.coins ?? balance, false);
  updateAuthUI();
}

async function saveUserProfile(patch = {}){
  if(!supabaseClient || !currentUser?.email) return;

  const payload = {
    user_id: currentUser.id,
    email: currentUser.email,
    coins: balance,
    updated_at: new Date().toISOString(),
    ...patch
  };

  const {data, error} = await supabaseClient
    .from('profiles')
    .upsert(payload, {onConflict:'email'})
    .select('id,user_id,email,username,handle,avatar,photo_url,coins,score,bets,won,profit,best_odd,win_rate,title')
    .single();

  if(error){
    console.warn('No se pudo guardar el perfil en Supabase.', error);
    return;
  }

  currentProfile = data;
  updateBalanceDisplay(data.coins ?? balance, false);
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
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality 💀🔥','error');return;}
  normalizePromoCodeInput();

  const input = document.getElementById('promoCodeInput');
  const code = input?.value.trim().toUpperCase();
  if(!code){showToast('Escribe un código Brutality primero','error');return;}

  const {data:promo, error:promoError} = await supabaseClient
    .from('promo_codes')
    .select('code')
    .eq('code', code)
    .maybeSingle();

  if(promoError){
    console.warn('Error consultando promo_codes.', promoError);
    showToast('¡NO PUEEEE! 🚩 Ese código no existe','error');
    return;
  }

  if(!promo){
    showToast('¡NO PUEEEE! 🚩 Ese código no existe','error');
    return;
  }

  const {data:used, error:usedError} = await supabaseClient
    .from('used_codes')
    .select('id')
    .eq('email', currentUser.email)
    .eq('code', code)
    .maybeSingle();

  if(usedError){
    console.warn('Error consultando used_codes.', usedError);
    showToast('¡OIGA OIGA! 🔴 Ya reclamaste este botín antes','error');
    return;
  }

  if(used){
    showToast('¡OIGA OIGA! 🔴 Ya reclamaste este botín antes','error');
    return;
  }

  const reward = 100;
  const nextBalance = balance + reward;
  const {error:markError} = await supabaseClient
    .from('used_codes')
    .insert({
      user_id: currentUser.id,
      email: currentUser.email,
      code,
      reward_amount: reward,
      used_at: new Date().toISOString()
    });

  if(markError){
    console.warn('Error registrando used_codes.', markError);
    showToast('No se pudo marcar el código como usado','error');
    return;
  }

  updateBalanceDisplay(nextBalance, false);
  await saveUserProfile({coins:nextBalance});
  await saveAchievement('promo_' + code.toLowerCase(), 'Código Brutality ' + code, reward);
  input.value = '';
  showToast('¡EXITO !GOLAZO! 🐸⚽ Has ganado +100 Rani Coins','success');
}

async function syncBetStats(stake, totalOdd){
  const nextBets = Number(currentProfile?.bets || 0) + 1;
  const nextScore = Number(currentProfile?.score || 0) + Math.round(stake * totalOdd);
  const nextBestOdd = Math.max(Number(currentProfile?.best_odd || 0), Number(totalOdd || 0));

  await saveUserProfile({
    bets: nextBets,
    score: nextScore,
    best_odd: nextBestOdd,
    profit: Number(currentProfile?.profit || 0) - Number(stake || 0)
  });

  if(nextBets === 1) await saveAchievement('first_bet', 'Primera apuesta RANIBET', 25);
  if(totalOdd >= 4) await saveAchievement('high_odd', 'Cazador de cuota alta', 50);
}

function profileToRankRow(profile, index){
  const profit = Number(profile.profit || profile.score || 0);
  const bets = Number(profile.bets || 0);
  const won = Number(profile.won || 0);
  const winRate = profile.win_rate ?? (bets ? won / bets * 100 : 0);

  return {
    pos:index + 1,
    name:profile.username || 'Brutality',
    handle:'',
    avatar:'🐸',
    bets,
    won,
    profit,
    bestOdd:Number(profile.best_odd || 0),
    winRate:Number(winRate),
    title:profile.title || ''
  };
}

async function fetchGlobalRanking(){
  if(!supabaseClient) return null;

  const {data, error} = await supabaseClient
    .from('profiles')
    .select('username,score,bets,won,profit,best_odd,win_rate,title')
    .not('username', 'is', null)
    .neq('username', '')
    .order('score', {ascending:false})
    .limit(10);

  if(error){
    console.warn('No se pudo cargar Ranking Global desde Supabase. Tabla esperada: profiles.', error);
    return null;
  }

  return (data || []).map(profileToRankRow);
}

function subscribeToRanking(){
  if(!supabaseClient) return;

  supabaseClient
    .channel('ranking-global-profiles')
    .on('postgres_changes', {event:'*', schema:'public', table:'profiles'}, () => {
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
      html += `<div class="ticker-item"><span class="ticker-live">EN VIVO</span><div class="ticker-dot"></div><span class="ticker-teams">${m.home} <span class="ticker-score">${m.score}</span> ${m.away}</span><span class="ticker-min">${m.minute}'</span></div>`;
    });
    MATCHES.filter(m => !m.live).slice(0,4).forEach(m => {
      html += `<div class="ticker-item"><span style="color:var(--gold2);font-size:11px;font-weight:700">${m.leagueName.split(' ')[0].toUpperCase()}</span><span class="ticker-teams">${m.home} <span style="color:rgba(255,255,255,.4)">vs</span> ${m.away}</span><span style="color:rgba(255,255,255,.5);font-size:10px">${m.time}</span></div>`;
    });
  }
  document.getElementById('tickerInner').innerHTML = html;
}

function renderMatches(filter = 'all'){
  currentLeague = filter;
  const list = document.getElementById('matchesList');
  const data = filter === 'all' ? MATCHES : MATCHES.filter(m => m.league === filter);
  if(!data.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">🐸 No hay partidos en esta categoría</div>';return;}
  list.innerHTML = data.map(m => matchCardHTML(m)).join('');
  updateOddBtnStates();
}

function matchCardHTML(m){
  const isLive = m.live;
  return `<div class="match-card" id="mc-${m.id}"><div class="match-header"><div class="match-league-name"><span class="match-league-flag">${leagueFlag(m.league)}</span>${m.leagueName}</div><div class="match-right-info">${isLive ? '<span class="live-badge">🔴 EN VIVO</span>' : ''}<span class="match-time-badge">${isLive ? m.minute + "'" : m.time}</span></div></div><div class="match-body"><div class="teams-row"><div class="team-side"><div class="team-icon">${m.homeEmoji}</div><div class="team-name">${m.home}</div></div><div class="match-center">${isLive ? `<div class="score-live">${m.score}</div><div class="score-min">MIN ${m.minute}</div>` : `<div class="vs-text">VS</div><div class="match-date-sub">${m.time}</div>`}</div><div class="team-side"><div class="team-icon">${m.awayEmoji}</div><div class="team-name">${m.away}</div></div></div></div><div class="odds-row"><button class="odd-btn" id="ob-${m.id}-h" onclick="addPick(${m.id},'h')"><span class="odd-label">1 - ${m.home.split(' ')[0]}</span><span class="odd-value">${m.odds.h.toFixed(2)}</span></button><button class="odd-btn" id="ob-${m.id}-d" onclick="addPick(${m.id},'d')"><span class="odd-label">X - Empate</span><span class="odd-value">${m.odds.d.toFixed(2)}</span></button><button class="odd-btn" id="ob-${m.id}-a" onclick="addPick(${m.id},'a')"><span class="odd-label">2 - ${m.away.split(' ')[0]}</span><span class="odd-value">${m.odds.a.toFixed(2)}</span></button></div><div class="more-mkts"><button class="more-mkts-btn" onclick="showToast('Mercados adicionales próximamente 🐸','info')">+12 mercados →</button></div></div>`;
}

function leagueFlag(league){return {liga1:'🇵🇪',copa:'🇵🇪',champions:'⭐',laliga:'🇪🇸',premier:'🏴',libertadores:'🌎'}[league] || '🏆';}

function addPick(matchId,type){
  const match = MATCHES.find(m => m.id === matchId);
  if(!match) return;
  const pickLabels = {h:`${match.home} gana`,d:'Empate',a:`${match.away} gana`};
  const odd = match.odds[type];
  const existing = ticket.findIndex(t => t.matchId === matchId);
  if(existing >= 0){
    if(ticket[existing].type === type){ticket.splice(existing,1);showToast('Selección retirada del ticket');}
    else{ticket[existing] = {matchId,type,league:match.leagueName,match:`${match.home} vs ${match.away}`,pick:pickLabels[type],odd};showToast('Selección cambiada ✅');}
  }else{
    ticket.push({matchId,type,league:match.leagueName,match:`${match.home} vs ${match.away}`,pick:pickLabels[type],odd});
    showToast('¡Añadido al ticket! 🐸');
  }
  updateOddBtnStates();
  renderTicket();
}

function updateOddBtnStates(){
  document.querySelectorAll('.odd-btn').forEach(b => b.classList.remove('selected'));
  ticket.forEach(t => {const el = document.getElementById(`ob-${t.matchId}-${t.type}`); if(el) el.classList.add('selected');});
}

function setBetType(type){
  betType = type;
  document.getElementById('tttSingle').classList.toggle('active', type === 'simple');
  document.getElementById('tttCombo').classList.toggle('active', type === 'combinada');
  renderTicket();
}

function getTotalOdd(){return ticket.length ? ticket.reduce((acc,t) => acc * t.odd, 1) : 1;}

function renderTicket(){
  const body = document.getElementById('ticketBody');
  const foot = document.getElementById('ticketFoot');
  document.getElementById('ticketBadge').textContent = ticket.length;
  if(!ticket.length){
    body.innerHTML = `<div class="ticket-empty"><div class="ticket-empty-frog">🐸</div><div class="ticket-empty-title">Ticket vacío</div><div class="ticket-empty-sub">Haz click en una cuota para añadir tu selección al ticket.</div></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = `<div class="ticket-items-wrap">${ticket.map((t,i) => `<div class="ticket-item"><button class="ticket-item-rm" onclick="removePick(${i})">✕</button><div class="ticket-item-league">${t.league}</div><div class="ticket-item-match">${t.match}</div><div class="ticket-item-pick">${t.pick}</div><div class="ticket-item-odd-row"><span class="ticket-item-odd-label">Cuota</span><span class="ticket-item-odd-val">${t.odd.toFixed(2)}</span></div></div>`).join('')}</div>`;
  const total = getTotalOdd();
  const stakeVal = parseFloat(document.getElementById('stakeValInput')?.value) || 10;
  foot.innerHTML = `<div class="ticket-footer"><div class="tfoot-row"><span class="tfoot-label">SELECCIONES</span><span class="tfoot-val">${ticket.length}</span></div><div class="tfoot-row"><span class="tfoot-label">CUOTA TOTAL</span><span class="tfoot-val tfoot-odd">${total.toFixed(2)}</span></div><div class="stake-wrap"><div class="stake-lbl">MONTO A APOSTAR (R) <span onclick="stakeAll()">MAX</span></div><div class="stake-presets"><button class="preset-btn" onclick="setStake(5)">R5</button><button class="preset-btn" onclick="setStake(10)">R10</button><button class="preset-btn" onclick="setStake(25)">R25</button><button class="preset-btn" onclick="setStake(50)">R50</button></div><input type="number" class="stake-input" id="stakeValInput" value="${stakeVal}" min="1" max="${balance}" oninput="updatePotential()"></div><div class="potential-box"><span class="pot-label">🐸 Ganancia Potencial</span><span class="pot-val" id="potVal">R${(total * stakeVal).toFixed(2)}</span></div><button class="btn-clear-t" onclick="clearTicket()">✕ Limpiar ticket</button><button class="btn-bet-main" onclick="placeBet()">APOSTAR AHORA</button></div>`;
}

function setStake(v){document.getElementById('stakeValInput').value = v;updatePotential();}
function stakeAll(){document.getElementById('stakeValInput').value = balance;updatePotential();}
function updatePotential(){const total = getTotalOdd();const stake = parseFloat(document.getElementById('stakeValInput')?.value) || 0;const el = document.getElementById('potVal');if(el) el.textContent = `R${(total * stake).toFixed(2)}`;}
function removePick(i){ticket.splice(i,1);updateOddBtnStates();renderTicket();}
function clearTicket(){ticket = [];updateOddBtnStates();renderTicket();showToast('Ticket limpiado 🐸');}

async function placeBet(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para guardar tus RaniCoins','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality 💀🔥','error');return;}
  if(!ticket.length){showToast('¡Añade picks al ticket!','error');return;}
  const stake = parseFloat(document.getElementById('stakeValInput')?.value) || 0;
  if(stake < 1){showToast('Mínimo R1 para apostar','error');return;}
  if(stake > balance){showToast('No tienes suficientes RaniCoins 🐸','error');return;}
  const totalOdd = getTotalOdd();
  const payout = totalOdd * stake;
  const tid = 'RNB-' + Math.floor(10000 + Math.random() * 89999);
  betsHistory.unshift({id:tid,date:CURRENT_DATE_LABEL,user:currentProfile?.username || 'Brutality',status:'PENDING',picks:ticket.map(t => ({match:t.match,pick:t.pick,odd:t.odd,league:t.league})),totalOdd,stake,payout});
  balance -= stake;
  document.getElementById('balAmt').textContent = balance;
  await syncBetStats(stake, totalOdd);
  document.getElementById('mTicketId').textContent = tid;
  document.getElementById('mPicks').textContent = ticket.length;
  document.getElementById('mOdd').textContent = totalOdd.toFixed(2);
  document.getElementById('mStake').textContent = 'R' + stake;
  document.getElementById('mPotential').textContent = 'R' + payout.toFixed(2);
  document.getElementById('ticketModal').classList.add('open');
  ticket = [];
  updateOddBtnStates();
  renderTicket();
  renderHistory();
  renderWon();
}

function closeModal(){document.getElementById('ticketModal').classList.remove('open');}
async function addCoins(){
  if(!currentUser?.email){showToast('Inicia sesión con Google para recargar RaniCoins','error');return;}
  if(!usernameReady){ensureUsernameGate();showToast('Primero elige tu nombre Brutality 💀🔥','error');return;}
  balance += 100;
  document.getElementById('balAmt').textContent = balance;
  await saveUserProfile({coins:balance});
  await saveAchievement('first_recharge', 'Primera recarga de RaniCoins', 10);
  showToast('¡+R100 RaniCoins cargados! 🐸','success');
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
  if(!data.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">🐸 No hay apuestas en esta categoría</div>';return;}
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
  if(!won.length){list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">🐸 Aún no tienes apuestas ganadas</div>';return;}
  list.innerHTML = won.map(b => historyCardHTML(b)).join('');
}

function historyCardHTML(b){
  const bClass = {WON:'badge-won',LOST:'badge-lost',PENDING:'badge-pending'}[b.status];
  const bLabel = {WON:'✅ GANADA',LOST:'❌ PERDIDA',PENDING:'⏳ PENDIENTE'}[b.status];
  const payColor = b.status === 'WON' ? 'hf-won' : b.status === 'LOST' ? 'hf-lost' : '';
  const payVal = b.status === 'WON' ? 'R' + b.payout.toFixed(2) : b.status === 'LOST' ? '-' : 'R' + b.payout.toFixed(2) + '*';
  return `<div class="h-card"><div class="h-card-head"><div><div class="h-card-id">${b.id}</div><div class="h-card-date">${b.date}</div></div><div class="badge ${bClass}">${bLabel}</div></div><div class="h-picks">${b.picks.map(p => `<div class="h-pick"><div class="h-pick-info"><div class="h-pick-match">${p.match}</div><div class="h-pick-sel">▸ ${p.pick}</div></div><div class="h-pick-odd">${p.odd.toFixed(2)}</div></div>`).join('')}</div><div class="h-fin"><div class="hf"><div class="hf-lbl">Cuota</div><div class="hf-val">${b.totalOdd.toFixed(2)}</div></div><div class="hf"><div class="hf-lbl">Apostado</div><div class="hf-val">R${b.stake}</div></div><div class="hf"><div class="hf-lbl">${b.status === 'WON' ? 'Cobrado' : b.status === 'PENDING' ? 'Potencial' : 'Perdido'}</div><div class="hf-val ${payColor}">${payVal}</div></div></div></div>`;
}

async function renderRanking(){
  const list = document.getElementById('rankList');
  const rankingRows = await fetchGlobalRanking() || [];
  if(!rankingRows.length){
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">🐸 Aún no hay usuarios en el ranking global</div>';
    document.getElementById('rlTotal').textContent = '0';
    document.getElementById('rlAvgRate').textContent = '0%';
    document.getElementById('rlTopProfit').textContent = 'R0';
    return;
  }
  const avgRate = Math.round(rankingRows.reduce((a,r) => a + r.winRate, 0) / rankingRows.length);
  const topProfit = Math.max(...rankingRows.map(r => r.profit));
  document.getElementById('rlTotal').textContent = rankingRows.length;
  document.getElementById('rlAvgRate').textContent = avgRate + '%';
  document.getElementById('rlTopProfit').textContent = 'R' + topProfit;
  const medals = {1:'🥇',2:'🥈',3:'🥉'};
  const posClass = {1:'p1',2:'p2',3:'p3'};
  const cardClass = {1:'gold',2:'silver',3:'bronze'};
  list.innerHTML = rankingRows.map(r => `<div class="rank-card ${cardClass[r.pos] || ''}"><div class="rank-pos ${posClass[r.pos] || 'pn'}">${r.pos <= 3 ? medals[r.pos] : r.pos}</div><div class="rank-avatar">${r.avatar}</div><div class="rank-info"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><div class="rank-name">${r.name}</div>${r.title ? `<span class="rank-frog-tag">🐸 ${r.title}</span>` : ''}</div><div class="rank-stats"><div class="rank-stat"><div class="rs-val">${r.bets}</div><div class="rs-lbl">Picks</div></div><div class="rank-stat"><div class="rs-val">${r.won}</div><div class="rs-lbl">Won</div></div><div class="rank-stat"><div class="rs-val">${r.winRate.toFixed(0)}%</div><div class="rs-lbl">Rate</div></div><div class="rank-stat"><div class="rs-val">${r.bestOdd.toFixed(2)}</div><div class="rs-lbl">Best</div></div></div><div class="winrate-bar"><div class="winrate-fill" style="width:${r.winRate}%"></div></div></div><div class="rank-profit"><div class="rp-val">R${r.profit}</div><div class="rp-lbl">Puntaje</div></div></div>`).join('');
}

function renderLive(){
  const live = MATCHES.filter(m => m.live);
  const el = document.getElementById('liveMatchList');
  if(!live.length){el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--muted)">🐸 No hay partidos en vivo ahora</div>';return;}
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

function loadScrapedMatches(scrapedMatches){
  if(!Array.isArray(scrapedMatches)){showToast('El scraper debe devolver un array de partidos','error');return;}
  MATCHES.splice(0, MATCHES.length, ...scrapedMatches);
  buildTicker();
  renderMatches(currentLeague);
  renderLive();
  showToast('Partidos actualizados desde scraping 🔗','success');
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

function keepTodayAndNextJornadaByGroup(rows){
  const inputRows = Array.isArray(rows) ? rows : [];
  const now = new Date();
  const todayKey = toDateKey(now);
  const liveRows = inputRows.filter(row => row?.live === true);

  const enriched = inputRows.map(row => ({row, matchDate: parseScraperMatchDate(row)}));
  const withDate = enriched.filter(item => Number.isFinite(item.matchDate?.getTime()));
  const withoutDate = enriched.filter(item => !Number.isFinite(item.matchDate?.getTime()));

  withDate.sort((a, b) => a.matchDate - b.matchDate);
  const todayRows = withDate.filter(item => toDateKey(item.matchDate) === todayKey);
  const futureRows = withDate.filter(item => toDateKey(item.matchDate) > todayKey);
  // Champions/Libertadores suelen publicar la "próxima jornada" repartida en 2 días.
  const nextFutureKeys = [...new Set(futureRows.map(item => toDateKey(item.matchDate)))].slice(0, 2);
  const nextJornadaRows = nextFutureKeys.length
    ? futureRows.filter(item => nextFutureKeys.includes(toDateKey(item.matchDate)))
    : [];

  const selected = [...liveRows.map(row => ({row, matchDate: parseScraperMatchDate(row)})), ...todayRows, ...nextJornadaRows];
  if(selected.length){
    const seen = new Set();
    return selected.filter(item => {
      const key = `${item.row?.torneo || ''}|${item.row?.local || ''}|${item.row?.visitante || ''}|${item.row?.match_datetime || ''}|${item.row?.time_text || ''}`;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if(futureRows.length){
    const fallbackKeys = [...new Set(futureRows.map(item => toDateKey(item.matchDate)))].slice(0, 2);
    return futureRows.filter(item => fallbackKeys.includes(toDateKey(item.matchDate)));
  }
  return withoutDate.slice(0, 10);
}

const SCRAPER_LEAGUE_CONFIG = {
  liga1: {leagueName: 'Liga 1 Peruana', homeEmoji: '⚪', awayEmoji: '🔴'},
  libertadores: {leagueName: 'Copa Libertadores', homeEmoji: '🔴', awayEmoji: '⚪'},
  champions: {leagueName: 'UEFA Champions League', homeEmoji: '⭐', awayEmoji: '🔵'}
};

function resolveScraperLeague(item){
  const torneo = String(item?.torneo || '').toLowerCase();
  if(torneo.includes('liga 1')) return 'liga1';
  if(torneo.includes('libertador')) return 'libertadores';
  if(torneo.includes('champions')) return 'champions';
  return null;
}

function createMatchFromScraper(item, idx, nextId){
  const home = String(item?.local || '').trim();
  const away = String(item?.visitante || '').trim();
  if(!home || !away) return null;
  const league = resolveScraperLeague(item);
  if(!league || !SCRAPER_LEAGUE_CONFIG[league]) return null;
  const matchDate = parseScraperMatchDate(item);
  const cfg = SCRAPER_LEAGUE_CONFIG[league];

  const oddHome = Number(item?.mejor_cuota_local ?? item?.cuota_local);
  const oddDraw = Number(item?.mejor_cuota_empate ?? item?.cuota_empate);
  const oddAway = Number(item?.mejor_cuota_visitante ?? item?.cuota_visitante);
  const isLive = item?.live === true;
  const liveMinute = String(item?.minute || '').replace(/[^0-9+]/g, '');
  const liveScore = String(item?.score || '').replace(':', '-').trim();

  return {
    id: nextId + idx,
    league,
    leagueName: cfg.leagueName,
    home,
    away,
    homeEmoji: cfg.homeEmoji,
    awayEmoji: cfg.awayEmoji,
    time: isLive ? (liveMinute ? `${liveMinute}'` : 'EN VIVO') : formatLiga1KickoffLabel(item, matchDate),
    odds: {
      h: Number.isFinite(oddHome) && oddHome > 0 ? oddHome : 2.00,
      d: Number.isFinite(oddDraw) && oddDraw > 0 ? oddDraw : 3.00,
      a: Number.isFinite(oddAway) && oddAway > 0 ? oddAway : 3.50
    },
    live: isLive,
    score: isLive ? (liveScore || '0-0') : undefined,
    minute: isLive ? (liveMinute || '0') : undefined
  };
}

function replaceScrapedLeagueMatches(scrapedRows){
  const rows = Array.isArray(scrapedRows) ? scrapedRows : [];
  const grouped = Object.fromEntries(Object.keys(SCRAPER_LEAGUE_CONFIG).map(league => [league, []]));
  rows.forEach(row => {
    const league = resolveScraperLeague(row);
    if(league && grouped[league]) grouped[league].push(row);
  });

  const filteredRows = Object.values(grouped)
    .flatMap(group => keepTodayAndNextJornadaByGroup(group).map(item => item.row || item));

  const rowsByLeague = Object.fromEntries(Object.keys(SCRAPER_LEAGUE_CONFIG).map(league => [league, []]));
  filteredRows.forEach(row => {
    const league = resolveScraperLeague(row);
    if(league && rowsByLeague[league]) rowsByLeague[league].push(row);
  });

  const hasAnyScraped = Object.values(rowsByLeague).some(group => group.length > 0);
  if(!hasAnyScraped) return false;

  const maxId = MATCHES.reduce((acc, m) => Math.max(acc, Number(m.id) || 0), 0);
  let nextId = maxId + 1;
  const merged = [];
  Object.keys(rowsByLeague).forEach(league => {
    const scrapedLeagueRows = rowsByLeague[league];
    if(!scrapedLeagueRows.length) return;
    const mappedLeague = scrapedLeagueRows
      .map((row, idx) => createMatchFromScraper(row, idx, nextId))
      .filter(Boolean);
    nextId += mappedLeague.length;
    merged.push(...mappedLeague);
  });

  if(!merged.length) return false;

  MATCHES.splice(0, MATCHES.length, ...merged);
  buildTicker();
  renderMatches(currentLeague);
  renderTicket();
  if(document.getElementById('page-live')?.classList.contains('active')) renderLive();
  return true;
}

async function syncLeaguesFromFlashscore(notify = false){
  try{
    const response = await fetch(`./partidos.json?ts=${Date.now()}`, {cache:'no-store'});
    if(!response.ok) return;
    const data = await response.json();
    const changed = replaceScrapedLeagueMatches(data);
    if(changed && notify) showToast('Ligas actualizadas desde Flashscore 🔄','success');
  }catch(error){
    console.warn('No se pudo actualizar ligas desde partidos.json', error);
  }
}

function keepOnlyScraperLeaguesInMemory(){
  // Modo estricto: mostrar solo partidos que vienen del scraping (partidos.json).
  MATCHES.splice(0, MATCHES.length);
}

// 🐸 SISTEMA DE POLLING, RELOJ EN VIVO Y DETECCIÓN DE GOLES
let previousScores = {};
let pollingIntervalId = null;
let liveClockIntervalId = null;
let liveMinuteCache = {}; // Almacena minuto actual local para cada partido en vivo

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

function extractMinuteNumber(minuteStr){
  if(!minuteStr) return 0;
  const str = String(minuteStr).replace(/[^0-9+]/g, '');
  return parseInt(str, 10) || 0;
}

function cleanupLiveCache(){
  const liveIds = new Set(MATCHES.filter(m => m.live).map(m => m.id));
  Object.keys(liveMinuteCache).forEach(id => {
    if(!liveIds.has(Number(id))){
      delete liveMinuteCache[id];
    }
  });
}

function incrementLiveMinutes(){
  MATCHES.forEach(m => {
    if(!m.live || !m.minute) return;
    
    const currentMinuteFromScraper = extractMinuteNumber(m.minute);
    
    if(!(m.id in liveMinuteCache)){
      liveMinuteCache[m.id] = currentMinuteFromScraper;
    }
    
    const cachedMinute = liveMinuteCache[m.id];
    
    if(cachedMinute >= currentMinuteFromScraper){
      liveMinuteCache[m.id] = cachedMinute + 1;
    } else {
      liveMinuteCache[m.id] = currentMinuteFromScraper + 1;
    }
    
    const newMinute = String(liveMinuteCache[m.id]);
    updateMatchDOMMinute(m.id, newMinute);
  });
}

function updateMatchDOMMinute(matchId, minute){
  const card = document.getElementById(`mc-${matchId}`);
  if(!card) return;
  
  const minEl = card.querySelector('.score-min');
  const badgeEl = card.querySelector('.match-time-badge');
  
  if(minEl) minEl.textContent = `MIN ${minute}`;
  if(badgeEl) badgeEl.textContent = minute + "'";
  
  const tickerMinBadges = document.querySelectorAll('.ticker-min');
  tickerMinBadges.forEach(badge => {
    if(badge.textContent.match(String(matchId))){
      badge.textContent = minute + "'";
    }
  });
}

function updateMatchDOM(matchId, minute, score){
  const card = document.getElementById(`mc-${matchId}`);
  if(!card) return;
  
  liveMinuteCache[matchId] = extractMinuteNumber(minute);
  const minEl = card.querySelector('.score-min');
  const scoreEl = card.querySelector('.score-live');
  const badgeEl = card.querySelector('.match-time-badge');
  
  if(minEl) minEl.textContent = `MIN ${minute}`;
  if(scoreEl) scoreEl.textContent = score;
  if(badgeEl) badgeEl.textContent = minute + "'";
  
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
  showToast(`⚽ ¡EXITO !GOLAZO! 🐸⚽ ${goal.match} (${goal.currentScore}) - MIN ${goal.minute}`, 'success');
  
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification('🐸 RANIBET - ¡GOLAZO!', {
      body: `${goal.match}: ${goal.currentScore}`,
      icon: '🐸'
    });
  }
}

async function pollMatchUpdates(){
  try{
    const response = await fetch(`./partidos.json?ts=${Date.now()}`, {cache:'no-store'});
    if(!response.ok) return;
    const data = await response.json();
    
    const detectedGoalsList = detectedGoals();
    
    replaceScrapedLeagueMatches(data);
    
    cleanupLiveCache();
    
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
    if(document.getElementById('page-sports')?.classList.contains('active')){
      renderMatches(currentLeague);
    }
  }catch(error){
    console.warn('Error en polling de goles:', error);
  }
}

window.RaniSupabase = {client:supabaseClient, initSupabaseProfile, loadUserProfile, saveUserProfile, fetchGlobalRanking};
window.RaniScraping = {loadScrapedMatches, MATCHES};
window.RaniLogros = {renderRanking, renderWon, saveAchievement, userAchievements:[]};
window.RaniCoins = {get balance(){return balance;}, addCoins, placeBet, redeemPromoCode};

keepOnlyScraperLeaguesInMemory();
buildTicker();
renderMatches('all');
renderTicket();
bindPromoCodeInput();

// Sync inmediato con Flashscore al cargar
syncLeaguesFromFlashscore(false).then(() => {
  storeCurrentScores();
  cleanupLiveCache();
  buildTicker();
  renderMatches(currentLeague);
  renderLive();
});

// Reloj en vivo: incrementa minutos cada segundo para partidos en vivo (resincronizado con Flashscore)
liveClockIntervalId = setInterval(incrementLiveMinutes, 1000);

// Polling cada 60 segundos con detección de goles
pollingIntervalId = setInterval(pollMatchUpdates, LIGA1_AUTO_REFRESH_MS);

initSupabaseProfile().then(() => {
  renderTicket();
  renderHistory();
  renderWon();
});

