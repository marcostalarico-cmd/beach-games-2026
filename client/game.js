// ============================================================
// BEACH GAMES 2026 — game.js v2
// Multiplayer real com Socket.io + fallback offline (bots)
// ============================================================

// ===== PERSONAGENS =====
const CHARACTERS = [
  { id:'sol',  name:'Sol',  emoji:'☀️', color:'#FFD43B', bg:'#FEF3C7', desc:'Veloz e ousado',      speed:5, agility:3 },
  { id:'kai',  name:'Kai',  emoji:'🌊', color:'#0EA5E9', bg:'#DBEAFE', desc:'Equilibrado e frio',  speed:4, agility:4 },
  { id:'luna', name:'Luna', emoji:'🌙', color:'#8B5CF6', bg:'#EDE9FE', desc:'Técnica e precisa',   speed:3, agility:5 },
  { id:'rio',  name:'Rio',  emoji:'🏄', color:'#10B981', bg:'#D1FAE5', desc:'Resistente e firme',  speed:4, agility:3 },
];

const BOT_BEHAVIORS = [
  { type:'rookie',     baseScore:4,  variance:6,  surgeEnd:false, label:'Iniciante'  },
  { type:'balanced',   baseScore:7,  variance:4,  surgeEnd:false, label:'Equilibrado' },
  { type:'aggressive', baseScore:9,  variance:8,  surgeEnd:false, label:'Agressivo'  },
  { type:'clumsy',     baseScore:5,  variance:10, surgeEnd:false, label:'Descuidado' },
  { type:'finisher',   baseScore:6,  variance:3,  surgeEnd:true,  label:'Acelerador' },
  { type:'steady',     baseScore:8,  variance:2,  surgeEnd:false, label:'Consistente'},
  { type:'wildcard',   baseScore:5,  variance:12, surgeEnd:false, label:'Coringa'    },
  { type:'ghost',      baseScore:10, variance:1,  surgeEnd:false, label:'Fantasma'   },
];
const BOT_NAMES  = ['Leo','Maya','Theo','Ben','Zara','Nick','Lia','Max','Ivy','Tom','Jade','Rafa'];
const BOT_EMOJIS = ['🤖','🦊','🐻','🦁','🐯','🦅','🐬','🦋','🐙','🦖','🦩','🐺'];
const CHAR_COLORS= ['#FFD43B','#0EA5E9','#8B5CF6','#10B981','#F97316','#EF4444','#EC4899','#14B8A6'];

// ===== SOCKET.IO =====
let socket = null;
let isOnline = false;
let isHost   = false;

function initSocket() {
  if (window.SOCKET_UNAVAILABLE || typeof io === 'undefined') {
    setConnectionStatus(false);
    return;
  }
  try {
    socket = io(window.SOCKET_URL, { transports:['websocket','polling'], timeout:5000 });
    socket.on('connect',    () => { isOnline = true;  setConnectionStatus(true);  });
    socket.on('disconnect', () => { isOnline = false; setConnectionStatus(false); });
    socket.on('connect_error', () => { isOnline = false; setConnectionStatus(false); });

    // Room events
    socket.on('roomCreated', onRoomCreated);
    socket.on('joinedRoom',  onJoinedRoom);
    socket.on('joinError',   onJoinError);
    socket.on('lobbyUpdate', onLobbyUpdate);
    socket.on('gameCountdown', onServerCountdown);
    socket.on('gameStart',   onServerGameStart);
    socket.on('rankUpdate',  onRankUpdate);
    socket.on('gameOver',    onServerGameOver);
    socket.on('playerLeft',  onPlayerLeft);
  } catch(e) {
    setConnectionStatus(false);
  }
}

function setConnectionStatus(online) {
  isOnline = online;
  const el = document.getElementById('conn-status');
  if (!el) return;
  el.textContent = online ? '🟢 Online — Multijogador ativo' : '🔴 Offline — Modo bots';
  el.className   = 'connection-status ' + (online ? 'online' : 'offline');
}

// ===== STATE =====
let gameMode   = 'solo';
let selectedChar = null;
let humanPlayer  = null;
let currentRoomCode = '';
let players = [];
let serverRanking = null; // usado em modo online
let lastSoloMode = 'solo';

// ===== CANVAS =====
let canvas, ctx, canvasW, canvasH;

// ===== GAME ENGINE =====
const GAME_DURATION = 90;
let world, hero, obstacles, stars, ramps, particles, bgElements;
let lastTime = 0, delta = 0, gameLoop = null, gameStartTime = 0;
let groundY;

// ===== TOUCH =====
let touchStartY = 0, touchStartX = 0;

// ===== INIT =====
window.addEventListener('load', () => {
  renderCharSelect();
  updateHomeBestScore();
  initSocket();
});
window.addEventListener('resize', () => {
  if (document.getElementById('screen-game').classList.contains('active')) resizeCanvas();
});

// ============================================================
// NAVIGATION
// ============================================================
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'game') setTimeout(resizeCanvas, 60);
}

function showCharSelect(mode) {
  gameMode = mode;
  lastSoloMode = mode;
  document.getElementById('charselect-back').onclick = () => showScreen('home');
  showScreen('charselect');
}

function showHowToPlay() { showScreen('howtoplay'); }

function showCreateRoom() {
  if (!humanPlayer) { gameMode='room'; showCharSelect('room'); return; }
  if (isOnline && socket) {
    socket.emit('createRoom', {
      playerName: humanPlayer.name,
      emoji: humanPlayer.emoji,
      color: humanPlayer.color,
    });
    // Espera resposta do servidor (onRoomCreated)
    updateOnlineBadge(false, 'Criando sala...');
    showScreen('createroom');
  } else {
    // Modo offline — simula sala
    currentRoomCode = generateRoomCode();
    document.getElementById('room-code-display').textContent = currentRoomCode;
    document.getElementById('room-link-display').textContent = `beachgames.app/sala/${currentRoomCode}`;
    updateOnlineBadge(false, 'Modo Offline — somente bots');
    buildOfflineLobby();
    showScreen('createroom');
  }
}

function showJoinRoom() {
  document.getElementById('join-code-input').value  = '';
  document.getElementById('join-name-input').value  = '';
  document.getElementById('join-feedback').textContent = '';
  showScreen('joinroom');
}

// ============================================================
// ROOM CODE
// ============================================================
function generateRoomCode() {
  const words = ['PRAIA','ONDA','SURF','AREIA','SOL','MAR','VENTO','AZUL'];
  return words[Math.floor(Math.random()*words.length)] + (10+Math.floor(Math.random()*90));
}

function copyInvite() {
  const code = currentRoomCode;
  const text = `🏖️ Bora jogar Beach Games 2026!\nCódigo: ${code}\nLink: beachgames.app/sala/${code}`;
  navigator.clipboard?.writeText(text).then(() => showToast('✅ Copiado!')).catch(()=>{});
  showToast('✅ Convite copiado!');
}

function updateOnlineBadge(green, text) {
  const badge = document.getElementById('online-badge');
  const dot   = badge?.querySelector('.online-dot');
  const label = document.getElementById('online-badge-text');
  if (dot) { dot.className = 'online-dot' + (green ? ' green' : ''); }
  if (label) label.textContent = text;
}

// ============================================================
// SOCKET ROOM EVENTS
// ============================================================
function onRoomCreated({ code, snapshot }) {
  currentRoomCode = code;
  isHost = true;
  document.getElementById('room-code-display').textContent = code;
  document.getElementById('room-link-display').textContent = `beachgames.app/sala/${code}`;
  updateOnlineBadge(true, `🟢 ${snapshot.playerCount} jogador(es) • ${snapshot.botCount} bots`);
  renderLobbyFromSnapshot(snapshot, 'create-lobby-list');
}

function onJoinedRoom({ code, snapshot }) {
  currentRoomCode = code;
  isHost = false;
  document.getElementById('lobby-room-code').textContent = code;
  renderLobbyFromSnapshot(snapshot, 'lobby-players-list');
  updateLobbyHostButton();
  showScreen('lobby');
}

function onJoinError({ message }) {
  const fb = document.getElementById('join-feedback');
  if (fb) { fb.textContent = '⚠️ ' + message; fb.style.color = '#EF4444'; }
}

function onLobbyUpdate(snapshot) {
  const screen = document.querySelector('.screen.active');
  if (!screen) return;
  const id = screen.id;
  if (id === 'screen-createroom') {
    renderLobbyFromSnapshot(snapshot, 'create-lobby-list');
    updateOnlineBadge(true, `🟢 ${snapshot.playerCount} jogador(es) • ${snapshot.botCount} bots`);
  } else if (id === 'screen-lobby') {
    renderLobbyFromSnapshot(snapshot, 'lobby-players-list');
    document.getElementById('lobby-room-code').textContent = snapshot.code;
  }
}

function onServerCountdown({ snapshot }) {
  // Monta players do snapshot para uso no jogo
  players = snapshot.players.map(p => ({
    id: p.id, name: p.name, emoji: p.emoji,
    color: p.color, score: 0,
    isHuman: p.id === socket?.id,
    isBot: p.isBot,
    isFriend: false,
  }));
  runCountdown();
}

function onServerGameStart({ snapshot }) {
  // Jogo já iniciou via countdown
}

function onRankUpdate({ ranking, elapsed }) {
  serverRanking = ranking;
  if (!document.getElementById('screen-game').classList.contains('active')) return;
  // Sync bot/opponent scores
  ranking.forEach(r => {
    const p = players.find(p => p.id === r.id);
    if (p && !p.isHuman) p.score = r.score;
  });
  updateRankDisplay();
}

function onServerGameOver({ ranking }) {
  serverRanking = ranking;
  // Sync final scores
  ranking.forEach(r => {
    const p = players.find(p => p.id === r.id);
    if (p) p.score = r.score;
  });
  const human = players.find(p => p.isHuman);
  if (human) human.score = hero ? hero.score : 0;
  setTimeout(showResult, 400);
}

function onPlayerLeft({ playerId, snapshot }) {
  showToast('👋 Jogador saiu da sala');
  onLobbyUpdate(snapshot);
}

// ============================================================
// LOBBY RENDERING
// ============================================================
function renderLobbyFromSnapshot(snapshot, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = snapshot.players.map(p => {
    const isMe = p.id === socket?.id;
    const badge = isMe ? 'badge-human' : p.isBot ? 'badge-bot' : 'badge-online';
    const label = isMe ? '👤 Você' : p.isBot ? '🤖 Bot' : '🌐 Online';
    return `
      <div class="lobby-player-row">
        <div class="lobby-player-avatar" style="background:${p.color}22">${p.emoji}</div>
        <div class="lobby-player-name">${p.name}</div>
        <span class="lobby-player-badge ${badge}">${label}</span>
      </div>`;
  }).join('');
}

function buildOfflineLobby() {
  players = [{
    id:'human', name: humanPlayer?.name||'Você',
    emoji: humanPlayer?.emoji||'😎',
    color: humanPlayer?.color||'#F97316',
    isHuman:true, isFriend:false, score:0,
  }];
  fillWithBots(9 - players.length);
  const el = document.getElementById('create-lobby-list');
  if (el) el.innerHTML = players.map(p => `
    <div class="lobby-player-row">
      <div class="lobby-player-avatar" style="background:${p.color}22">${p.emoji}</div>
      <div class="lobby-player-name">${p.name}</div>
      <span class="lobby-player-badge ${p.isHuman?'badge-human':'badge-bot'}">${p.isHuman?'👤 Você':'🤖 Bot'}</span>
    </div>`).join('');
}

function fillWithBots(count) {
  const names = [...BOT_NAMES].sort(()=>Math.random()-0.5);
  const behaviors = [...BOT_BEHAVIORS].sort(()=>Math.random()-0.5);
  for (let i=0; i<count; i++) {
    players.push({
      id:'bot_'+i, name:'Bot '+names[i%names.length],
      emoji: BOT_EMOJIS[i%BOT_EMOJIS.length],
      color: CHAR_COLORS[(i+3)%CHAR_COLORS.length],
      isHuman:false, isFriend:false,
      behavior: behaviors[i%behaviors.length], score:0,
    });
  }
}

function updateLobbyHostButton() {
  const btnStart  = document.getElementById('btn-start-lobby');
  const lblWaiting = document.getElementById('lobby-waiting');
  if (!btnStart || !lblWaiting) return;
  if (isHost || socket?.id === socket?.id) {
    // Always show start button for simplicity
    btnStart.style.display = 'block';
    lblWaiting.style.display = 'none';
  }
}

function leaveRoom() {
  if (socket && isOnline) socket.disconnect();
  showScreen('home');
}

// ============================================================
// CHARACTER SELECT
// ============================================================
function renderCharSelect() {
  const grid = document.getElementById('char-grid');
  if (!grid) return;
  grid.innerHTML = CHARACTERS.map(c => `
    <div class="char-card" id="char-${c.id}" onclick="selectChar('${c.id}')">
      <div class="char-avatar" style="background:${c.bg}">${c.emoji}</div>
      <div class="char-name" style="color:${c.color}">${c.name}</div>
      <div class="char-desc">${c.desc}</div>
      <div class="char-stat" style="color:${c.color}">
        Vel ${'▮'.repeat(c.speed)}${'▯'.repeat(5-c.speed)} | Ágil ${'▮'.repeat(c.agility)}${'▯'.repeat(5-c.agility)}
      </div>
    </div>`).join('');
}

function selectChar(id) {
  document.querySelectorAll('.char-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('char-'+id)?.classList.add('selected');
  humanPlayer = CHARACTERS.find(c=>c.id===id);
}

function confirmCharacter() {
  if (!humanPlayer) { humanPlayer = CHARACTERS[0]; selectChar(CHARACTERS[0].id); }
  if (gameMode==='solo' || gameMode==='offline') {
    buildSoloLobby();
    goToLobby();
  } else {
    showCreateRoom();
  }
}

function buildSoloLobby() {
  players = [{
    id:'human', name:humanPlayer?.name||'Você',
    emoji:humanPlayer?.emoji||'😎',
    color:humanPlayer?.color||'#F97316',
    isHuman:true, isFriend:false, score:0,
  }];
  fillWithBots(8);
}

function goToLobby() {
  document.getElementById('lobby-room-code').textContent = currentRoomCode || 'SOLO';
  const el = document.getElementById('lobby-players-list');
  if (el) el.innerHTML = players.map(p=>`
    <div class="lobby-player-row">
      <div class="lobby-player-avatar" style="background:${p.color}22">${p.emoji}</div>
      <div class="lobby-player-name">${p.name}</div>
      <span class="lobby-player-badge ${p.isHuman?'badge-human':'badge-bot'}">${p.isHuman?'👤 Você':'🤖 Bot'}</span>
    </div>`).join('');
  document.getElementById('btn-start-lobby').style.display = 'block';
  document.getElementById('lobby-waiting').style.display   = 'none';
  document.getElementById('lobby-status').textContent =
    `${players.filter(p=>p.isHuman).length} humano · ${players.filter(p=>!p.isHuman).length} bots`;
  showScreen('lobby');
}

// ============================================================
// JOIN ROOM
// ============================================================
function joinRoom() {
  const code = document.getElementById('join-code-input').value.toUpperCase().trim();
  const name = document.getElementById('join-name-input').value.trim() || 'Jogador';
  const fb   = document.getElementById('join-feedback');

  if (!code || code.length < 4) {
    fb.textContent = '⚠️ Digite um código válido!'; fb.style.color='#EF4444'; return;
  }
  if (!humanPlayer) humanPlayer = CHARACTERS[0];

  if (isOnline && socket) {
    fb.textContent = '🔍 Procurando sala...'; fb.style.color='#FCD34D';
    socket.emit('joinRoom', { code, playerName: name, emoji: humanPlayer.emoji, color: humanPlayer.color });
  } else {
    // Offline fallback
    fb.textContent = '✅ Entrando (modo offline)...'; fb.style.color='#86EFAC';
    currentRoomCode = code;
    buildSoloLobby();
    setTimeout(goToLobby, 700);
  }
}

// ============================================================
// START GAME
// ============================================================
function hostStartGame() {
  if (isOnline && socket && currentRoomCode) {
    socket.emit('startGame');
  } else {
    runCountdown();
  }
}

function startGame() { hostStartGame(); }

function runCountdown() {
  showScreen('countdown');
  const preview = document.getElementById('countdown-players-preview');
  preview.innerHTML = players.map(p=>`
    <div class="countdown-player-chip" style="border-color:${p.color}55">
      ${p.emoji} ${p.name}
    </div>`).join('');

  let count = 3;
  const numEl = document.getElementById('countdown-number');
  const tick = () => {
    numEl.textContent = count;
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = 'cdPop 1s ease-in-out forwards';
    if (count > 1) { count--; setTimeout(tick, 1000); }
    else {
      setTimeout(() => {
        numEl.textContent = 'GO!';
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = 'cdPop 0.6s ease-in-out forwards';
        setTimeout(initGameScreen, 700);
      }, 1000);
    }
  };
  tick();
}

// ============================================================
// GAME INIT
// ============================================================
function initGameScreen() {
  showScreen('game');
  setTimeout(() => {
    resizeCanvas();
    initGameState();
    startGameLoop();
    setupTouchControls();
    setupKeyboard();
  }, 80);
}

function resizeCanvas() {
  canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const gs = document.getElementById('screen-game');
  canvasW = gs.offsetWidth;
  canvasH = canvas.getBoundingClientRect().height || gs.offsetHeight - 130;
  canvas.width  = canvasW;
  canvas.height = canvasH;
  ctx = canvas.getContext('2d');
  groundY = canvasH - 58;
}

function initGameState() {
  world = { speed:210, dist:0, time:0 };
  obstacles = []; stars = []; ramps = []; particles = []; bgElements = [];

  hero = {
    x: canvasW*0.18, y:0,
    w:36, h:44,
    vy:0, isGrounded:true, isDucking:false,
    energy:3, maxEnergy:3,
    score:0, combo:0,
    lastHitTime:-2, onRamp:false,
    trickCooldown:0, invincible:0,
    distScore: 0,
  };
  hero.y = groundY - hero.h;

  players.forEach(p => { p.score = 0; });
  serverRanking = null;

  for (let i=0;i<5;i++) bgElements.push(makeBgElement(canvasW*Math.random()));
  for (let i=0;i<3;i++) {
    spawnStar(canvasW + i*240);
    if (Math.random()>0.4) spawnObstacle(canvasW+200+i*360);
  }
  spawnRamp(canvasW+500);

  gameStartTime = performance.now();
  lastTime = performance.now();

  updateEnergyUI();
  document.getElementById('hud-score').textContent = '0';
  document.getElementById('hud-timer').textContent = GAME_DURATION;
  document.getElementById('hud-rank').textContent  = '1º';
}

// ============================================================
// BACKGROUND ELEMENTS
// ============================================================
function makeBgElement(x) {
  const types = ['cloud','seagull','palm','flag'];
  const type  = types[Math.floor(Math.random()*types.length)];
  return {
    type, x,
    y: type==='cloud'   ? 15+Math.random()*60
     : type==='seagull' ? 25+Math.random()*80
     : type==='palm'    ? groundY-70-Math.random()*25
     : groundY-40-Math.random()*20,
    size: 0.55+Math.random()*0.9,
    speed: type==='cloud'?0.28:type==='seagull'?0.55:0.95,
  };
}

// ============================================================
// WORLD OBJECTS
// ============================================================
const OBS_TYPES = [
  { id:'cone',     emoji:'🔺', w:22, h:34 },
  { id:'bench',    emoji:'🪑', w:40, h:28 },
  { id:'ball',     emoji:'⚽', w:26, h:26 },
  { id:'puddle',   emoji:'💧', w:48, h:14 },
  { id:'umbrella', emoji:'☂️', w:38, h:48 },
  { id:'crab',     emoji:'🦀', w:28, h:20 },
  { id:'bucket',   emoji:'🪣', w:24, h:28 },
];

function spawnObstacle(x) {
  const t = OBS_TYPES[Math.floor(Math.random()*OBS_TYPES.length)];
  const h = t.h + Math.floor(Math.random()*8);
  obstacles.push({ ...t, h, x: x||canvasW+60, y: groundY-h });
}
function spawnRamp(x) {
  ramps.push({ x:x||canvasW+60, y:groundY-28, w:80, h:28 });
}
function spawnStar(x) {
  const tier = Math.random();
  stars.push({
    x: x||canvasW+60,
    y: tier<0.3 ? groundY-85-Math.random()*40
      :tier<0.7 ? groundY-50-Math.random()*20
      :           groundY-110-Math.random()*50,
    r: 9+Math.random()*5, collected:false, pulse:Math.random()*Math.PI*2,
  });
}
function spawnParticles(x, y, color, count=8) {
  for (let i=0;i<count;i++) {
    const a = Math.PI*2*i/count+Math.random()*0.5;
    const s = 60+Math.random()*90;
    particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-50,
      life:1, maxLife:0.5+Math.random()*0.4, color, r:4+Math.random()*4 });
  }
}

// ============================================================
// GAME LOOP
// ============================================================
function startGameLoop() {
  if (gameLoop) cancelAnimationFrame(gameLoop);
  lastTime = performance.now();
  loop(performance.now());
}

function loop(ts) {
  delta = Math.min((ts-lastTime)/1000, 0.05);
  lastTime = ts;
  world.time = (ts-gameStartTime)/1000;
  const timeLeft = Math.max(0, GAME_DURATION-world.time);

  update(delta, timeLeft);
  render();

  if (timeLeft>0 && hero.energy>0) {
    gameLoop = requestAnimationFrame(loop);
  } else {
    // In online mode, server sends gameOver; offline we trigger directly
    if (!isOnline) setTimeout(showResult, 500);
  }
}

// ============================================================
// UPDATE
// ============================================================
function update(dt, timeLeft) {
  world.speed = 210 + Math.min(world.time*2.5, 120);
  world.dist += world.speed*dt;

  // HUD
  document.getElementById('hud-timer').textContent = Math.ceil(timeLeft);
  document.getElementById('hud-score').textContent = Math.floor(hero.score);

  // Energy colors
  const eb = document.getElementById('energy-bar');
  if (eb) {
    eb.style.width = (hero.energy/hero.maxEnergy*100)+'%';
    eb.style.background =
      hero.energy===1 ? 'linear-gradient(90deg,#EF4444,#DC2626)'
      :hero.energy===2 ? 'linear-gradient(90deg,#F97316,#EA580C)'
      :'linear-gradient(90deg,#34D399,#10B981)';
  }

  // Hero physics
  if (!hero.isGrounded) {
    hero.vy += 820*dt;
    hero.y  += hero.vy*dt;
    if (hero.y >= groundY-hero.h) {
      hero.y = groundY-hero.h;
      hero.vy = 0;
      hero.isGrounded = true;
      hero.onRamp = false;
    }
  }
  const heroH   = hero.isDucking ? 20 : hero.h;
  const heroTop = hero.isDucking ? hero.y+hero.h-20 : hero.y;

  if (hero.trickCooldown>0) hero.trickCooldown-=dt;
  if (hero.invincible>0)    hero.invincible-=dt;

  // Distance score
  const newDistScore = Math.floor(world.dist/90);
  if (newDistScore > hero.distScore) {
    hero.score += (newDistScore-hero.distScore)*5;
    hero.distScore = newDistScore;
  }

  // Move obstacles
  obstacles.forEach(o => { o.x-=world.speed*dt; });
  const lastObs = obstacles[obstacles.length-1];
  const minGap  = Math.max(180, 320-world.time*2);
  if (!lastObs || lastObs.x < canvasW-minGap-Math.random()*180) spawnObstacle();

  // Move ramps
  ramps.forEach(r => { r.x-=world.speed*dt; });
  const lastRamp = ramps[ramps.length-1];
  if (!lastRamp || lastRamp.x < canvasW-480-Math.random()*320) spawnRamp();

  // Move stars
  stars.forEach(s => { s.x-=world.speed*dt; s.pulse+=dt*4; });
  const lastStar = stars[stars.length-1];
  if (!lastStar || lastStar.x < canvasW-130-Math.random()*110) spawnStar();

  // Collisions — obstacles
  if (hero.invincible<=0) {
    for (const obs of obstacles) {
      if (rectsOverlap(hero.x+4, heroTop+2, hero.w-8, heroH-4,
                       obs.x+3, obs.y, obs.w-6, obs.h)) {
        hero.invincible = 1.6;
        hero.energy--;
        hero.combo = 0;
        spawnParticles(hero.x+hero.w/2, hero.y, '#EF4444', 10);
        showMessage(['💥 Ai!','😵 Eita!','🤕 Cuidado!'][Math.floor(Math.random()*3)]);
        updateEnergyUI();
        shakeScreen();
        if (hero.energy<=0) hero.energy=0;
        break;
      }
    }
  }

  // Ramp detection
  hero.onRamp = false;
  for (const r of ramps) {
    if (hero.x+hero.w>r.x && hero.x<r.x+r.w && hero.isGrounded) { hero.onRamp=true; break; }
  }

  // Collect stars
  stars.forEach(s => {
    if (s.collected) return;
    if (rectsOverlap(hero.x, hero.y, hero.w, hero.h, s.x-s.r, s.y-s.r, s.r*2, s.r*2)) {
      s.collected = true;
      const bonus = 50+hero.combo*15;
      hero.score += bonus;
      hero.combo++;
      spawnParticles(s.x, s.y, '#FFD43B', 7);
      if (hero.combo>=5)       showMessage('🔥🔥 COMBO x'+hero.combo+'!!');
      else if (hero.combo>=3)  showMessage('🔥 Combo x'+hero.combo+'!');
      else                     showMessage('⭐ +'+bonus+'!');
    }
  });

  // Cleanup
  obstacles = obstacles.filter(o=>o.x+o.w>-10);
  ramps     = ramps.filter(r=>r.x+r.w>-10);
  stars     = stars.filter(s=>s.x+s.r>-10&&!s.collected);

  // Particles
  particles.forEach(p=>{
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=320*dt; p.life-=dt/p.maxLife;
  });
  particles = particles.filter(p=>p.life>0);

  // Background
  bgElements.forEach(bg => { bg.x-=world.speed*bg.speed*dt; });
  bgElements = bgElements.filter(bg=>bg.x>-120);
  if (bgElements.length<6) bgElements.push(makeBgElement(canvasW+60+Math.random()*200));

  // Bots (offline only — online bots are on server)
  if (!isOnline) updateBots(dt, timeLeft);

  // Send score to server
  if (isOnline && socket && Math.floor(world.time*2)%1===0) {
    socket.emit('scoreUpdate', { score: Math.floor(hero.score) });
  }

  updateRankDisplay();
}

function rectsOverlap(ax,ay,aw,ah,bx,by,bw,bh) {
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}

function updateBots(dt, timeLeft) {
  players.forEach(p=>{
    if (p.isHuman) return;
    const b = p.behavior;
    let rate = b.baseScore+(Math.random()-0.5)*b.variance;
    if (b.surgeEnd&&timeLeft<20) rate*=2.4;
    if (rate<0) rate=0;
    p.score+=rate*dt*10;
  });
}

function updateRankDisplay() {
  const humanP = players.find(p=>p.isHuman);
  if (humanP) humanP.score = hero.score;

  const sorted = [...players].sort((a,b)=>b.score-a.score);
  const pos    = sorted.findIndex(p=>p.isHuman)+1;
  document.getElementById('hud-rank').textContent = pos+'º';

  const mini = document.getElementById('game-mini-rank');
  mini.innerHTML = sorted.slice(0,5).map((p,i)=>`
    <div class="mini-rank-row ${p.isHuman?'mini-rank-you':''}">
      <span class="mini-rank-pos">${i+1}</span>
      <span>${p.emoji}</span>
      <span class="mini-rank-name">${p.name}</span>
      <span class="mini-rank-pts">${Math.floor(p.score)}</span>
    </div>`).join('');
}

// ============================================================
// RENDER
// ============================================================
function render() {
  if (!ctx) return;
  ctx.clearRect(0,0,canvasW,canvasH);

  // Sky
  const sg = ctx.createLinearGradient(0,0,0,canvasH);
  sg.addColorStop(0,'#2196F3'); sg.addColorStop(0.45,'#81D4FA');
  sg.addColorStop(0.7,'#FFF9C4'); sg.addColorStop(1,'#FFE082');
  ctx.fillStyle=sg; ctx.fillRect(0,0,canvasW,canvasH);

  // Ocean strip
  ctx.fillStyle='#0288D1';
  ctx.fillRect(0,canvasH*0.52,canvasW,canvasH*0.1);

  renderBgElements();
  renderGround();
  ramps.forEach(renderRamp);
  stars.forEach(renderStar);
  obstacles.forEach(renderObstacle);
  renderParticles();
  renderHero();
}

function renderBgElements() {
  bgElements.forEach(bg=>{
    ctx.save(); ctx.globalAlpha=0.65;
    const sz=22*bg.size;
    switch(bg.type) {
      case 'cloud':
        ctx.fillStyle='rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.ellipse(bg.x,bg.y,sz*2.2,sz*0.7,0,0,Math.PI*2);
        ctx.ellipse(bg.x-sz*0.9,bg.y+sz*0.2,sz*1.3,sz*0.55,0,0,Math.PI*2);
        ctx.ellipse(bg.x+sz*0.9,bg.y+sz*0.2,sz*1.1,sz*0.55,0,0,Math.PI*2);
        ctx.fill(); break;
      case 'seagull':
        ctx.strokeStyle='#546E7A'; ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(bg.x-sz,bg.y);
        ctx.quadraticCurveTo(bg.x-sz/2,bg.y-sz/3,bg.x,bg.y);
        ctx.quadraticCurveTo(bg.x+sz/2,bg.y-sz/3,bg.x+sz,bg.y);
        ctx.stroke(); break;
      case 'palm':
        ctx.fillStyle='#8D6E63';
        ctx.fillRect(bg.x-5,bg.y,10,40);
        ctx.font=`${sz*1.8}px serif`; ctx.textAlign='center';
        ctx.fillText('🌴',bg.x,bg.y+8); break;
      case 'flag':
        ctx.fillStyle='#B0BEC5';
        ctx.fillRect(bg.x,bg.y,3,30);
        ctx.fillStyle=bg.x%60>30?'#F44336':'#2196F3';
        ctx.fillRect(bg.x+3,bg.y,18,12); break;
    }
    ctx.restore();
  });
}

function renderGround() {
  // Sand
  const sg=ctx.createLinearGradient(0,groundY,0,canvasH);
  sg.addColorStop(0,'#FFE082'); sg.addColorStop(1,'#FFB300');
  ctx.fillStyle=sg; ctx.fillRect(0,groundY,canvasW,canvasH-groundY);

  // Boardwalk
  ctx.fillStyle='#ECEFF1'; ctx.fillRect(0,groundY,canvasW,11);
  const tW=55, off=world.dist%tW;
  ctx.fillStyle='#CFD8DC';
  for(let x=-off;x<canvasW+tW;x+=tW) ctx.fillRect(x,groundY,2,11);
  ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(0,groundY+11,canvasW,4);
}

function renderRamp(r) {
  ctx.save();
  const rg=ctx.createLinearGradient(r.x,groundY-r.h,r.x+r.w,groundY);
  rg.addColorStop(0,'#E0E0E0'); rg.addColorStop(1,'#BDBDBD');
  ctx.fillStyle=rg;
  ctx.beginPath();
  ctx.moveTo(r.x,groundY); ctx.lineTo(r.x+r.w,groundY);
  ctx.lineTo(r.x+r.w*0.65,groundY-r.h); ctx.lineTo(r.x,groundY);
  ctx.fill();
  ctx.strokeStyle='#9E9E9E'; ctx.lineWidth=1.5; ctx.stroke();

  if (hero.x>r.x-60&&hero.x<r.x+r.w+60) {
    ctx.fillStyle='rgba(249,115,22,0.9)';
    ctx.font='bold 12px Nunito'; ctx.textAlign='center';
    ctx.fillText('↑ TRICK!', r.x+r.w/2, groundY-r.h-8);
  }
  ctx.restore();
}

function renderStar(s) {
  const p=0.88+Math.sin(s.pulse)*0.12;
  ctx.save();
  ctx.globalAlpha=0.92+Math.sin(s.pulse)*0.08;
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=14;
  ctx.font=`${s.r*2*p}px serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⭐',s.x,s.y);
  ctx.restore();
}

function renderObstacle(obs) {
  ctx.save();
  ctx.font=`${obs.h+6}px serif`;
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText(obs.emoji, obs.x+obs.w/2, obs.y+obs.h+6);
  ctx.restore();
}

function renderParticles() {
  particles.forEach(p=>{
    ctx.save(); ctx.globalAlpha=Math.max(0,p.life);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

function renderHero() {
  const { x,y,w,h,isDucking,invincible,isGrounded,onRamp } = hero;
  const aH  = isDucking ? h*0.5 : h;
  const aY  = isDucking ? y+h*0.5 : y;
  const char = humanPlayer||CHARACTERS[0];

  ctx.save();
  if (invincible>0&&Math.floor(invincible*9)%2===0) ctx.globalAlpha=0.35;

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(x+w/2,groundY+4,w*0.45,5,0,0,Math.PI*2); ctx.fill();

  // Wheels
  ctx.fillStyle='#263238';
  ctx.beginPath(); ctx.arc(x+8,aY+aH,6.5,0,Math.PI*2); ctx.arc(x+w-8,aY+aH,6.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(x+8-1.5,aY+aH-1.5,3,0,Math.PI*2); ctx.arc(x+w-8-1.5,aY+aH-1.5,3,0,Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle=char.color;
  ctx.beginPath(); ctx.roundRect(x+4,aY,w-8,aH-9,6); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(x+4,aY+9,w-8,5);

  // Head
  const hSz = isDucking ? 14 : 18;
  ctx.fillStyle='#FFCC80';
  ctx.beginPath(); ctx.arc(x+w/2, aY-hSz*0.35, hSz*0.65, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#1A237E';
  ctx.beginPath(); ctx.arc(x+w/2-4.5,aY-hSz*0.35,2.2,0,Math.PI*2); ctx.arc(x+w/2+4.5,aY-hSz*0.35,2.2,0,Math.PI*2); ctx.fill();

  // Char emoji above
  ctx.font='16px serif'; ctx.textAlign='center';
  ctx.fillText(char.emoji, x+w/2, aY-32);

  ctx.restore();
}

// ============================================================
// CONTROLS
// ============================================================
function handleJump() {
  if (hero.isGrounded && hero.energy>0) {
    hero.vy=-530; hero.isGrounded=false; hero.combo=0;
  }
}
function handleDuck(active) { hero.isDucking=active; }
function handleTrick() {
  if (hero.onRamp && hero.trickCooldown<=0) {
    handleJump();
    hero.trickCooldown=1.4;
    const msgs=['🤙 Radical!','🔥 Manobra!','✨ Perfeito!','💥 Incrível!','🌊 Show!'];
    const pts=120+hero.combo*25;
    hero.score+=pts; hero.combo++;
    showMessage(msgs[Math.floor(Math.random()*msgs.length)]+' +'+pts);
    spawnParticles(hero.x+hero.w/2,hero.y,char()?.color||'#F97316',14);
  } else if (!hero.isGrounded===false) {
    handleJump();
  }
}
function char() { return humanPlayer||CHARACTERS[0]; }

function setupTouchControls() {
  canvas.addEventListener('touchstart', e=>{
    e.preventDefault();
    touchStartY=e.touches[0].clientY;
    touchStartX=e.touches[0].clientX;
    handleJump();
  },{ passive:false });
  canvas.addEventListener('touchend', e=>{
    e.preventDefault();
    const dy=touchStartY-e.changedTouches[0].clientY;
    if (dy>50) handleTrick();
    if (dy<-50) handleDuck(false);
    handleDuck(false);
  },{ passive:false });
  canvas.addEventListener('click', ()=>handleJump());
}
function setupKeyboard() {
  document.addEventListener('keydown', e=>{
    if (!document.getElementById('screen-game').classList.contains('active')) return;
    if (e.code==='Space'||e.code==='ArrowUp') {
      e.preventDefault();
      if (e.code==='ArrowUp'&&hero.onRamp) handleTrick(); else handleJump();
    }
    if (e.code==='ArrowDown') { e.preventDefault(); handleDuck(true); }
  });
  document.addEventListener('keyup', e=>{
    if (e.code==='ArrowDown') handleDuck(false);
  });
}

// ============================================================
// UI HELPERS
// ============================================================
function updateEnergyUI() {
  const hearts = document.getElementById('energy-hearts');
  if (hearts) {
    hearts.innerHTML = Array(hero.maxEnergy).fill(0).map((_,i)=>
      `<span style="opacity:${i<hero.energy?1:0.2}">❤️</span>`
    ).join('');
  }
}

let msgTimeout;
function showMessage(text) {
  const el=document.getElementById('game-message');
  el.textContent=text; el.classList.add('show');
  clearTimeout(msgTimeout);
  msgTimeout=setTimeout(()=>el.classList.remove('show'),1500);
}
function showToast(text) { showMessage(text); }

function shakeScreen() {
  const el=document.getElementById('screen-game');
  el.style.transform='translateX(-7px)';
  setTimeout(()=>{el.style.transform='translateX(7px)';},55);
  setTimeout(()=>{el.style.transform='translateX(-4px)';},110);
  setTimeout(()=>{el.style.transform='translateX(0)';},165);
}

// ============================================================
// RESULT
// ============================================================
function showResult() {
  if (gameLoop) { cancelAnimationFrame(gameLoop); gameLoop=null; }

  const humanP=players.find(p=>p.isHuman);
  if (humanP) humanP.score=hero.score;

  const sorted=[...players].sort((a,b)=>b.score-a.score);
  const pos=sorted.findIndex(p=>p.isHuman)+1;

  // Best score
  const best=parseInt(localStorage.getItem('beachgames_best')||'0');
  const isRecord=hero.score>best;
  if (isRecord) localStorage.setItem('beachgames_best',hero.score);

  // Medal
  let medal='🎖️',medalName='Participação';
  if (pos===1) {medal='🏆';medalName='Lenda da Praia!';} 
  else if (pos===2) {medal='🥈';medalName='Vice-Campeão';} 
  else if (pos===3) {medal='🥉';medalName='3º Lugar';}
  else if (pos<=5)  {medal='🌟';medalName='Top 5';}

  document.getElementById('result-medal').textContent   = medal;
  document.getElementById('result-title').textContent   = medalName;
  document.getElementById('result-subtitle').textContent = isRecord
    ? '🎉 Novo recorde pessoal: '+Math.floor(hero.score)+' pts!'
    : `Você ficou em ${pos}º lugar de ${players.length} jogadores`;

  // Podium
  const [p1,p2,p3]=[sorted[0],sorted[1],sorted[2]];
  document.getElementById('podium-wrap').innerHTML=`
    <div class="podium-slot p2nd">
      <div class="podium-avatar" style="background:${p2?.color||'#94A3B8'}33">${p2?.emoji||'?'}</div>
      <div class="podium-name">${p2?.name||'-'}</div>
      <div class="podium-pts">${Math.floor(p2?.score||0)} pts</div>
      <div class="podium-base">🥈</div>
    </div>
    <div class="podium-slot p1st">
      <div class="podium-avatar" style="background:${p1?.color||'#FFD43B'}33">${p1?.emoji||'?'}</div>
      <div class="podium-name">${p1?.name||'-'}</div>
      <div class="podium-pts">${Math.floor(p1?.score||0)} pts</div>
      <div class="podium-base">🥇</div>
    </div>
    <div class="podium-slot p3rd">
      <div class="podium-avatar" style="background:${p3?.color||'#D97706'}33">${p3?.emoji||'?'}</div>
      <div class="podium-name">${p3?.name||'-'}</div>
      <div class="podium-pts">${Math.floor(p3?.score||0)} pts</div>
      <div class="podium-base">🥉</div>
    </div>`;

  const medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  document.getElementById('result-full-rank').innerHTML=sorted.map((p,i)=>`
    <div class="rank-row ${p.isHuman?'you-row':''}">
      <div class="rank-pos">${i+1}º</div>
      <div class="rank-avatar-small" style="background:${p.color}33">${p.emoji}</div>
      <div class="rank-name">${p.name}${p.isHuman?' 👈':''}</div>
      <div class="rank-pts">${Math.floor(p.score)} pts</div>
      <div class="rank-medal">${medals[i]||''}</div>
    </div>`).join('');

  document.getElementById('result-stats').innerHTML=`
    <div class="stat-chip"><div class="stat-chip-val">${Math.floor(hero.score)}</div><div class="stat-chip-label">PONTOS</div></div>
    <div class="stat-chip"><div class="stat-chip-val">${pos}º</div><div class="stat-chip-label">LUGAR</div></div>
    <div class="stat-chip"><div class="stat-chip-val">${hero.maxEnergy-hero.energy}</div><div class="stat-chip-label">QUEDAS</div></div>
    <div class="stat-chip"><div class="stat-chip-val">${Math.floor(world.dist/10)}m</div><div class="stat-chip-label">DISTÂNCIA</div></div>`;

  showScreen('result');
}

function playAgain() {
  players.forEach(p=>{p.score=0;});
  runCountdown();
}

function inviteFriends() {
  const code = currentRoomCode||'PRAIA82';
  const text=`🏖️ Beach Games 2026!\nJogue comigo agora!\nCódigo: ${code}\nLink: beachgames.app/sala/${code}`;
  navigator.share?.({title:'Beach Games 2026',text}).catch(()=>{});
  navigator.clipboard?.writeText(text);
  showToast('📲 Convite copiado!');
}

function updateHomeBestScore() {
  const best=localStorage.getItem('beachgames_best');
  const el=document.getElementById('home-best-score');
  if (el&&best) el.textContent='🏆 Recorde: '+best+' pontos';
}
