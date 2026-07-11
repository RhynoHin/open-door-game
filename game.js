const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const menuPanel = document.getElementById("menu-panel");
const startBtn = document.getElementById("start-btn");
const hud = document.getElementById("hud");
const objectiveEl = document.getElementById("objective");
const statusEl = document.getElementById("status");
const controls = document.getElementById("touch-controls");
const evidencePanel = document.getElementById("evidence-panel");
const evidenceList = document.getElementById("evidence-list");
const closeEvidence = document.getElementById("close-evidence");

const DPR_LIMIT = 2;
const MAX_TRUST = 5;

const evidence = [
  {
    id: "repair",
    name: "錄音筆維修單",
    desc: "案發 20:45 至 21:20，藍色錄音筆交咗去法院地下維修櫃。",
  },
  {
    id: "cafe",
    name: "星光咖啡單",
    desc: "證人羅曼 21:03 用會員卡買咗熱檸茶，位置係法院對面咖啡店。",
  },
  {
    id: "umbrella",
    name: "藍傘監控相",
    desc: "21:07 後門監控影到一個拎藍傘嘅人進入證物室走廊。",
  },
  {
    id: "metro",
    name: "地鐵入閘紀錄",
    desc: "被告 20:58 於青雨站入閘，去法院最快都要 18 分鐘。",
  },
];

const introLines = [
  { speaker: "旁白", text: "第一日審判。雨夜證物室案，所有證供都指向被告夏璃。" },
  { speaker: "SALLY", text: "我係新人辯護律師 SALLY。今日要靠證物，喺證言入面搵出真正嘅裂縫。" },
  { speaker: "法官", text: "辯方，請準備交叉審問。證人羅曼，開始你嘅證言。" },
];

const chapters = [
  {
    title: "證言一：錄音筆",
    witness: "羅曼",
    goal: "指出錄音筆不可能在被告手上",
    solvedLine: "維修單證明案發時錄音筆唔喺被告手上，第一道證言崩塌。",
    solution: { statement: 2, evidence: "repair" },
    statements: [
      {
        text: "我九點正喺天台門口，親眼見到被告夏璃跑出嚟。",
        press: "羅曼話當時燈好暗，但佢堅持自己認得被告外套。",
      },
      {
        text: "佢神色慌張，手上仲攞住一支藍色錄音筆。",
        press: "藍色錄音筆係案件核心證物。證人講得太肯定，反而奇怪。",
      },
      {
        text: "嗰支錄音筆由始至終都喺被告手上，絕對冇離開過。",
        press: "「由始至終」呢句太絕對。證物袋入面可能有時間記錄可以反駁。",
      },
    ],
  },
  {
    title: "證言二：所在位置",
    witness: "羅曼",
    goal: "證明證人唔可能一直喺天台附近",
    solvedLine: "咖啡單顯示羅曼案發時離開過法院，佢嘅目擊時間唔成立。",
    solution: { statement: 0, evidence: "cafe" },
    statements: [
      {
        text: "我 20:50 到 21:20 一直喺天台附近等雨停，冇離開過。",
        press: "佢話自己一直喺天台附近，但語氣明顯慢咗半拍。",
      },
      {
        text: "因為雨太大，根本冇人會走去法院外面。",
        press: "大雨唔代表冇人出去。買嘢、避人、或者掉包證物都有可能。",
      },
      {
        text: "所以我見到嘅時間同地點，都係完全可靠。",
        press: "可靠與否，要睇客觀紀錄，而唔係證人自己講。",
      },
    ],
  },
  {
    title: "證言三：藍傘",
    witness: "羅曼",
    goal: "指出真正進入後門嘅人",
    solvedLine: "藍傘監控相揭穿羅曼。佢先係雨夜進入證物室走廊嘅人。",
    solution: { statement: 1, evidence: "umbrella" },
    statements: [
      {
        text: "我冇掂過後門，亦都冇接近證物室走廊。",
        press: "證人避開『後門』兩個字，好似怕你繼續問落去。",
      },
      {
        text: "我當晚冇帶遮，更加唔可能係監控入面嗰個藍傘人。",
        press: "佢自己主動提到藍傘人。呢句或者就係最後矛盾。",
      },
      {
        text: "被告先係唯一有機會接觸證物嘅人。",
        press: "唯一？只要證明另一個人入過後門，呢句就唔成立。",
      },
    ],
  },
];

const state = {
  mode: "menu",
  chapter: 0,
  statement: 0,
  line: 0,
  trust: MAX_TRUST,
  message: "",
  speaker: "",
  feedbackKind: "normal",
  feedbackReturn: "cross",
  evidenceOpen: false,
  sound: true,
  audioCtx: null,
  flash: 0,
  shake: 0,
  time: 0,
  pressed: new Set(),
  solved: [],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  const width = Math.max(320, window.innerWidth);
  const height = Math.max(320, window.innerHeight);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function size() {
  return { w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight };
}

function ensureAudio() {
  if (!state.sound || state.audioCtx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audioCtx = new AudioContext();
}

function tone(freq, duration = 0.1, type = "square", volume = 0.04, delay = 0) {
  if (!state.sound) return;
  ensureAudio();
  const ac = state.audioCtx;
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const start = ac.currentTime + delay;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.04);
}

function startGame() {
  state.mode = "intro";
  state.chapter = 0;
  state.statement = 0;
  state.line = 0;
  state.trust = MAX_TRUST;
  state.solved = [];
  state.pressed.clear();
  state.message = introLines[0].text;
  state.speaker = introLines[0].speaker;
  menuPanel.classList.add("hidden");
  hud.classList.remove("hidden");
  controls.classList.remove("hidden");
  ensureAudio();
  tone(392, 0.08, "square", 0.035);
  tone(523.25, 0.12, "square", 0.035, 0.08);
  syncHud();
}

function currentChapter() {
  return chapters[state.chapter];
}

function currentStatement() {
  return currentChapter().statements[state.statement];
}

function syncHud() {
  if (state.mode === "menu") return;
  const chapter = currentChapter();
  if (state.mode === "verdict") objectiveEl.textContent = "判決：無罪";
  else if (state.mode === "gameover") objectiveEl.textContent = "審判失敗";
  else objectiveEl.textContent = chapter ? chapter.title : "第一日審判";
  const progress = Math.round((state.solved.length / chapters.length) * 100);
  statusEl.textContent = `信任 ${state.trust}/${MAX_TRUST} · 證物 ${evidence.length} · 進度 ${progress}% · ${state.sound ? "聲音開" : "靜音"}`;
}

function enterCross() {
  state.mode = "cross";
  state.statement = 0;
  const chapter = currentChapter();
  state.speaker = chapter.witness;
  state.message = chapter.statements[0].text;
  state.feedbackKind = "normal";
  syncHud();
}

function nextStatement(delta) {
  if (state.mode !== "cross") return;
  const statements = currentChapter().statements;
  state.statement = (state.statement + delta + statements.length) % statements.length;
  state.speaker = currentChapter().witness;
  state.message = currentStatement().text;
  tone(220, 0.04, "square", 0.018);
}

function advance() {
  if (state.mode === "intro") {
    state.line += 1;
    if (state.line >= introLines.length) {
      enterCross();
      return;
    }
    state.speaker = introLines[state.line].speaker;
    state.message = introLines[state.line].text;
    tone(330, 0.05, "square", 0.02);
  } else if (state.mode === "cross") {
    nextStatement(1);
  } else if (state.mode === "feedback") {
    if (state.feedbackReturn === "nextChapter") {
      state.chapter += 1;
      if (state.chapter >= chapters.length) enterVerdict();
      else enterCross();
    } else if (state.feedbackReturn === "gameover") {
      state.mode = "gameover";
      state.speaker = "法官";
      state.message = "辯方信任耗盡。本庭暫時休庭。";
    } else {
      state.mode = "cross";
      state.speaker = currentChapter().witness;
      state.message = currentStatement().text;
      state.feedbackKind = "normal";
    }
  } else if (state.mode === "verdict" || state.mode === "gameover") {
    resetGame();
  }
  syncHud();
}

function pressStatement() {
  if (state.mode !== "cross") return;
  const key = `${state.chapter}:${state.statement}`;
  state.pressed.add(key);
  state.mode = "feedback";
  state.feedbackKind = "press";
  state.feedbackReturn = "cross";
  state.speaker = "SALLY";
  state.message = currentStatement().press;
  state.flash = 0.12;
  tone(294, 0.06, "triangle", 0.025);
  syncHud();
}

function openEvidence() {
  if (state.mode !== "cross") return;
  state.evidenceOpen = true;
  evidencePanel.classList.remove("hidden");
  evidenceList.innerHTML = "";
  for (const item of evidence) {
    const button = document.createElement("button");
    button.className = "evidence-btn";
    button.type = "button";
    button.innerHTML = `<strong>${item.name}</strong><span>${item.desc}</span>`;
    button.addEventListener("click", () => presentEvidence(item.id));
    evidenceList.appendChild(button);
  }
}

function closeEvidencePanel() {
  state.evidenceOpen = false;
  evidencePanel.classList.add("hidden");
}

function presentEvidence(id) {
  if (state.mode !== "cross") return;
  closeEvidencePanel();
  const chapter = currentChapter();
  const ok = chapter.solution.statement === state.statement && chapter.solution.evidence === id;
  if (ok) {
    state.mode = "feedback";
    state.feedbackKind = "objection";
    state.feedbackReturn = "nextChapter";
    state.speaker = "SALLY";
    state.message = `反對！${chapter.solvedLine}`;
    state.solved.push(chapter.title);
    state.flash = 1;
    state.shake = 0.45;
    tone(523.25, 0.08, "square", 0.05);
    tone(659.25, 0.08, "square", 0.05, 0.06);
    tone(880, 0.18, "square", 0.05, 0.12);
  } else {
    state.trust = clamp(state.trust - 1, 0, MAX_TRUST);
    state.mode = "feedback";
    state.feedbackKind = "wrong";
    state.feedbackReturn = state.trust <= 0 ? "gameover" : "cross";
    state.speaker = "檢察官 葉城";
    state.message = state.trust <= 0
      ? "辯方，呢個出示完全無關。你已經冇足夠信任繼續審問。"
      : "呢件證物同呢句證言無矛盾。辯方，請慎重。";
    state.flash = 0.35;
    state.shake = 0.22;
    tone(110, 0.16, "sawtooth", 0.035);
  }
  syncHud();
}

function enterVerdict() {
  state.mode = "verdict";
  state.speaker = "法官";
  state.message = "本庭確認控方證言存在重大矛盾。被告夏璃，無罪！";
  state.feedbackKind = "verdict";
  state.flash = 1;
  tone(392, 0.1, "square", 0.04);
  tone(523.25, 0.14, "square", 0.04, 0.1);
  tone(783.99, 0.24, "square", 0.04, 0.22);
  syncHud();
}

function resetGame() {
  state.mode = "menu";
  menuPanel.classList.remove("hidden");
  hud.classList.add("hidden");
  controls.classList.add("hidden");
  closeEvidencePanel();
  syncHud();
}

function toggleSound() {
  state.sound = !state.sound;
  if (!state.sound && state.audioCtx) {
    state.audioCtx.close();
    state.audioCtx = null;
  } else {
    tone(440, 0.08, "square", 0.03);
  }
  syncHud();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function handleAction(action) {
  if (action === "next") nextStatement(1);
  if (action === "prev") nextStatement(-1);
  if (action === "press") pressStatement();
  if (action === "present") openEvidence();
  if (action === "advance") advance();
  if (action === "sound") toggleSound();
  if (action === "full") toggleFullscreen();
}

function update(dt) {
  state.time += dt;
  state.flash = Math.max(0, state.flash - dt * 1.8);
  state.shake = Math.max(0, state.shake - dt * 1.9);
}

function draw() {
  const { w, h } = size();
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(w, h);
  if (state.mode === "menu") {
    drawMenuScene(w, h);
    return;
  }
  const ox = state.shake ? (Math.random() - 0.5) * state.shake * 18 : 0;
  const oy = state.shake ? (Math.random() - 0.5) * state.shake * 10 : 0;
  ctx.save();
  ctx.translate(ox, oy);
  drawTopScreen(w, h);
  drawBottomScreen(w, h);
  ctx.restore();
  drawFlash(w, h);
}

function drawBackdrop(w, h) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#091933");
  grad.addColorStop(0.48, "#0e2145");
  grad.addColorStop(1, "#140f24");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 70; i += 1) {
    const x = (i * 67 + state.time * 9) % w;
    const y = (i * 41) % h;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMenuScene(w, h) {
  ctx.save();
  const floorY = h * 0.78;
  drawCourtBackdrop(w, h, floorY);
  drawLargeSally(w * 0.23, floorY + 18, 1.05, "ready");
  drawLargeProsecutor(w * 0.77, floorY + 18, 1.05, "smirk");
  ctx.restore();
}

function drawTopScreen(w, h) {
  const topH = Math.floor(h * 0.48);
  drawCourtBackdrop(w, topH, topH - 18);

  const focus = focusCharacter();
  const baseY = topH + 28;
  if (focus === "sally") drawLargeSally(w * 0.45, baseY, 0.92, state.feedbackKind === "objection" ? "objection" : "ready");
  if (focus === "witness") drawLargeWitness(w * 0.5, baseY, 0.9, state.mode === "feedback" ? "worried" : "talk");
  if (focus === "prosecutor") drawLargeProsecutor(w * 0.55, baseY, 0.9, "smirk");
  if (focus === "judge") drawLargeJudge(w * 0.5, baseY, 0.88, state.mode === "verdict" ? "verdict" : "stern");

  ctx.fillStyle = "#06101f";
  ctx.fillRect(0, topH, w, 8);
  ctx.fillStyle = "rgba(5,10,20,0.72)";
  ctx.fillRect(0, topH - 22, w, 22);
  ctx.fillStyle = "#f8fbff";
  ctx.font = "900 12px system-ui, sans-serif";
  ctx.fillText(`${roleLabel(focus)} SCREEN`, 12, topH - 8);

  if (state.mode === "feedback" && state.feedbackKind === "objection") drawCutIn(w, topH, "反對!");
  if (state.mode === "verdict") drawCutIn(w, topH, "無罪!");
  if (state.mode === "gameover") drawCutIn(w, topH, "休庭");
}

function focusCharacter() {
  if (state.mode === "intro") {
    if (state.speaker === "SALLY") return "sally";
    if (state.speaker === "法官") return "judge";
    return "judge";
  }
  if (state.mode === "verdict" || state.mode === "gameover") return "judge";
  if (state.mode === "feedback") {
    if (state.feedbackKind === "objection" || state.feedbackKind === "press") return "sally";
    if (state.feedbackKind === "wrong") return "prosecutor";
  }
  return "witness";
}

function roleLabel(role) {
  if (role === "sally") return "DEFENSE";
  if (role === "prosecutor") return "PROSECUTION";
  if (role === "judge") return "COURT";
  return "WITNESS";
}

function drawCourtBackdrop(w, h, floorY) {
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, "#8d633b");
  wall.addColorStop(0.5, "#593720");
  wall.addColorStop(1, "#24151a");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  for (let x = -40; x < w; x += 92) {
    ctx.fillStyle = x % 184 === 0 ? "rgba(255,230,160,0.18)" : "rgba(20,10,12,0.28)";
    ctx.fillRect(x, 0, 38, h);
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(w * 0.1, 24, w * 0.8, 4);
  ctx.fillStyle = "#2a1719";
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(w / 2, floorY + 16, w * 0.32, 22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBottomScreen(w, h) {
  const topH = Math.floor(h * 0.48);
  const y = topH + 8;
  const bottomH = h - y;
  ctx.fillStyle = "#0a1326";
  ctx.fillRect(0, y, w, bottomH);
  ctx.strokeStyle = "rgba(145,215,255,0.34)";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, y + 10, w - 20, bottomH - 72);

  drawTrust(w - 166, y + 24);
  drawStatementTabs(22, y + 22);
  const dialogueY = y + 62;
  const dialogueH = Math.max(72, h - dialogueY - 76);
  drawDialogueBox(22, dialogueY, w - 44, dialogueH);
  drawBottomHint(w, h);
}

function drawTrust(x, y) {
  ctx.fillStyle = "#f8fbff";
  ctx.font = "900 12px system-ui, sans-serif";
  ctx.fillText("信任", x, y);
  for (let i = 0; i < MAX_TRUST; i += 1) {
    ctx.fillStyle = i < state.trust ? "#55d6a8" : "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 38 + i * 20, y - 11, 14, 14);
  }
}

function drawStatementTabs(x, y) {
  if (!currentChapter()) return;
  const total = currentChapter().statements.length;
  ctx.font = "900 12px system-ui, sans-serif";
  for (let i = 0; i < total; i += 1) {
    ctx.fillStyle = i === state.statement && state.mode === "cross" ? "#ffd15f" : "rgba(255,255,255,0.18)";
    roundedRect(x + i * 34, y - 14, 26, 20, 5, true);
    ctx.fillStyle = i === state.statement && state.mode === "cross" ? "#111827" : "#f8fbff";
    ctx.fillText(String(i + 1), x + i * 34 + 9, y + 1);
  }
}

function drawDialogueBox(x, y, w, h) {
  ctx.fillStyle = "#071020";
  roundedRect(x, y, w, h, 8, true);
  ctx.strokeStyle = state.feedbackKind === "wrong" ? "#ff4d6d" : state.feedbackKind === "objection" ? "#ffd15f" : "#4aa3ff";
  ctx.lineWidth = 3;
  roundedRect(x, y, w, h, 8, false);

  ctx.fillStyle = state.feedbackKind === "press" ? "#55d6a8" : "#ffd15f";
  ctx.font = "950 16px system-ui, sans-serif";
  ctx.fillText(state.speaker || "SALLY", x + 16, y + 28);

  ctx.fillStyle = "#f8fbff";
  const bodySize = h < 96 ? 16 : 20;
  const lineHeight = h < 96 ? 22 : 28;
  ctx.font = `800 ${bodySize}px system-ui, sans-serif`;
  wrapText(state.message || "", x + 16, y + 58, w - 32, lineHeight, Math.floor((h - 56) / lineHeight));
}

function drawBottomHint(w, h) {
  let text = "繼續：推進對話";
  if (state.mode === "cross") text = "審問中：上一句 / 下一句 / 追問 / 出示證物";
  if (state.mode === "feedback") text = "按「繼續」返回審問或進入下一段證言";
  if (state.mode === "verdict" || state.mode === "gameover") text = "按「繼續」返回標題";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "800 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h - 64);
  ctx.textAlign = "left";
}

function drawBench(x, y, color, label) {
  ctx.fillStyle = "#3b2418";
  roundedRect(x - 96, y + 35, 192, 64, 8, true);
  ctx.fillStyle = color;
  roundedRect(x - 82, y + 28, 164, 20, 6, true);
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "900 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 44);
  ctx.textAlign = "left";
}

function drawLargeSally(x, baseY, scale, pose) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, -10, 88);
  ctx.fillStyle = "#21102d";
  ctx.beginPath();
  ctx.ellipse(-4, -138, 68, 92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e66d8";
  ctx.beginPath();
  ctx.moveTo(-82, 0);
  ctx.quadraticCurveTo(-62, -92, -24, -112);
  ctx.lineTo(32, -112);
  ctx.quadraticCurveTo(72, -88, 86, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f8fbff";
  ctx.beginPath();
  ctx.moveTo(-28, -104);
  ctx.lineTo(32, -104);
  ctx.lineTo(16, -14);
  ctx.lineTo(-16, -14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd15f";
  ctx.fillRect(24, -48, 54, 10);
  if (pose === "objection") {
    drawArmPointing(32, -76, "#f1c2a0", "#1e66d8");
  } else {
    ctx.fillStyle = "#f1c2a0";
    roundedRect(30, -64, 60, 16, 8, true);
  }
  drawLargeAnimeFace(0, -150, "#f1c2a0", "#21102d", "determined");
  ctx.fillStyle = "#21102d";
  ctx.beginPath();
  ctx.moveTo(-58, -174);
  ctx.bezierCurveTo(-42, -222, 35, -224, 58, -172);
  ctx.bezierCurveTo(38, -188, 14, -184, -10, -172);
  ctx.bezierCurveTo(-28, -164, -46, -160, -58, -174);
  ctx.fill();
  drawNameTag(-70, 4, 140, "#1d65d8", "SALLY");
  ctx.restore();
}

function drawLargeWitness(x, baseY, scale, mood) {
  ctx.save();
  ctx.translate(x, baseY + Math.sin(state.time * 3) * 2);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, -8, 86);
  ctx.fillStyle = "#4b5563";
  ctx.beginPath();
  ctx.moveTo(-72, 0);
  ctx.quadraticCurveTo(-54, -86, -20, -106);
  ctx.lineTo(22, -106);
  ctx.quadraticCurveTo(58, -86, 74, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#dbeafe";
  ctx.beginPath();
  ctx.moveTo(-24, -98);
  ctx.lineTo(24, -98);
  ctx.lineTo(12, -20);
  ctx.lineTo(-12, -20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#91d7ff";
  ctx.fillRect(18, -44, 48, 10);
  drawLargeAnimeFace(0, -148, "#f1c2a0", "#111827", mood === "worried" ? "nervous" : "plain");
  ctx.fillStyle = "#111827";
  roundedRect(-52, -210, 104, 34, 10, true);
  ctx.fillStyle = "#26374f";
  ctx.fillRect(-44, -176, 88, 22);
  if (mood === "worried") {
    ctx.fillStyle = "#91d7ff";
    ctx.beginPath();
    ctx.ellipse(42, -138, 5, 11, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawNameTag(-58, 4, 116, "#475569", "羅曼");
  ctx.restore();
}

function drawLargeProsecutor(x, baseY, scale, mood) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, -8, 88);
  ctx.fillStyle = "#b91c3a";
  ctx.beginPath();
  ctx.moveTo(-82, 0);
  ctx.quadraticCurveTo(-62, -92, -24, -112);
  ctx.lineTo(30, -112);
  ctx.quadraticCurveTo(66, -90, 84, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.moveTo(-24, -102);
  ctx.lineTo(28, -102);
  ctx.lineTo(12, -18);
  ctx.lineTo(-12, -18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(30, -54, 62, 10);
  drawLargeAnimeFace(0, -150, "#efc2a3", "#eef2f7", mood);
  ctx.fillStyle = "#eef2f7";
  ctx.beginPath();
  ctx.moveTo(-58, -184);
  ctx.bezierCurveTo(-24, -230, 38, -218, 64, -174);
  ctx.lineTo(42, -168);
  ctx.bezierCurveTo(24, -188, -12, -190, -58, -184);
  ctx.fill();
  drawNameTag(-88, 4, 176, "#b91c3a", "檢察官 葉城");
  ctx.restore();
}

function drawLargeJudge(x, baseY, scale, mood) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, -8, 92);
  ctx.fillStyle = "#1f1720";
  ctx.beginPath();
  ctx.moveTo(-92, 0);
  ctx.quadraticCurveTo(-70, -84, -26, -112);
  ctx.lineTo(26, -112);
  ctx.quadraticCurveTo(70, -84, 92, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f8efe4";
  ctx.fillRect(-26, -100, 52, 42);
  drawLargeAnimeFace(0, -150, "#f0c9a6", "#f3efe0", mood === "verdict" ? "kind" : "stern");
  ctx.fillStyle = "#f3efe0";
  roundedRect(-68, -210, 136, 32, 6, true);
  ctx.fillStyle = "#e2dac7";
  ctx.fillRect(-58, -178, 116, 18);
  drawNameTag(-64, 4, 128, "#5b3b24", "法官");
  ctx.restore();
}

function drawLargeAnimeFace(x, y, skin, hair, expression) {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y, 42, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,65,40,0.12)";
  ctx.beginPath();
  ctx.ellipse(x + 13, y + 10, 16, 26, -0.15, 0, Math.PI * 2);
  ctx.fill();
  drawLargeEyes(x, y - 12, expression);
  drawLargeMouth(x, y + 16, expression);
  if (expression === "stern" || expression === "smirk") drawLargeBrows(x, y - 24, expression === "stern");
}

function drawLargeEyes(x, y, expression) {
  const eyeColor = expression === "nervous" ? "#64748b" : "#14213d";
  const leftY = expression === "stern" ? y + 2 : y;
  const rightY = expression === "smirk" ? y + 3 : y;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x - 17, leftY, 12, 8, -0.08, 0, Math.PI * 2);
  ctx.ellipse(x + 17, rightY, 12, 8, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(x - 17, leftY + 1, 5, 0, Math.PI * 2);
  ctx.arc(x + 17, rightY + 1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(x - 17, leftY + 1, 2.2, 0, Math.PI * 2);
  ctx.arc(x + 17, rightY + 1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 31, leftY - 2);
  ctx.quadraticCurveTo(x - 17, leftY - 12, x - 4, leftY - 2);
  ctx.moveTo(x + 4, rightY - 2);
  ctx.quadraticCurveTo(x + 17, rightY - 12, x + 31, rightY - 2);
  ctx.stroke();
}

function drawLargeBrows(x, y, stern) {
  ctx.strokeStyle = "#312019";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 32, y - (stern ? 2 : -2));
  ctx.lineTo(x - 6, y + (stern ? 8 : 0));
  ctx.moveTo(x + 6, y + (stern ? 8 : 0));
  ctx.lineTo(x + 32, y - (stern ? 2 : -2));
  ctx.stroke();
}

function drawLargeMouth(x, y, expression) {
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (expression === "nervous") {
    ctx.moveTo(x - 16, y + 10);
    ctx.quadraticCurveTo(x, y + 5, x + 16, y + 10);
  } else if (expression === "smirk") {
    ctx.moveTo(x - 16, y + 8);
    ctx.quadraticCurveTo(x + 3, y + 16, x + 22, y + 4);
  } else if (expression === "stern") {
    ctx.moveTo(x - 16, y + 11);
    ctx.lineTo(x + 16, y + 11);
  } else {
    ctx.moveTo(x - 16, y + 8);
    ctx.quadraticCurveTo(x, y + 16, x + 16, y + 8);
  }
  ctx.stroke();
}

function drawJudge(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, 96, 78);
  ctx.fillStyle = "#5b3b24";
  roundedRect(-92, 60, 184, 68, 8, true);
  drawRobe(0, 40, "#1f1720", "#f8efe4", 70);
  drawFace(0, -10, "#f0c9a6", "stern");
  ctx.fillStyle = "#f3efe0";
  roundedRect(-50, -56, 100, 24, 4, true);
  ctx.fillStyle = "#d8d0c0";
  ctx.fillRect(-44, -32, 88, 12);
  drawBrows(0, -18, true);
  drawNameTag(-62, 120, 124, "#5b3b24", "法官");
  ctx.restore();
}

function drawDefense(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, 104, 72);
  drawHairBack(0, -10, "#20102b", 58, 76);
  drawSuit(0, 42, "#1d65d8", "#f8fbff", "#ffd15f");
  drawArmPointing(28, 54, "#f1c2a0", "#1d65d8");
  drawFace(0, -18, "#f1c2a0", "focused");
  drawSallyHairFront(0, -20);
  drawNameTag(-64, 120, 128, "#1d65d8", "SALLY");
  ctx.restore();
}

function drawProsecutor(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  drawPortraitShadow(0, 104, 72);
  drawHairBack(0, -18, "#e8edf7", 48, 38);
  drawSuit(0, 42, "#b91c3a", "#111827", "#eceff6");
  drawFace(0, -18, "#efc2a3", "smirk");
  ctx.fillStyle = "#eef2f7";
  roundedRect(-36, -58, 72, 16, 4, true);
  drawBrows(0, -26, true);
  drawNameTag(-76, 120, 152, "#b91c3a", "檢察官 葉城");
  ctx.restore();
}

function drawWitness(x, y, scale) {
  ctx.save();
  ctx.translate(x, y + Math.sin(state.time * 3) * 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#5b3b24";
  roundedRect(-86, 64, 172, 58, 8, true);
  drawPortraitShadow(0, 98, 70);
  drawSuit(0, 40, "#475569", "#dbeafe", "#91d7ff");
  drawFace(0, -20, "#f1c2a0", "nervous");
  ctx.fillStyle = "#111827";
  roundedRect(-38, -58, 76, 26, 8, true);
  ctx.fillStyle = "#23334a";
  ctx.fillRect(-32, -36, 64, 16);
  drawNameTag(-54, 120, 108, "#475569", "羅曼");
  ctx.restore();
}

function drawPortraitShadow(x, y, width) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, width, 15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHairBack(x, y, color, width, height) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + 8, width, height, 0, Math.PI * 0.04, Math.PI * 1.96);
  ctx.fill();
}

function drawSallyHairFront(x, y) {
  ctx.fillStyle = "#2a1435";
  ctx.beginPath();
  ctx.moveTo(x - 42, y - 25);
  ctx.bezierCurveTo(x - 18, y - 66, x + 26, y - 64, x + 43, y - 22);
  ctx.bezierCurveTo(x + 22, y - 38, x + 4, y - 28, x - 12, y - 22);
  ctx.bezierCurveTo(x - 22, y - 18, x - 36, y - 14, x - 42, y - 25);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + 12, y - 42, 11, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(x, y, skin, expression) {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y, 31, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,65,40,0.16)";
  ctx.beginPath();
  ctx.ellipse(x + 9, y + 8, 14, 20, -0.2, 0, Math.PI * 2);
  ctx.fill();
  drawEyes(x, y - 7, expression);
  drawNoseMouth(x, y + 4, expression);
}

function drawEyes(x, y, expression) {
  const rightTilt = expression === "smirk" ? -2 : expression === "nervous" ? 2 : 0;
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 20, y);
  ctx.quadraticCurveTo(x - 12, y - 5, x - 4, y + (expression === "nervous" ? 1 : 0));
  ctx.moveTo(x + 4, y + rightTilt);
  ctx.quadraticCurveTo(x + 13, y - 5 + rightTilt, x + 22, y - 1);
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(x - 12, y + 2, 3, 0, Math.PI * 2);
  ctx.arc(x + 14, y + rightTilt + 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.arc(x - 13, y + 1, 1, 0, Math.PI * 2);
  ctx.arc(x + 13, y + rightTilt, 1, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrows(x, y, stern) {
  ctx.strokeStyle = "#33201a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 24, y - (stern ? 2 : 0));
  ctx.lineTo(x - 6, y + (stern ? 5 : 0));
  ctx.moveTo(x + 6, y + (stern ? 5 : 0));
  ctx.lineTo(x + 24, y - (stern ? 2 : 0));
  ctx.stroke();
}

function drawNoseMouth(x, y, expression) {
  ctx.strokeStyle = "rgba(80,45,34,0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 8);
  ctx.quadraticCurveTo(x + 8, y, x + 1, y + 5);
  ctx.stroke();
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (expression === "smirk") {
    ctx.moveTo(x - 10, y + 18);
    ctx.quadraticCurveTo(x + 4, y + 22, x + 18, y + 14);
  } else if (expression === "nervous") {
    ctx.moveTo(x - 11, y + 17);
    ctx.quadraticCurveTo(x, y + 12, x + 12, y + 17);
  } else {
    ctx.moveTo(x - 13, y + 18);
    ctx.quadraticCurveTo(x, y + 23, x + 13, y + 18);
  }
  ctx.stroke();
}

function drawSuit(x, y, jacket, shirt, accent) {
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(x - 54, y + 76);
  ctx.quadraticCurveTo(x - 45, y + 6, x - 22, y - 8);
  ctx.lineTo(x + 22, y - 8);
  ctx.quadraticCurveTo(x + 45, y + 6, x + 54, y + 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 4);
  ctx.lineTo(x + 18, y - 4);
  ctx.lineTo(x + 10, y + 68);
  ctx.lineTo(x - 10, y + 68);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(x + 18, y + 30, 52, 10);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 4);
  ctx.lineTo(x - 4, y + 28);
  ctx.lineTo(x - 16, y + 76);
  ctx.moveTo(x + 22, y - 4);
  ctx.lineTo(x + 4, y + 28);
  ctx.lineTo(x + 16, y + 76);
  ctx.stroke();
}

function drawRobe(x, y, robe, shirt, width) {
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y + 78);
  ctx.quadraticCurveTo(x - 34, y + 4, x - 16, y - 10);
  ctx.lineTo(x + 16, y - 10);
  ctx.quadraticCurveTo(x + 34, y + 4, x + width / 2, y + 78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.fillRect(x - 18, y - 4, 36, 30);
}

function drawArmPointing(x, y, skin, sleeve) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = sleeve;
  roundedRect(-6, -8, 54, 18, 8, true);
  ctx.fillStyle = skin;
  roundedRect(40, -9, 42, 16, 8, true);
  ctx.fillStyle = "#f8d3ba";
  ctx.beginPath();
  ctx.moveTo(78, -5);
  ctx.lineTo(104, -1);
  ctx.lineTo(78, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawNameTag(x, y, width, color, name) {
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  roundedRect(x + 8, y + 6, width, 24, 6, true);
  ctx.fillStyle = color;
  roundedRect(x, y, width, 24, 6, true);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, x + width / 2, y + 16);
  ctx.textAlign = "left";
}

function drawCutIn(w, topH, word) {
  ctx.save();
  ctx.globalAlpha = clamp(state.flash + 0.25, 0, 1);
  ctx.fillStyle = word === "休庭" ? "#111827" : word === "無罪!" ? "#55d6a8" : "#ff4d6d";
  ctx.beginPath();
  ctx.moveTo(0, topH * 0.28);
  ctx.lineTo(w, topH * 0.06);
  ctx.lineTo(w, topH * 0.54);
  ctx.lineTo(0, topH * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 8;
  ctx.font = `950 ${Math.min(88, w * 0.12)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(word, w / 2, topH * 0.42);
  ctx.fillText(word, w / 2, topH * 0.42);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function drawFlash(w, h) {
  if (state.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = state.flash * 0.18;
  ctx.fillStyle = state.feedbackKind === "wrong" ? "#ff4d6d" : "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function roundedRect(x, y, w, h, r, fill) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

function wrapText(text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = [...String(text)];
  const lines = [];
  let line = "";
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((lineText, i) => ctx.fillText(lineText, x, y + i * lineHeight));
}

function renderGameToText() {
  const chapter = currentChapter();
  return JSON.stringify({
    coordinateSystem: "canvas origin top-left, x right, y down",
    mode: state.mode,
    chapterIndex: state.chapter,
    chapterTitle: chapter?.title || null,
    statementIndex: state.statement,
    statementText: chapter?.statements[state.statement]?.text || null,
    speaker: state.speaker,
    message: state.message,
    trust: state.trust,
    solved: state.solved,
    evidence: evidence.map((item) => item.id),
    evidenceOpen: state.evidenceOpen,
    expectedEvidence: chapter?.solution.evidence || null,
    expectedStatement: chapter?.solution.statement ?? null,
  });
}

function testSolveCurrent() {
  const chapter = currentChapter();
  state.mode = "cross";
  state.statement = chapter.solution.statement;
  presentEvidence(chapter.solution.evidence);
  return JSON.parse(renderGameToText());
}

function testFinishCase() {
  if (state.mode === "feedback" && state.feedbackReturn === "nextChapter") {
    state.chapter += 1;
  }
  state.mode = "cross";
  while (state.chapter < chapters.length) {
    const chapter = currentChapter();
    state.statement = chapter.solution.statement;
    presentEvidence(chapter.solution.evidence);
    if (state.feedbackReturn === "nextChapter") {
      state.chapter += 1;
      if (state.chapter >= chapters.length) break;
      state.mode = "cross";
    }
  }
  enterVerdict();
  return JSON.parse(renderGameToText());
}

function loop(now) {
  const dt = Math.min((now - (loop.last || now)) / 1000, 0.05);
  loop.last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startGame);
closeEvidence.addEventListener("click", closeEvidencePanel);
window.addEventListener("resize", resize);
document.addEventListener("fullscreenchange", resize);

document.querySelectorAll(".ctrl-btn").forEach((button) => {
  button.addEventListener("click", () => handleAction(button.dataset.action));
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") nextStatement(1);
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") nextStatement(-1);
  if (event.key.toLowerCase() === "p") pressStatement();
  if (event.key.toLowerCase() === "e") openEvidence();
  if (event.key === "Enter" || event.key === " ") {
    advance();
    event.preventDefault();
  }
  if (event.key.toLowerCase() === "m") toggleSound();
  if (event.key.toLowerCase() === "f") toggleFullscreen();
});

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  draw();
};
window.__court_test_solve_current = testSolveCurrent;
window.__court_test_finish_case = testFinishCase;

resize();
requestAnimationFrame(loop);
