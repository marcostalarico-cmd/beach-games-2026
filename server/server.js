// ============================================================
// BEACH GAMES 2026 — server.js
// Servidor multiplayer com Socket.io
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ===== CORS — permite qualquer origem em dev, ajuste em produção =====
app.use(cors());
app.use(express.json());

// ===== Serve os arquivos do cliente =====
app.use(express.static(path.join(__dirname, '../client')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ===== Socket.io =====
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10000,
  pingInterval: 5000,
});

// ===== ESTADO DAS SALAS =====
const rooms = new Map();
// Estrutura de uma sala:
// {
//   code: 'PRAIA82',
//   hostId: socketId,
//   status: 'lobby' | 'countdown' | 'playing' | 'finished',
//   players: Map<socketId, playerData>,
//   bots: [],
//   startTime: null,
//   gameDuration: 90,
//   scoreInterval: null,
// }

const GAME_DURATION = 90; // segundos
const MAX_PLAYERS = 9;

const BOT_NAMES = ['Leo','Maya','Theo','Ben','Zara','Nick','Lia','Max','Ivy','Tom','Jade','Rafa','Dani'];
const BOT_EMOJIS = ['🤖','🦊','🐻','🦁','🐯','🦅','🐬','🦋','🐙','🦖','🦩','🐺','🦝'];
const BOT_BEHAVIORS = [
  { type:'rookie',     baseScore:4,  variance:6,  surgeEnd:false },
  { type:'balanced',   baseScore:7,  variance:4,  surgeEnd:false },
  { type:'aggressive', baseScore:9,  variance:8,  surgeEnd:false },
  { type:'clumsy',     baseScore:5,  variance:10, surgeEnd:false },
  { type:'finisher',   baseScore:6,  variance:3,  surgeEnd:true  },
  { type:'steady',     baseScore:8,  variance:2,  surgeEnd:false },
  { type:'wildcard',   baseScore:5,  variance:12, surgeEnd:false },
  { type:'ghost',      baseScore:10, variance:1,  surgeEnd:false },
];
const CHAR_COLORS = ['#FFD43B','#0EA5E9','#8B5CF6','#10B981','#F97316','#EF4444','#EC4899','#14B8A6'];

// ===== GERAR CÓDIGO =====
function generateRoomCode() {
  const words = ['PRAIA','ONDA','SURF','AREIA','SOL','MAR','VENTO','AZUL','VERÃO','REEF'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return word + num;
}

function uniqueCode() {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));
  return code;
}

// ===== PREENCHER COM BOTS =====
function fillBots(room) {
  const humanCount = room.players.size;
  const needed = MAX_PLAYERS - humanCount;
  room.bots = [];

  const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const shuffledBehaviors = [...BOT_BEHAVIORS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < needed; i++) {
    room.bots.push({
      id: `bot_${i}`,
      name: 'Bot ' + shuffledNames[i % shuffledNames.length],
      emoji: BOT_EMOJIS[i % BOT_EMOJIS.length],
      color: CHAR_COLORS[(i + 3) % CHAR_COLORS.length],
      isBot: true,
      score: 0,
      behavior: shuffledBehaviors[i % shuffledBehaviors.length],
    });
  }
}

// ===== ATUALIZAR BOTS =====
function tickBots(room) {
  const elapsed = (Date.now() - room.startTime) / 1000;
  const timeLeft = Math.max(0, GAME_DURATION - elapsed);
  const dt = 0.5; // intervalo do setInterval em segundos

  room.bots.forEach(bot => {
    const b = bot.behavior;
    let rate = b.baseScore + (Math.random() - 0.5) * b.variance;
    if (b.surgeEnd && timeLeft < 20) rate *= 2.5;
    if (rate < 0) rate = 0;
    bot.score += rate * dt * 10;
  });
}

// ===== SNAPSHOT DA SALA (para clientes) =====
function roomSnapshot(room) {
  const players = [];
  room.players.forEach((p, id) => {
    players.push({ id, name: p.name, emoji: p.emoji, color: p.color, score: p.score, isBot: false });
  });
  room.bots.forEach(b => {
    players.push({ id: b.id, name: b.name, emoji: b.emoji, color: b.color, score: b.score, isBot: true });
  });
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players,
    playerCount: room.players.size,
    botCount: room.bots.length,
  };
}

// ===== RANKING =====
function buildRanking(room) {
  const all = [];
  room.players.forEach((p, id) => {
    all.push({ id, name: p.name, emoji: p.emoji, color: p.color, score: Math.floor(p.score), isBot: false });
  });
  room.bots.forEach(b => {
    all.push({ id: b.id, name: b.name, emoji: b.emoji, color: b.color, score: Math.floor(b.score), isBot: true });
  });
  return all.sort((a, b) => b.score - a.score);
}

// ===== SOCKET EVENTS =====
io.on('connection', (socket) => {
  console.log(`[+] Conectado: ${socket.id}`);

  // ----- CREATE ROOM -----
  socket.on('createRoom', ({ playerName, emoji, color }) => {
    const code = uniqueCode();
    const room = {
      code,
      hostId: socket.id,
      status: 'lobby',
      players: new Map(),
      bots: [],
      startTime: null,
      scoreInterval: null,
      gameDuration: GAME_DURATION,
    };

    room.players.set(socket.id, {
      name: playerName || 'Você',
      emoji: emoji || '😎',
      color: color || '#F97316',
      score: 0,
    });

    fillBots(room);
    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;

    socket.emit('roomCreated', { code, snapshot: roomSnapshot(room) });
    console.log(`[ROOM] Criada: ${code} por ${socket.id}`);
  });

  // ----- JOIN ROOM -----
  socket.on('joinRoom', ({ code, playerName, emoji, color }) => {
    const room = rooms.get(code.toUpperCase());

    if (!room) {
      socket.emit('joinError', { message: 'Sala não encontrada!' });
      return;
    }
    if (room.status !== 'lobby') {
      socket.emit('joinError', { message: 'Partida já em andamento!' });
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      socket.emit('joinError', { message: 'Sala cheia!' });
      return;
    }

    // Remove um bot para dar espaço ao jogador real
    if (room.bots.length > 0) room.bots.pop();

    room.players.set(socket.id, {
      name: playerName || 'Jogador',
      emoji: emoji || '🌊',
      color: color || '#0EA5E9',
      score: 0,
    });

    socket.join(code);
    socket.roomCode = code;

    socket.emit('joinedRoom', { code, snapshot: roomSnapshot(room) });
    io.to(code).emit('lobbyUpdate', roomSnapshot(room));
    console.log(`[ROOM] ${playerName} entrou em ${code}`);
  });

  // ----- START GAME -----
  socket.on('startGame', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || socket.id !== room.hostId) return;
    if (room.status !== 'lobby') return;

    room.status = 'countdown';
    io.to(room.code).emit('gameCountdown', { snapshot: roomSnapshot(room) });

    // Aguarda countdown (3s) + "GO" (1s) = 4s
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      room.status = 'playing';
      room.startTime = Date.now();
      io.to(room.code).emit('gameStart', { snapshot: roomSnapshot(room) });

      // Tick de bots a cada 500ms
      room.scoreInterval = setInterval(() => {
        if (!rooms.has(room.code)) return;
        const elapsed = (Date.now() - room.startTime) / 1000;

        if (elapsed >= GAME_DURATION) {
          clearInterval(room.scoreInterval);
          room.status = 'finished';
          const ranking = buildRanking(room);
          io.to(room.code).emit('gameOver', { ranking });
          setTimeout(() => rooms.delete(room.code), 60000);
          return;
        }

        tickBots(room);
        const ranking = buildRanking(room);
        io.to(room.code).emit('rankUpdate', { ranking, elapsed });
      }, 500);

      console.log(`[GAME] Iniciada: ${room.code}`);
    }, 4000);
  });

  // ----- SCORE UPDATE (do cliente) -----
  socket.on('scoreUpdate', ({ score }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player) player.score = score;
  });

  // ----- DISCONNECT -----
  socket.on('disconnect', () => {
    console.log(`[-] Desconectado: ${socket.id}`);
    const room = rooms.get(socket.roomCode);
    if (!room) return;

    room.players.delete(socket.id);

    if (room.players.size === 0) {
      // Sala vazia — limpar
      if (room.scoreInterval) clearInterval(room.scoreInterval);
      rooms.delete(room.code);
      console.log(`[ROOM] Removida: ${room.code} (vazia)`);
      return;
    }

    // Transferir host se necessário
    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value;
    }

    // Repor com bot se ainda no lobby
    if (room.status === 'lobby') {
      fillBots(room);
      io.to(room.code).emit('lobbyUpdate', roomSnapshot(room));
    } else {
      io.to(room.code).emit('playerLeft', { playerId: socket.id, snapshot: roomSnapshot(room) });
    }
  });

  // ----- PING (keep-alive) -----
  socket.on('ping', () => socket.emit('pong'));
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🏖️  Beach Games 2026 — Servidor rodando na porta ${PORT}`);
  console.log(`   Acesse: http://localhost:${PORT}\n`);
});
