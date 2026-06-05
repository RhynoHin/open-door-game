const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const roomEntry = document.getElementById("room-entry");
const roomInput = document.getElementById("room-input");
const statusPill = document.getElementById("status-pill");
const toast = document.getElementById("toast");
const audioBtn = document.getElementById("audio-btn");

const DPR_LIMIT = 2;
const MAX_HAND = 5;
const WIN_SCORE = 3;

const wrestlers = [
  { name: "Hangman Heart", style: "Cowboy striker", color: "#ffd166", finisher: "Buckshot Burst" },
  { name: "Moxley Road", style: "Wild brawler", color: "#ef476f", finisher: "Paradigm Crash" },
  { name: "Storm Toniq", style: "Cinema champion", color: "#f8fbff", finisher: "Spotlight Snap" },
  { name: "Orange Voltage", style: "Lazy genius", color: "#ff9f1c", finisher: "Pocket Pop" },
  { name: "Jade Titan", style: "Powerhouse", color: "#06d6a0", finisher: "That Storm" },
  { name: "Omega Spark", style: "Elite technician", color: "#4cc9f0", finisher: "One Wing Flash" },
];

const cardLibrary = [
  { id: "chop", name: "Knife-edge Chop", type: "strike", power: 4, hype: 1, text: "快招。贏 counter，多 1 hype。", beats: ["counter"] },
  { id: "suplex", name: "Snap Suplex", type: "grapple", power: 5, hype: 1, text: "穩陣中招。贏 strike。", beats: ["strike"] },
  { id: "dive", name: "Top-rope Dive", type: "risk", power: 7, hype: 2, text: "高風險。贏 grapple，輸 counter 會食 backlash。", beats: ["grapple"] },
  { id: "counter", name: "Reversal", type: "counter", power: 3, hype: 2, text: "反擊。贏 risk 同 taunt。", beats: ["risk", "taunt"] },
  { id: "taunt", name: "Crowd Taunt", type: "taunt", power: 1, hype: 4, text: "搶氣勢。輸 strike，贏 grapple。", beats: ["grapple"] },
  { id: "table", name: "Tables Spot", type: "risk", power: 8, hype: 1, text: "大型 spot。平手時雙方都扣血。", beats: ["grapple", "taunt"] },
  { id: "chain", name: "Chain Wrestling", type: "grapple", power: 4, hype: 3, text: "技術壓制。贏 strike。", beats: ["strike"] },
  { id: "promo", name: "Hot Promo", type: "taunt", power: 2, hype: 5, text: "咪高峰攻勢。輸 counter。", beats: ["grapple"] },
  { id: "lariat", name: "Rolling Lariat", type: "strike", power: 6, hype: 0, text: "重擊。贏 counter。", beats: ["counter"] },
  { id: "save", name: "Manager Save", type: "counter", power: 2, hype: 3, text: "護主救場。贏 risk。", beats: ["risk"] },
];

const state = {
  view: "menu",
  mode: "menu",
  online: false,
  room: "",
  seat: null,
  peers: 0,
  connected: false,
  phase: "menu",
  round: 1,
  turnPlayer: 0,
  players: [],
  hands: [[], []],
  deckCursor: 0,
  picks: [null, null],
  log: [],
  effects: [],
  buttons: [],
  toastUntil: 0,
  lastWinner: null,
  waitingOnline: false,
  seed: 0,
};

let socket = null;
let audio = null;
let musicTimer = 0;
let musicOn = false;
let lastTime = performance.now();
let virtualNow = 0;

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  const w = Math.max(320, window.innerWidth);
  const h = Math.max(480, window.innerHeight);
  canvas.width = Math.floor(w * ratio);
  canvas.height = Math.floor(h * ratio);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rnd(seed) {
  let value = seed || 1234567;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function buildDeck(seed) {
  const random = rnd(seed);
  const deck = [];
  for (let i = 0; i < 4; i += 1) {
    for (const card of cardLibrary) deck.push(card.id);
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardById(id) {
  return cardLibrary.find((card) => card.id === id) || cardLibrary[0];
}

function freshMatch(mode, seed = Date.now()) {
  const deck = buildDeck(seed);
  const random = rnd(seed + 99);
  const p0 = wrestlers[Math.floor(random() * wrestlers.length)];
  let p1 = wrestlers[Math.floor(random() * wrestlers.length)];
  if (p1.name === p0.name) p1 = wrestlers[(wrestlers.indexOf(p0) + 2) % wrestlers.length];

  Object.assign(state, {
    view: "game",
    mode,
    phase: "pick",
    round: 1,
    turnPlayer: 0,
    players: [
      makePlayer(p0, "Player 1"),
      makePlayer(p1, "Player 2"),
    ],
    hands: [[], []],
    deck,
    deckCursor: 0,
    picks: [null, null],
    log: ["Bell rings. 揀卡出招。"],
    effects: [],
    lastWinner: null,
    waitingOnline: false,
    seed,
  });

  drawCards(0, MAX_HAND);
  drawCards(1, MAX_HAND);
  menu.classList.add("hidden");
  roomEntry.classList.add("hidden");
  showToast(mode === "offline" ? "Offline hot-seat：輪流揀卡，唔好偷睇。" : "Online match ready.");
  syncStatus();
  pulse("bell", 16);
  sfx("bell");
  publishState("start");
}

function makePlayer(wrestler, label) {
  return {
    label,
    name: wrestler.name,
    style: wrestler.style,
    color: wrestler.color,
    finisher: wrestler.finisher,
    hp: 24,
    hype: 0,
    score: 0,
    pin: 0,
  };
}

function drawCards(player, count) {
  while (state.hands[player].length < MAX_HAND && count > 0) {
    if (state.deckCursor >= state.deck.length) state.deckCursor = 0;
    state.hands[player].push(state.deck[state.deckCursor]);
    state.deckCursor += 1;
    count -= 1;
  }
}

function showToast(message, duration = 2600) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  state.toastUntil = performance.now() + duration;
}

function syncStatus() {
  if (state.online) {
    const role = state.seat == null ? "Spectator" : `P${state.seat + 1}`;
    statusPill.textContent = `${state.room || "Room"} | ${role} | ${state.peers}/2 online`;
  } else {
    statusPill.textContent = state.phase === "menu" ? "Menu" : `Offline | Round ${state.round}`;
  }
}

function cardOutcome(a, b) {
  if (a.type === b.type) return 0;
  if (a.beats.includes(b.type)) return 0;
  if (b.beats.includes(a.type)) return 1;
  return a.power + a.hype >= b.power + b.hype ? 0 : 1;
}

function selectCard(player, handIndex) {
  if (state.phase !== "pick") return;
  if (state.online && player !== state.seat) return;
  if (!state.online && player !== state.turnPlayer) return;
  if (state.picks[player] != null) return;

  state.picks[player] = handIndex;
  pulse("select", 8);
  sfx("tap");

  if (state.online) {
    send({ type: "action", action: { kind: "pick", player, round: state.round, handIndex } });
    state.waitingOnline = state.picks[1 - player] == null;
  } else {
    state.turnPlayer = 1 - state.turnPlayer;
    if (state.picks[state.turnPlayer] == null) showToast(`${state.players[state.turnPlayer].label} 揀卡`);
  }

  if (state.picks[0] != null && state.picks[1] != null) resolveRound();
  syncStatus();
}

function resolveRound() {
  state.phase = "reveal";
  state.waitingOnline = false;

  const cards = [0, 1].map((player) => cardById(state.hands[player][state.picks[player]]));
  const winner = cardOutcome(cards[0], cards[1]);
  const loser = 1 - winner;
  const tie = cards[0].type === cards[1].type;
  const damage = tie ? Math.max(2, Math.floor((cards[0].power + cards[1].power) / 2)) : cards[winner].power + Math.floor(state.players[winner].hype / 3);

  state.players[0].hype = clamp(state.players[0].hype + cards[0].hype, 0, 12);
  state.players[1].hype = clamp(state.players[1].hype + cards[1].hype, 0, 12);

  if (tie) {
    state.players[0].hp = clamp(state.players[0].hp - damage, 0, 24);
    state.players[1].hp = clamp(state.players[1].hp - damage, 0, 24);
    state.log.unshift(`Double impact! ${cards[0].name} vs ${cards[1].name}，雙方各扣 ${damage}。`);
    pulse("clash", 30);
  } else {
    state.players[loser].hp = clamp(state.players[loser].hp - damage, 0, 24);
    state.players[winner].hype = clamp(state.players[winner].hype + 1, 0, 12);
    state.players[winner].pin += state.players[loser].hp <= 0 ? 2 : 1;
    state.lastWinner = winner;
    state.log.unshift(`${state.players[winner].name} 用 ${cards[winner].name} 壓過 ${cards[loser].name}，扣 ${damage}！`);
    pulse(winner === 0 ? "left" : "right", 36);
  }

  if (!tie && state.players[winner].hype >= 10) {
    state.players[loser].hp = clamp(state.players[loser].hp - 4, 0, 24);
    state.players[winner].hype = 4;
    state.log.unshift(`${state.players[winner].finisher}! 全場爆響，再扣 4。`);
    pulse("finisher", 54);
    sfx("finisher");
  } else {
    sfx(tie ? "slam" : "hit");
  }

  state.hands[0].splice(state.picks[0], 1);
  state.hands[1].splice(state.picks[1], 1);
  state.picks = [null, null];
  drawCards(0, 1);
  drawCards(1, 1);

  const matchWinner = getMatchWinner();
  if (matchWinner != null) {
    state.players[matchWinner].score += 1;
    state.phase = state.players[matchWinner].score >= WIN_SCORE ? "gameover" : "between";
    state.log.unshift(`${state.players[matchWinner].name} scores the fall!`);
    showToast(state.phase === "gameover" ? `${state.players[matchWinner].name} 贏出成場比賽！` : "Pinfall! 下一 fall 準備。", 3200);
  } else {
    state.phase = "between";
  }

  publishState("resolve");
  setTimeout(() => {
    if (state.phase === "between") nextRound();
  }, 1650);
}

function getMatchWinner() {
  if (state.players[0].hp <= 0 && state.players[1].hp <= 0) return state.lastWinner ?? 0;
  if (state.players[0].hp <= 0 || state.players[1].pin >= 3) return 1;
  if (state.players[1].hp <= 0 || state.players[0].pin >= 3) return 0;
  return null;
}

function nextRound() {
  if (state.phase !== "between") return;
  state.round += 1;
  state.turnPlayer = state.online ? state.seat ?? 0 : 0;
  state.phase = "pick";
  state.players.forEach((player) => {
    player.hp = clamp(player.hp + 4, 0, 24);
    player.pin = 0;
  });
  state.log.unshift(`Round ${state.round}: 雙方喘一口氣，再開波。`);
  publishState("round");
  syncStatus();
}

function resetToMenu() {
  state.view = "menu";
  state.phase = "menu";
  state.online = false;
  state.connected = false;
  state.seat = null;
  state.room = "";
  if (socket) socket.close();
  socket = null;
  menu.classList.remove("hidden");
  roomEntry.classList.add("hidden");
  syncStatus();
}

function startOffline() {
  state.online = false;
  freshMatch("offline", Date.now());
}

function startOnline(hosting) {
  const requested = hosting ? "" : roomInput.value.trim().toUpperCase();
  const query = requested ? `?room=${encodeURIComponent(requested)}` : "";
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws${query}`);
  state.online = true;
  state.mode = hosting ? "online-host" : "online-join";
  statusPill.textContent = "Connecting...";

  socket.addEventListener("open", () => {
    state.connected = true;
    showToast("已連線。等齊兩個玩家就可以打。");
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "welcome") {
      state.room = message.room;
      state.seat = message.seat;
      state.peers = message.peers;
      if (state.seat == null) showToast("房滿，你而家係觀眾。");
      syncStatus();
      if (!message.hasState && state.seat === 0) freshMatch("online", Date.now());
    }
    if (message.type === "peer") {
      state.peers = message.peers;
      syncStatus();
      if (state.peers < 2) showToast(`Room ${state.room}: 等另一位玩家。`, 2200);
    }
    if (message.type === "state" && message.state) {
      applyRemoteState(message.state);
    }
    if (message.type === "action" && message.action) {
      applyRemoteAction(message.action);
    }
  });

  socket.addEventListener("close", () => {
    state.connected = false;
    syncStatus();
    showToast("Online 連線已中斷。");
  });
}

function send(message) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function publishState(reason) {
  if (!state.online || state.seat !== 0) return;
  send({ type: "state", reason, state: packState() });
}

function packState() {
  return {
    view: state.view,
    mode: state.mode,
    phase: state.phase,
    round: state.round,
    players: state.players,
    hands: state.hands,
    deck: state.deck,
    deckCursor: state.deckCursor,
    picks: state.picks,
    log: state.log.slice(0, 6),
    lastWinner: state.lastWinner,
    seed: state.seed,
  };
}

function applyRemoteState(remote) {
  Object.assign(state, remote);
  state.online = true;
  menu.classList.add("hidden");
  roomEntry.classList.add("hidden");
  syncStatus();
}

function applyRemoteAction(action) {
  if (action.kind !== "pick" || action.round !== state.round) return;
  if (state.picks[action.player] == null) {
    state.picks[action.player] = action.handIndex;
    if (state.picks[0] != null && state.picks[1] != null) resolveRound();
    else state.waitingOnline = true;
  }
}

function ensureAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();
}

function tone(freq, duration, type = "sine", gain = 0.04, delay = 0) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + delay);
  amp.gain.setValueAtTime(0.0001, audio.currentTime + delay);
  amp.gain.exponentialRampToValueAtTime(gain, audio.currentTime + delay + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + duration);
  osc.connect(amp).connect(audio.destination);
  osc.start(audio.currentTime + delay);
  osc.stop(audio.currentTime + delay + duration + 0.03);
}

function sfx(type) {
  ensureAudio();
  if (type === "bell") [740, 555, 740].forEach((f, i) => tone(f, 0.18, "triangle", 0.06, i * 0.12));
  else if (type === "hit") [110, 185, 260].forEach((f, i) => tone(f, 0.08, "square", 0.045, i * 0.035));
  else if (type === "slam") tone(80, 0.24, "sawtooth", 0.05);
  else if (type === "finisher") [220, 330, 494, 660, 880].forEach((f, i) => tone(f, 0.18, "sawtooth", 0.05, i * 0.055));
  else tone(520, 0.06, "triangle", 0.025);
}

function updateMusic(dt) {
  if (!musicOn || !audio) return;
  musicTimer -= dt;
  if (musicTimer > 0) return;
  const beat = [98, 98, 147, 196, 147, 98, 220, 196];
  const index = Math.floor(performance.now() / 180) % beat.length;
  tone(beat[index], 0.08, index % 2 ? "square" : "sawtooth", 0.018);
  if (index % 4 === 0) tone(49, 0.1, "sine", 0.03);
  musicTimer = 0.18;
}

function pulse(kind, count) {
  const colors = {
    bell: "#ffd166",
    select: "#4cc9f0",
    clash: "#f8fbff",
    left: state.players[0]?.color || "#ffd166",
    right: state.players[1]?.color || "#ef476f",
    finisher: "#06d6a0",
  };
  for (let i = 0; i < count; i += 1) {
    state.effects.push({
      x: canvas.clientWidth * (kind === "right" ? 0.68 : kind === "left" ? 0.32 : 0.5) + (Math.random() - 0.5) * 80,
      y: canvas.clientHeight * (0.33 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 120,
      vy: -60 - Math.random() * 180,
      life: 0.55 + Math.random() * 0.45,
      age: 0,
      color: colors[kind] || "#ffffff",
    });
  }
}

function update(dt) {
  updateMusic(dt);
  for (let i = state.effects.length - 1; i >= 0; i -= 1) {
    const fx = state.effects[i];
    fx.age += dt;
    fx.x += fx.vx * dt;
    fx.y += fx.vy * dt;
    fx.vy += 260 * dt;
    if (fx.age >= fx.life) state.effects.splice(i, 1);
  }
  if (state.toastUntil && performance.now() > state.toastUntil) {
    toast.classList.add("hidden");
    state.toastUntil = 0;
  }
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  state.buttons = [];
  drawArena(w, h);
  if (state.view === "game") {
    drawScoreboard(w, h);
    drawWrestler(0, w * 0.27, h * 0.39);
    drawWrestler(1, w * 0.73, h * 0.39);
    drawRing(w, h);
    drawHands(w, h);
    drawLog(w, h);
  } else {
    drawAttract(w, h);
  }
  drawEffects();
}

function drawArena(w, h) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#111827");
  grad.addColorStop(0.45, "#080b12");
  grad.addColorStop(1, "#15111f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(76, 201, 240, 0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i += 1) {
    const x = (i / 15) * w;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.42);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (let i = 0; i < 42; i += 1) {
    const x = (i * 83) % w;
    const y = 72 + ((i * 47) % Math.max(120, h * 0.5));
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,209,102,0.26)" : "rgba(76,201,240,0.18)";
    ctx.fillRect(x, y, 3, 12);
  }
}

function drawAttract(w, h) {
  ctx.save();
  ctx.translate(w / 2, h * 0.34);
  for (let i = 0; i < 9; i += 1) {
    ctx.rotate((Math.PI * 2) / 9);
    ctx.fillStyle = i % 2 ? "rgba(239,71,111,0.24)" : "rgba(255,209,102,0.24)";
    ctx.fillRect(0, -6, Math.min(w, h) * 0.45, 12);
  }
  ctx.restore();
  drawRing(w, h);
}

function drawScoreboard(w, h) {
  const y = 58;
  drawPanel(16, y, w - 32, 72, "rgba(8,11,18,0.68)");
  state.players.forEach((player, index) => {
    const x = index === 0 ? 28 : w / 2 + 10;
    const width = w / 2 - 38;
    ctx.fillStyle = player.color;
    ctx.font = "900 15px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${player.label}: ${player.name}`, x, y + 22);
    ctx.fillStyle = "#b8c5d1";
    ctx.font = "800 11px system-ui, sans-serif";
    ctx.fillText(`${player.style} | Falls ${player.score}/${WIN_SCORE}`, x, y + 40);
    meter(x, y + 50, width, 10, player.hp / 24, "#ef476f", "HP");
    meter(x, y + 62, width, 8, player.hype / 12, "#ffd166", "HYPE");
  });
}

function meter(x, y, width, height, amount, color) {
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * clamp(amount, 0, 1), height);
}

function drawRing(w, h) {
  const ringW = Math.min(w * 0.78, 760);
  const ringH = Math.min(h * 0.31, 230);
  const x = (w - ringW) / 2;
  const y = h * 0.43;
  ctx.fillStyle = "#dfe7ef";
  ctx.beginPath();
  ctx.moveTo(x + 70, y);
  ctx.lineTo(x + ringW - 70, y);
  ctx.lineTo(x + ringW, y + ringH);
  ctx.lineTo(x, y + ringH);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#73808e";
  ctx.fillRect(x + 18, y + ringH - 18, ringW - 36, 14);
  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = i === 1 ? "#ef476f" : "#4cc9f0";
    ctx.lineWidth = 4;
    const ry = y + 24 + i * 34;
    ctx.beginPath();
    ctx.moveTo(x + 22, ry);
    ctx.lineTo(x + ringW - 22, ry);
    ctx.stroke();
  }
  [["#ffd166", x + 26], ["#ef476f", x + ringW - 26]].forEach(([color, px]) => {
    ctx.fillStyle = color;
    ctx.fillRect(px - 8, y - 8, 16, ringH + 26);
  });
}

function drawWrestler(index, x, y) {
  const p = state.players[index];
  if (!p) return;
  const bob = Math.sin(performance.now() * 0.004 + index) * 5;
  ctx.save();
  ctx.translate(x, y + bob);
  if (index === 1) ctx.scale(-1, 1);
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, 120, 62, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.fillRect(-36, 18, 72, 74);
  ctx.fillStyle = "#f2c7a9";
  ctx.beginPath();
  ctx.arc(0, -6, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#101827";
  ctx.fillRect(-24, -34, 48, 16);
  ctx.fillStyle = p.color;
  ctx.fillRect(-58, 26, 24, 20);
  ctx.fillRect(34, 26, 24, 20);
  ctx.fillStyle = "#101827";
  ctx.fillRect(-30, 92, 22, 52);
  ctx.fillRect(8, 92, 22, 52);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.name.split(" ")[0], 0, 60);
  ctx.restore();
}

function drawHands(w, h) {
  const handY = h - 155;
  const cardW = clamp((w - 54) / MAX_HAND, 58, 118);
  const cardH = 128;
  const active = state.online ? state.seat : state.turnPlayer;

  [0, 1].forEach((player) => {
    const y = player === 0 ? handY : 138;
    const visible = state.online
      ? player === state.seat || state.phase !== "pick"
      : player === state.turnPlayer || state.phase !== "pick";
    state.hands[player].forEach((id, i) => {
      const x = 18 + i * (cardW + 6);
      const mirroredX = player === 1 ? w - 18 - cardW - i * (cardW + 6) : x;
      const actionable = state.phase === "pick" && player === active && state.picks[player] == null;
      drawCard(mirroredX, y, cardW, cardH, visible ? cardById(id) : null, actionable, player, i);
    });
  });

  ctx.fillStyle = "#f8fbff";
  ctx.font = "900 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  if (state.phase === "pick") {
    const msg = state.online
      ? state.seat == null ? "Spectating" : state.picks[state.seat] == null ? "揀你張卡" : "等對手出招"
      : `${state.players[state.turnPlayer].label} 揀卡`;
    ctx.fillText(msg, w / 2, h - 172);
  } else if (state.phase === "gameover") {
    ctx.fillText("比賽完結，點畫面重新返 menu", w / 2, h - 172);
  }
}

function drawCard(x, y, width, height, card, actionable, player, index) {
  ctx.save();
  ctx.shadowColor = actionable ? "rgba(255,209,102,0.42)" : "rgba(0,0,0,0.34)";
  ctx.shadowBlur = actionable ? 18 : 8;
  ctx.fillStyle = card ? "#111827" : "#202838";
  ctx.strokeStyle = actionable ? "#ffd166" : "rgba(255,255,255,0.24)";
  ctx.lineWidth = actionable ? 3 : 1;
  roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (!card) {
    ctx.fillStyle = "#4cc9f0";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ERC", x + width / 2, y + height / 2);
  } else {
    const typeColor = { strike: "#ef476f", grapple: "#4cc9f0", risk: "#ffd166", counter: "#06d6a0", taunt: "#f8fbff" }[card.type];
    ctx.fillStyle = typeColor;
    ctx.fillRect(x + 8, y + 8, width - 16, 8);
    ctx.fillStyle = "#f8fbff";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    wrapText(card.name, x + 10, y + 30, width - 20, 14, 2);
    ctx.fillStyle = "#ffd166";
    ctx.font = "900 20px system-ui, sans-serif";
    ctx.fillText(String(card.power), x + 10, y + 78);
    ctx.fillStyle = "#4cc9f0";
    ctx.fillText(`+${card.hype}`, x + width - 42, y + 78);
    ctx.fillStyle = "#b8c5d1";
    ctx.font = "750 10px system-ui, sans-serif";
    wrapText(card.text, x + 10, y + 96, width - 20, 12, 3);
  }

  ctx.restore();
  state.buttons.push({ x, y, width, height, kind: "card", player, index, actionable });
}

function drawLog(w, h) {
  const width = Math.min(520, w - 32);
  const x = (w - width) / 2;
  const y = Math.max(206, h - 214);
  drawPanel(x, y, width, 52, "rgba(8,11,18,0.72)");
  ctx.fillStyle = "#f8fbff";
  ctx.font = "850 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  wrapText(state.log[0] || "Ready.", x + 14, y + 22, width - 28, 15, 2, "center");
}

function drawEffects() {
  for (const fx of state.effects) {
    const t = 1 - fx.age / fx.life;
    ctx.globalAlpha = t;
    ctx.fillStyle = fx.color;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 4 + t * 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPanel(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
}

function roundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(text, x, y, maxWidth, lineHeight, maxLines, align = "left") {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.textAlign = align;
  const drawX = align === "center" ? x + maxWidth / 2 : x;
  lines.slice(0, maxLines).forEach((lineText, index) => ctx.fillText(lineText, drawX, y + index * lineHeight));
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (state.phase === "gameover") {
    resetToMenu();
    return;
  }
  const hit = state.buttons.find((button) => x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height);
  if (hit?.kind === "card") selectCard(hit.player, hit.index);
}

function handleMenu(mode) {
  if (mode === "offline") startOffline();
  if (mode === "online-host") startOnline(true);
  if (mode === "online-join") {
    roomEntry.classList.remove("hidden");
    if (roomInput.value.trim()) startOnline(false);
    else showToast("輸入房號，再撳一次 Online 入房。");
  }
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    virtualNow += 1000 / 60;
    update(1 / 60);
  }
  draw();
};

window.render_game_to_text = () => JSON.stringify({
  note: "Canvas coordinates origin top-left, x right, y down. Online requires two browser clients in same room.",
  view: state.view,
  mode: state.mode,
  phase: state.phase,
  room: state.room,
  seat: state.seat,
  peers: state.peers,
  round: state.round,
  turnPlayer: state.turnPlayer,
  players: state.players.map((p) => ({ name: p.name, hp: p.hp, hype: p.hype, falls: p.score, pin: p.pin })),
  handCounts: state.hands.map((hand) => hand.length),
  localPlayableCards: state.buttons.filter((b) => b.kind === "card" && b.actionable).map((b) => ({ player: b.player, index: b.index, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) })),
  log: state.log.slice(0, 3),
});

document.querySelectorAll(".menu-btn").forEach((button) => {
  button.addEventListener("click", () => handleMenu(button.dataset.mode));
});
canvas.addEventListener("pointerdown", handlePointer);
audioBtn.addEventListener("click", () => {
  ensureAudio();
  musicOn = !musicOn;
  audioBtn.textContent = musicOn ? "靜音" : "音樂";
  sfx("tap");
});
window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") resetToMenu();
  if (event.key.toLowerCase() === "f") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }
});

roomEntry.classList.add("hidden");
resize();
syncStatus();
requestAnimationFrame(loop);
