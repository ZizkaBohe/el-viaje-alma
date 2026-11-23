"use strict";

/* =========================================================================
   4. ELEMENTOS DEL DOM Y ESTADO GLOBAL DEL JUEGO
========================================================================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const previewCanvas = document.getElementById("almaPreviewCanvas");
const previewCtx = previewCanvas.getContext("2d");

const hudEl = document.getElementById("hud");
const startScreen = document.getElementById("startScreen");
const pauseScreen = document.getElementById("pauseScreen");
const gameOverScreen = document.getElementById("gameOverScreen");

const starsCountEl = document.getElementById("starsCount");
const scoreCountEl = document.getElementById("scoreCount");
const bestHudEl = document.getElementById("bestHud");
const radianceLabelEl = document.getElementById("radianceLabel");
const radianceFillEl = document.getElementById("radianceFill");
const shieldBadgeEl = document.getElementById("shieldBadge");
const magnetBadgeEl = document.getElementById("magnetBadge");
const boostBadgeEl = document.getElementById("boostBadge");
const boostTimerTextEl = document.getElementById("boostTimerText");
const boostFillEl = document.getElementById("boostFill");
const wordHudEl = document.getElementById("wordHud");
const wordBannerEl = document.getElementById("wordBanner");
const planetNameHudEl = document.getElementById("planetNameHud");
const planetDotEl = document.getElementById("planetDot");
const planetProgressFillEl = document.getElementById("planetProgressFill");
const planetBannerEl = document.getElementById("planetBanner");
const magnetTimerTextEl = document.getElementById("magnetTimerText");
const magnetFillEl = document.getElementById("magnetFill");

const stoppedByTextEl = document.getElementById("stoppedByText");
const finalScoreEl = document.getElementById("finalScore");
const finalStarsEl = document.getElementById("finalStars");
const finalBestEl = document.getElementById("finalBest");
const motivationalQuoteEl = document.getElementById("motivationalQuote");
const newRecordPillEl = document.getElementById("newRecordPill");

const soundBtn = document.getElementById("soundBtn");
const pauseBtn = document.getElementById("pauseBtn");

const BEST_STORAGE_KEY = "alma_best_score_v1";
let bestScore = Number(localStorage.getItem(BEST_STORAGE_KEY) || "0");
bestHudEl.textContent = bestScore.toLocaleString("es-ES");

// Dimensiones y cámara pseudo-3D
let W = window.innerWidth;
let H = window.innerHeight;
let dpr = Math.min(window.devicePixelRatio || 1, 2);

const LANE_WIDTH = 2.4;
const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
const PLAYER_Z = 6.0;
const SPAWN_Z = 108.0;
const DESPAWN_Z = -4.0;

const STATE = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover"
};

let gameState = STATE.START;
let globalTime = 0;

const player = {
  lane: 1,
  targetLane: 1,
  x: 0,
  y: 0,
  vy: 0,
  grounded: true,
  sliding: false,
  slideTimer: 0,
  tilt: 0,
  squashX: 1,
  squashY: 1,
  hasShield: false,
  magnetTimer: 0,
  invulnTimer: 0,
  hurtTimer: 0,
  glowLevel: 0.25,
  trailTimer: 0,
  boostTimer: 0,   // Cohete activo (segundos restantes)
  yaw: 0,          // giro 3D actual
  yawTarget: 0,    // giro objetivo (al cambiar de carril)
  spin: 0,         // progreso de la pirueta al saltar (0..1)
  spinning: false,
  laneDir: 0       // inclinación lateral suavizada
};

const runStats = {
  speed: 19,
  baseSpeed: 19,
  maxSpeed: 40,
  distance: 0,
  score: 0,
  stars: 0,
  combo: 0,
  comboTimer: 0,
  worldScroll: 0,
  spawnTimer: 0.9,
  waveCount: 0,
  shake: 0
};

// Entidades del mundo
let obstacles = [];
let coins = [];
let powerups = [];
let particles = [];
const MAX_PARTICLES = 130;
let letters = [];   // letras flotantes de la palabra actual
const BOOST_DURATION = 5.5;
const wordState = { word: "", idx: 0, done: 0 };
let floatingTexts = [];
const drawQueue = [];
const badgeWidthCache = new Map();

// Estado del viaje planeta a planeta
const planetState = {
  currentIndex: 0,
  fromIndex: 0,
  transition: 1,    // 0 -> 1 transición suave entre planetas
  warpFlash: 0,     // destello del portal estelar al cambiar de planeta
  warpRing: 0,      // anillo expansivo de portal (0..1)
  progress: 0,      // progreso 0..1 dentro del planeta actual
  visited: 0,
  curve: 0,         // curvatura actual del camino (-1..1)
  curveTarget: 0
};

// Sprites y gradientes cacheados para rendimiento 60fps constante
let cachedVignette = null;
let coinSprite = null;
function buildCoinSprite() {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const g = c.getContext("2d");
  const cx = 48, cy = 48, r = 22;
  const glow = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.0);
  glow.addColorStop(0, "rgba(255, 234, 134, 0.8)");
  glow.addColorStop(0.55, "rgba(255, 210, 80, 0.28)");
  glow.addColorStop(1, "rgba(255, 210, 80, 0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, cy, r * 2.0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = "#ffd86b";
  g.strokeStyle = "#fff4be";
  g.lineWidth = 3;
  g.lineJoin = "round";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.48;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.stroke();
  return c;
}
coinSprite = buildCoinSprite();

// Partículas ambientales del planeta actual (burbujas, pétalos, cristales, chispas)
const ambientMotes = [];

// Fondo espacial
const bgStars = [];
const warpStreaks = [];
const nebulae = [];

function initSpaceBackdrop() {
  bgStars.length = 0;
  for (let i = 0; i < 120; i++) {
    bgStars.push({
      x: Math.random(),
      y: Math.random() * 0.78,
      r: 0.7 + Math.random() * 1.7,
      twinkleSpeed: 1.5 + Math.random() * 3.0,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.7 ? "#ffffff" : (Math.random() < 0.5 ? "#9beeff" : "#f7b3ff")
    });
  }

  warpStreaks.length = 0;
  for (let i = 0; i < 34; i++) {
    warpStreaks.push({
      angle: Math.random() * Math.PI * 2,
      dist: 0.05 + Math.random() * 0.9,
      speed: 0.35 + Math.random() * 0.9,
      len: 0.04 + Math.random() * 0.09,
      color: Math.random() < 0.55 ? "rgba(138, 232, 255, 0.45)" : "rgba(232, 130, 255, 0.38)"
    });
  }

  nebulae.length = 0;
  nebulae.push(
    { nx: 0.24, ny: 0.22, rx: 0.36, ry: 0.22, slot: 0 },
    { nx: 0.76, ny: 0.20, rx: 0.38, ry: 0.24, slot: 1 }
  );

  ambientMotes.length = 0;
  for (let i = 0; i < 24; i++) {
    ambientMotes.push({
      x: Math.random(),
      y: Math.random() * 0.85,
      size: 2.5 + Math.random() * 4.5,
      vx: (Math.random() - 0.5) * 0.04,
      vy: -(0.02 + Math.random() * 0.05),
      phase: Math.random() * Math.PI * 2
    });
  }
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  // Limitar DPR en pantallas muy grandes para mantener 60fps estables
  const maxDpr = (W * H > 1200000) ? 1.5 : 2;
  dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Cachear viñeta para no recrearla en cada frame
  cachedVignette = ctx.createRadialGradient(W * 0.5, H * 0.55, Math.min(W, H) * 0.35, W * 0.5, H * 0.55, Math.max(W, H) * 0.8);
  cachedVignette.addColorStop(0, "rgba(0,0,0,0)");
  cachedVignette.addColorStop(1, "rgba(3,2,14,0.52)");
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 120));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
}
resize();
initSpaceBackdrop();

/* =========================================================================
   5. PROYECCIÓN PSEUDO-3D (ADAPTADA A ESCRITORIO Y TELÉFONO VERTICAL)
========================================================================= */
function project(wx, wy, wz) {
  if (wz <= 0.25) return null;
  const isPortrait = W < H;
  const horizonY = H * (isPortrait ? 0.31 : 0.30);
  const camY = (isPortrait ? 3.85 : 3.67) + player.y * 0.25;
  const camX = player.x * (isPortrait ? 0.34 : 0.28);
  const fovY = H * (isPortrait ? 0.78 : 0.85);
  const fovX = isPortrait ? (W * 0.76) : (Math.min(W, H * 1.15) * 0.78);
  const invZ = 1 / wz;
  const dzc = wz > PLAYER_Z ? wz - PLAYER_Z : 0;
  const bx = wx + planetState.curve * 0.0009 * dzc * dzc; // camino curvo (vértice)

  return {
    x: W * 0.5 + (bx - camX) * fovX * invZ,
    y: horizonY + (camY - wy) * fovY * invZ,
    scaleY: fovY * invZ,
    scaleX: fovX * invZ,
    invZ
  };
}

/* =========================================================================
   7. GESTIÓN DE PARTÍCULAS Y TEXTOS FLOTANTES
========================================================================= */
function spawnParticles(wx, wy, wz, count, color, speed = 4, sizeBase = 5) {
  const room = MAX_PARTICLES - particles.length;
  if (room <= 0) return;
  const n = Math.min(count, room);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const up = (Math.random() - 0.2) * speed;
    particles.push({
      x: wx + (Math.random() - 0.5) * 0.3,
      y: wy + (Math.random() - 0.5) * 0.3,
      z: wz + (Math.random() - 0.5) * 0.3,
      vx: Math.cos(angle) * speed * (0.4 + Math.random() * 0.7),
      vy: up,
      vz: Math.sin(angle) * speed * 0.5,
      life: 0,
      maxLife: 0.35 + Math.random() * 0.45,
      color,
      size: sizeBase * (0.6 + Math.random() * 0.8)
    });
  }
}

function addFloatingText(text, color = "#ffd86b", wy = 1.6) {
  floatingTexts.push({
    text,
    color,
    x: player.x,
    y: player.y + wy,
    z: PLAYER_Z,
    life: 0,
    maxLife: 1.15
  });
}

/* =========================================================================
   8. GENERACIÓN DE OLEADAS JUSTAS (OBSTÁCULOS + ESTRELLAS + POWER-UPS)
========================================================================= */
function pickFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnStarArc(laneX, zStart, zEnd, peakY, count) {
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const z = zStart + (zEnd - zStart) * t;
    const y = 0.58 + Math.sin(t * Math.PI) * peakY;
    coins.push({
      x: laneX,
      y,
      z,
      collected: false,
      phase: Math.random() * Math.PI * 2
    });
  }
}

/* ---------- Sistema de palabras (letra por letra, siempre aleatoria) ---------- */
function newWord() {
  const prev = wordState.word;
  let pool = WORDS.filter((w) => w !== prev);
  if (pool.length === 0) pool = WORDS;
  wordState.word = pool[Math.floor(Math.random() * pool.length)];
  wordState.idx = 0;
  letters = [];
  updateWordHud(-1);
}

function updateWordHud(justFilled) {
  let html = "";
  for (let i = 0; i < wordState.word.length; i++) {
    const cls = i < wordState.idx ? "filled" : (i === wordState.idx ? "current" : "");
    html += `<span class="letter-slot ${cls}${i === justFilled ? " pop" : ""}">${wordState.word[i]}</span>`;
  }
  wordHudEl.innerHTML = html;
}

function collectLetter(l) {
  const i = wordState.idx;
  wordState.idx++;
  runStats.score += 50;
  player.glowLevel = Math.min(1, player.glowLevel + 0.1);
  spawnParticles(l.x, l.y, l.z, 16, "#ffe27a", 5, 5.5);
  addFloatingText(`${l.ch}  +50`, "#ffe27a", 2.0);
  audio.letter(i);
  updateWordHud(i);
  if (wordState.idx >= wordState.word.length) celebrateWord();
}

function celebrateWord() {
  const word = wordState.word;
  const bonus = WORD_BONUS_BASE + WORD_BONUS_STEP * wordState.done;
  runStats.score += bonus;
  wordState.done++;
  player.glowLevel = 1;
  audio.word();
  runStats.shake = Math.max(runStats.shake, 0.18);
  const colors = ["#ffe27a", "#ff7ab8", "#8ae8ff", "#b88cff", "#ffffff", "#7dffb0"];
  for (const c of colors) spawnParticles(player.x, player.y + 1.0, PLAYER_Z, 22, c, 9, 6.5);
  wordBannerEl.innerHTML = `<div class="wb-title">¡${word}!</div><div class="wb-sub">PALABRA COMPLETA · +${bonus.toLocaleString("es-ES")}</div>`;
  wordBannerEl.classList.remove("show");
  void wordBannerEl.offsetWidth;
  wordBannerEl.classList.add("show");
  setTimeout(() => {
    wordBannerEl.classList.remove("show");
    if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) newWord();
  }, 2200);
}

function spawnStarLine(laneX, zStart, count, spacing = 3.2, y = 0.62) {
  for (let i = 0; i < count; i++) {
    coins.push({
      x: laneX,
      y,
      z: zStart + i * spacing,
      collected: false,
      phase: i * 0.45
    });
  }
}

function createObstacle(laneIndex, type, zPos, moving = false) {
  const meta = pickFrom(BARRIER_CATALOG[type]);
  return {
    lane: laneIndex,
    x: LANES[laneIndex],
    z: zPos,
    type, // 'large' | 'high' | 'low'
    label: meta.label,
    display: meta.display,
    quote: meta.quote,
    moving,
    extraSpeed: moving ? (6 + Math.min(8, runStats.distance * 0.005)) : 0,
    shattered: false,
    seed: Math.random() * 10
  };
}

function spawnWave() {
  runStats.waveCount++;
  const zBase = SPAWN_Z;
  const difficulty = Math.min(1, (runStats.speed - runStats.baseSpeed) / (runStats.maxSpeed - runStats.baseSpeed));

  // Elegir qué carriles tendrán obstáculos garantizando SIEMPRE al menos un camino posible
  const laneOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
  const safeLane = laneOrder[0];
  const laneB = laneOrder[1];
  const laneC = laneOrder[2];

  const patternRoll = Math.random();

  if (patternRoll < 0.28) {
    // Patrón 1: Un obstáculo grande y un carril con salto o deslizamiento + arco de estrellas
    const allowMoving = difficulty > 0.2 && Math.random() < 0.4;
    obstacles.push(createObstacle(laneB, "large", zBase, allowMoving));
    const passableType = Math.random() < 0.55 ? "low" : "high";
    obstacles.push(createObstacle(laneC, passableType, zBase));

    if (passableType === "low") {
      spawnStarArc(LANES[laneC], zBase - 4.2, zBase + 4.2, 1.55, 5);
    } else {
      spawnStarLine(LANES[safeLane], zBase - 3, 5, 3.0);
    }
  } else if (patternRoll < 0.54) {
    // Patrón 2: Dos obstáculos grandes, un carril completamente libre con fila de estrellas
    const movingB = difficulty > 0.25 && Math.random() < 0.35;
    obstacles.push(createObstacle(laneB, "large", zBase, movingB));
    obstacles.push(createObstacle(laneC, "large", zBase, false));
    spawnStarLine(LANES[safeLane], zBase - 4, 6, 2.9);
  } else if (patternRoll < 0.78) {
    // Patrón 3: Barreras bajas o altas en 2 carriles + carril libre
    const t1 = Math.random() < 0.5 ? "low" : "high";
    const t2 = Math.random() < 0.5 ? "low" : "high";
    obstacles.push(createObstacle(laneB, t1, zBase));
    obstacles.push(createObstacle(laneC, t2, zBase));

    if (t1 === "low") {
      spawnStarArc(LANES[laneB], zBase - 4.0, zBase + 4.0, 1.5, 5);
    } else {
      spawnStarLine(LANES[safeLane], zBase - 3, 5, 3.0);
    }
  } else {
    // Patrón 4: Desafío escalonado (primero esquiva o salta, luego desliza)
    const firstType = Math.random() < 0.5 ? "low" : "large";
    obstacles.push(createObstacle(safeLane, firstType, zBase));
    obstacles.push(createObstacle(laneB, "large", zBase));
    obstacles.push(createObstacle(laneC, "high", zBase + 13));

    if (firstType === "low") {
      spawnStarArc(LANES[safeLane], zBase - 3.8, zBase + 3.8, 1.55, 5);
    } else {
      spawnStarLine(LANES[laneC], zBase - 3, 4, 3.0, 0.58);
    }
  }

  // Probabilidad de generar un Power-Up en el carril seguro un poco después de la oleada
  if (runStats.waveCount % 4 === 0 || Math.random() < 0.14) {
    const roll = Math.random();
    const pType = roll < 0.36 ? "shield" : (roll < 0.68 ? "magnet" : "rocket");
    // Evitar duplicar si ya tiene escudo y salió escudo
    const finalType = (pType === "shield" && player.hasShield) ? "magnet" : pType;
    powerups.push({
      x: LANES[safeLane],
      y: 0.95,
      z: zBase + 9.5,
      type: finalType,
      collected: false,
      phase: Math.random() * Math.PI * 2
    });
  }

  // Letra de la palabra actual (siempre la siguiente que falta) en el carril seguro
  if (letters.length === 0 && wordState.idx < wordState.word.length && player.boostTimer <= 0 && runStats.waveCount % 2 === 1) {
    letters.push({
      x: LANES[safeLane],
      y: 1.0,
      z: zBase + 4.5,
      ch: wordState.word[wordState.idx],
      phase: Math.random() * Math.PI * 2
    });
  }
}

/* =========================================================================
   9. CONTROLES (TECLADO + TÁCTIL SWIPE)
========================================================================= */
function moveLane(dir) {
  if (gameState !== STATE.PLAYING) return;
  const next = Math.max(0, Math.min(2, player.targetLane + dir));
  if (next !== player.targetLane) {
    player.targetLane = next;
    player.tilt = dir * 0.28;
    player.yawTarget = dir * 1.05; // gira el cuerpo hacia donde va
    audio.lane();
  }
}

function jump() {
  if (gameState !== STATE.PLAYING || player.boostTimer > 0) return;
  if (player.grounded) {
    player.vy = 13.8;
    player.grounded = false;
    player.sliding = false;
    player.slideTimer = 0;
    player.squashX = 0.82;
    player.squashY = 1.24;
    player.spin = 0;
    player.spinning = true; // pirueta 3D al saltar
    spawnParticles(player.x, 0.15, PLAYER_Z, 10, "#8ae8ff", 3.5, 4);
    audio.jump();
  }
}

function slide() {
  if (gameState !== STATE.PLAYING || player.boostTimer > 0) return;
  if (!player.grounded) {
    // Caída rápida hacia deslizamiento
    player.vy = -24;
  }
  player.sliding = true;
  player.slideTimer = 0.72;
  player.squashX = 1.2;
  player.squashY = 0.72;
  audio.slide();
}

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  audio.init();

  if (gameState === STATE.START && (e.code === "Enter" || e.code === "Space")) {
    startGame();
    return;
  }
  if (gameState === STATE.GAMEOVER && (e.code === "Enter" || e.code === "Space")) {
    startGame();
    return;
  }
  if (e.code === "KeyP" || e.code === "Escape") {
    if (gameState === STATE.PLAYING) pauseGame();
    else if (gameState === STATE.PAUSED) resumeGame();
    return;
  }
  if (gameState !== STATE.PLAYING) return;

  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      moveLane(-1);
      break;
    case "ArrowRight":
    case "KeyD":
      moveLane(1);
      break;
    case "ArrowUp":
    case "KeyW":
    case "Space":
      jump();
      break;
    case "ArrowDown":
    case "KeyS":
      slide();
      break;
    case "KeyF":
    case "KeyE":
      fireWord();
      break;
  }
});

// Soporte táctil (Swipe) en todo el canvas
let touchStartX = 0;
let touchStartY = 0;
let touchHandled = false;

canvas.addEventListener("touchstart", (e) => {
  audio.init();
  if (e.touches.length > 0) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchHandled = false;
  }
}, { passive: true });

canvas.addEventListener("touchmove", (e) => {
  if (gameState !== STATE.PLAYING || touchHandled || e.touches.length === 0) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  const threshold = 22;
  if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
    touchHandled = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
    } else {
      if (dy < 0) jump();
      else slide();
    }
  }
}, { passive: true });

/* =========================================================================
   10. FLUJO DEL JUEGO (INICIO, PAUSA, GAME OVER)
========================================================================= */
function resetGame() {
  player.lane = 1;
  player.targetLane = 1;
  player.x = 0;
  player.y = 0;
  player.vy = 0;
  player.grounded = true;
  player.sliding = false;
  player.slideTimer = 0;
  player.tilt = 0;
  player.squashX = 1;
  player.squashY = 1;
  player.hasShield = false;
  player.magnetTimer = 0;
  player.invulnTimer = 0;
  player.hurtTimer = 0;
  player.glowLevel = 0.25;
  player.yaw = 0; player.yawTarget = 0; player.spin = 0; player.spinning = false; player.laneDir = 0;
  player.boostTimer = 0;
  runStats.boostCoinTimer = 0;
  letters = [];
  wordState.done = 0;
  newWord();

  runStats.speed = runStats.baseSpeed;
  runStats.distance = 0;
  runStats.score = 0;
  runStats.stars = 0;
  runStats.combo = 0;
  runStats.comboTimer = 0;
  runStats.worldScroll = 0;
  runStats.spawnTimer = 0.55;
  runStats.waveCount = 0;
  runStats.shake = 0;

  obstacles = [];
  coins = [];
  powerups = [];
  particles = [];
  floatingTexts = [];

  planetState.currentIndex = 0;
  planetState.fromIndex = 0;
  planetState.transition = 1;
  planetState.warpFlash = 0;
  planetState.warpRing = 0;
  planetState.progress = 0;
  planetState.visited = 0;
  planetBannerEl.classList.remove("show");
  resetWorldEvents();
  resetBoss();
  showPlanetBanner(PLANET_WORLDS[0], 1);

  // Estrellas iniciales de bienvenida en el carril central
  spawnStarLine(0, 24, 6, 3.2, 0.62);
  resetHudCache();
  updateHUD();
}

function startGame() {
  audio.init();
  resetGame();
  gameState = STATE.PLAYING;
  startScreen.classList.remove("visible");
  pauseScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hudEl.classList.add("visible");
}

function pauseGame() {
  if (gameState !== STATE.PLAYING) return;
  gameState = STATE.PAUSED;
  pauseScreen.classList.add("visible");
}

function resumeGame() {
  if (gameState !== STATE.PAUSED) return;
  gameState = STATE.PLAYING;
  pauseScreen.classList.remove("visible");
}

function triggerGameOver(obstacle) {
  gameState = STATE.GAMEOVER;
  player.hurtTimer = 1.2;
  runStats.shake = 0.45;
  audio.crash();

  spawnParticles(player.x, player.y + 0.7, PLAYER_Z, 28, "#ff7ab8", 7, 6);
  spawnParticles(player.x, player.y + 0.7, PLAYER_Z, 20, "#8ae8ff", 6, 5);

  const finalScore = Math.floor(runStats.score);
  let isNewRecord = false;
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem(BEST_STORAGE_KEY, String(bestScore));
    bestHudEl.textContent = bestScore.toLocaleString("es-ES");
    isNewRecord = true;
  }

  stoppedByTextEl.innerHTML = `Te detuvo: <span>${obstacle.display}</span>`;
  finalScoreEl.textContent = finalScore.toLocaleString("es-ES");
  finalStarsEl.textContent = String(runStats.stars);
  finalBestEl.textContent = bestScore.toLocaleString("es-ES");
  motivationalQuoteEl.textContent = `"${obstacle.quote || pickFrom(GENERAL_QUOTES)}"`;
  newRecordPillEl.classList.toggle("visible", isNewRecord);

  hudEl.classList.remove("visible");
  setTimeout(() => {
    if (gameState === STATE.GAMEOVER) {
      gameOverScreen.classList.add("visible");
    }
  }, 360);
}

const hudCache = {
  stars: -1,
  score: -1,
  mult: "",
  glowPct: -1,
  shield: null,
  magnetActive: null,
  magnetText: "",
  magnetPct: -1,
  boostActive: null,
  boostText: "",
  boostPct: -1,
  planetIdx: -1,
  planetPct: -1
};

function resetHudCache() {
  hudCache.stars = -1;
  hudCache.score = -1;
  hudCache.mult = "";
  hudCache.glowPct = -1;
  hudCache.shield = null;
  hudCache.magnetActive = null;
  hudCache.magnetText = "";
  hudCache.magnetPct = -1;
  hudCache.boostActive = null;
  hudCache.boostText = "";
  hudCache.boostPct = -1;
  hudCache.planetIdx = -1;
  hudCache.planetPct = -1;
}

function showPlanetBanner(world, number) {
  planetBannerEl.innerHTML =
    `<div class="pb-kicker">Planeta ${number}</div>` +
    `<div class="pb-name" style="color:${world.accent}">${world.name}</div>` +
    `<div class="pb-sub">${world.subtitle}</div>`;
  planetBannerEl.classList.remove("show");
  void planetBannerEl.offsetWidth;
  planetBannerEl.classList.add("show");
}

function updateHUD() {
  if (hudCache.stars !== runStats.stars) {
    hudCache.stars = runStats.stars;
    starsCountEl.textContent = String(runStats.stars);
  }
  const intScore = Math.floor(runStats.score);
  if (hudCache.score !== intScore) {
    hudCache.score = intScore;
    scoreCountEl.textContent = intScore.toLocaleString("es-ES");
  }

  const multStr = `x${(1 + Math.min(2.0, runStats.combo * 0.1)).toFixed(1)}`;
  if (hudCache.mult !== multStr) {
    hudCache.mult = multStr;
    radianceLabelEl.textContent = multStr;
  }
  const fillPct = Math.round(Math.min(100, 12 + player.glowLevel * 88));
  if (hudCache.glowPct !== fillPct) {
    hudCache.glowPct = fillPct;
    radianceFillEl.style.width = `${fillPct}%`;
  }

  if (hudCache.planetIdx !== planetState.currentIndex) {
    hudCache.planetIdx = planetState.currentIndex;
    const w = PLANET_WORLDS[planetState.currentIndex];
    planetNameHudEl.textContent = w.name;
    planetDotEl.style.background = w.accent;
    planetDotEl.style.boxShadow = `0 0 10px ${w.accent}`;
  }
  const pPct = Math.round(planetState.progress * 100);
  if (hudCache.planetPct !== pPct) {
    hudCache.planetPct = pPct;
    planetProgressFillEl.style.width = `${pPct}%`;
  }

  if (hudCache.shield !== player.hasShield) {
    hudCache.shield = player.hasShield;
    shieldBadgeEl.classList.toggle("active", player.hasShield);
  }

  const magActive = player.magnetTimer > 0;
  if (hudCache.magnetActive !== magActive) {
    hudCache.magnetActive = magActive;
    magnetBadgeEl.classList.toggle("active", magActive);
  }
  if (magActive) {
    const mt = `${player.magnetTimer.toFixed(1)}s`;
    if (hudCache.magnetText !== mt) {
      hudCache.magnetText = mt;
      magnetTimerTextEl.textContent = mt;
    }
    const mp = Math.round(Math.max(0, (player.magnetTimer / 8) * 100));
    if (hudCache.magnetPct !== mp) {
      hudCache.magnetPct = mp;
      magnetFillEl.style.width = `${mp}%`;
    }
  }

  const boostActive = player.boostTimer > 0;
  if (hudCache.boostActive !== boostActive) {
    hudCache.boostActive = boostActive;
    boostBadgeEl.classList.toggle("active", boostActive);
  }
  if (boostActive) {
    const bt = `${player.boostTimer.toFixed(1)}s`;
    if (hudCache.boostText !== bt) {
      hudCache.boostText = bt;
      boostTimerTextEl.textContent = bt;
    }
    const bp = Math.round(Math.max(0, (player.boostTimer / BOOST_DURATION) * 100));
    if (hudCache.boostPct !== bp) {
      hudCache.boostPct = bp;
      boostFillEl.style.width = `${bp}%`;
    }
  }
  updateBossHud();
}

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("resumeBtn").addEventListener("click", resumeGame);
document.getElementById("restartFromPauseBtn").addEventListener("click", startGame);
document.getElementById("retryBtn").addEventListener("click", startGame);
pauseBtn.addEventListener("click", () => {
  if (gameState === STATE.PLAYING) pauseGame();
  else if (gameState === STATE.PAUSED) resumeGame();
});
soundBtn.addEventListener("click", () => {
  audio.init();
  const muted = audio.toggleMute();
  soundBtn.textContent = muted ? "🔇" : "🔊";
});

/* =========================================================================
   11. ACTUALIZACIÓN FÍSICA Y COLISIONES
========================================================================= */
function update(dt) {
  globalTime += dt;

  // Actualizar estrellas warp y motas ambientales
  const warpBoost = (1 + planetState.warpFlash * 2.2) * (player.boostTimer > 0 ? 2.4 : 1);
  const bgWarpFactor = (gameState === STATE.PLAYING ? (runStats.speed / 26) : 0.45) * warpBoost;
  for (const s of warpStreaks) {
    s.dist += s.speed * bgWarpFactor * dt;
    if (s.dist > 1.15) {
      s.dist = 0.03 + Math.random() * 0.08;
      s.angle = Math.random() * Math.PI * 2;
    }
  }
  for (const m of ambientMotes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt * (gameState === STATE.PLAYING ? 1.25 : 0.6);
    if (m.y < -0.05) { m.y = 0.88; m.x = Math.random(); }
    if (m.x < -0.05) m.x = 1.05;
    if (m.x > 1.05) m.x = -0.05;
  }

  if (planetState.transition < 1) {
    planetState.transition = Math.min(1, planetState.transition + dt * 0.45);
  }
  if (planetState.warpFlash > 0) {
    planetState.warpFlash = Math.max(0, planetState.warpFlash - dt * 1.15);
  }
  if (planetState.warpRing > 0) {
    planetState.warpRing += dt * 1.35;
    if (planetState.warpRing >= 1) planetState.warpRing = 0;
  }

  // Partículas y sacudida siguen animándose brevemente tras Game Over
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 6.5 * dt;
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life += dt;
    ft.y += 1.2 * dt;
    if (ft.life >= ft.maxLife) floatingTexts.splice(i, 1);
  }

  if (runStats.shake > 0) {
    runStats.shake = Math.max(0, runStats.shake - dt * 1.4);
  }

  if (gameState !== STATE.PLAYING) return;

  // Dificultad progresiva: velocidad aumenta suavemente con la distancia y puntaje
  const targetSpeed = Math.min(
    runStats.maxSpeed,
    runStats.baseSpeed + runStats.distance * 0.009 + runStats.stars * 0.035
  );
  runStats.speed += (Math.min(targetSpeed, bossSpeedCap()) * (player.boostTimer > 0 ? 1.48 : 1) - runStats.speed) * Math.min(1, dt * 2.4);

  const dz = runStats.speed * dt;
  runStats.distance += dz;
  runStats.worldScroll += dz;
  runStats.score += dz * 0.8;

  // Vértice tipo Temple Run + cambio de planeta
  updateWorldEvents(dt);

  // Decaimiento suave de combo y brillo
  if (runStats.comboTimer > 0) {
    runStats.comboTimer -= dt;
    if (runStats.comboTimer <= 0) runStats.combo = 0;
  }
  player.glowLevel = Math.max(0.22, player.glowLevel - dt * 0.035);

  // Movimiento suave entre carriles
  const targetX = LANES[player.targetLane];
  player.x += (targetX - player.x) * Math.min(1, dt * 16);
  player.tilt *= Math.pow(0.001, dt);

  // Animación 3D: giro de cuerpo al cambiar de carril, pirueta al saltar
  player.yawTarget *= Math.pow(0.004, dt);
  player.yaw += (player.yawTarget - player.yaw) * Math.min(1, dt * 16);
  player.laneDir += (Math.max(-1, Math.min(1, (targetX - player.x) * 1.2)) - player.laneDir) * Math.min(1, dt * 14);
  if (player.spinning) {
    player.spin += dt / 0.62;
    if (player.spin >= 1) { player.spin = 1; player.spinning = false; }
  }

  // COHETE ESTELAR: Alma surfea a hipervelocidad con estela arcoíris, imán automático y onda expansiva al aterrizar
  if (player.boostTimer > 0) {
    player.boostTimer -= dt;
    player.grounded = false;
    player.sliding = false;
    player.spinning = false;
    player.vy = 0;
    const cruiseY = 2.05 + Math.sin(globalTime * 5.2) * 0.12;
    player.y += (cruiseY - player.y) * Math.min(1, dt * 7.5);
    player.invulnTimer = Math.max(player.invulnTimer, 0.4);
    player.glowLevel = Math.min(1, player.glowLevel + dt * 0.25);
    runStats.shake = Math.max(runStats.shake, 0.04);

    // Chispas arcoíris saliendo de la tabla-cohete
    if (particles.length < MAX_PARTICLES - 2) {
      const rainbow = ["#ff6ec7", "#ffd86b", "#7be8ff", "#98ff9c"];
      const col = rainbow[Math.floor(globalTime * 18) % rainbow.length];
      particles.push({
        x: player.x + (Math.random() - 0.5) * 0.7,
        y: player.y + 0.25,
        z: PLAYER_Z - 0.45,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.6 + (Math.random() - 0.5) * 0.9,
        vz: -runStats.speed * 0.6,
        life: 0,
        maxLife: 0.36,
        color: col,
        size: 5 + Math.random() * 3.5
      });
    }

    // Cascada ondulante de estrellas doradas en el cielo (se detiene 1s antes de aterrizar)
    if (player.boostTimer > 1.0) {
      runStats.boostCoinTimer -= dt;
      if (runStats.boostCoinTimer <= 0) {
        runStats.boostCoinTimer = 0.11;
        const laneIdx = Math.round(1 + Math.sin(globalTime * 3.1));
        coins.push({
          x: LANES[Math.max(0, Math.min(2, laneIdx))],
          y: 2.25 + Math.cos(globalTime * 5) * 0.2,
          z: 46,
          collected: false,
          phase: globalTime * 4
        });
      }
    }

    if (player.boostTimer <= 0) {
      player.boostTimer = 0;
      player.vy = -2.2;
      player.invulnTimer = Math.max(player.invulnTimer, 1.8);
      runStats.shake = Math.max(runStats.shake, 0.22);

      // Onda expansiva estelar al terminar: rompe obstáculos cercanos en confeti
      let cleared = 0;
      for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].z > PLAYER_Z - 2 && obstacles[i].z < PLAYER_Z + 26) {
          spawnParticles(obstacles[i].x, 1.2, obstacles[i].z, 10, "#ffd86b", 6, 5);
          obstacles.splice(i, 1);
          cleared++;
        }
      }
      if (cleared > 0) {
        runStats.score += cleared * 100;
        addFloatingText(`💥 ¡Onda estelar! +${cleared * 100}`, "#ffe27a", 2.0);
      } else {
        addFloatingText("✨ ¡Aterrizaje estelar!", "#ffd9a0", 1.8);
      }
    }
  }

  // Física vertical (salto)
  if (!player.grounded && player.boostTimer <= 0) {
    player.vy -= 36 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      player.squashX = 1.18;
      player.squashY = 0.82;
    }
  }

  // Temporizador de deslizamiento
  if (player.sliding) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) {
      player.sliding = false;
    }
  }

  // Recuperar squash & stretch suavemente
  player.squashX += (1 - player.squashX) * Math.min(1, dt * 12);
  player.squashY += (1 - player.squashY) * Math.min(1, dt * 12);

  // Temporizadores de power-ups
  if (player.magnetTimer > 0) player.magnetTimer = Math.max(0, player.magnetTimer - dt);
  if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);

  // Estela brillante detrás de Alma
  player.trailTimer += dt;
  if (player.trailTimer >= 0.045) {
    player.trailTimer = 0;
    if (particles.length < MAX_PARTICLES) {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 0.35,
        y: player.y + (player.sliding ? 0.32 : 0.68) + (Math.random() - 0.5) * 0.25,
        z: PLAYER_Z - 0.35,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.3 + Math.random() * 0.6,
        vz: -runStats.speed * 0.32,
        life: 0,
        maxLife: 0.36,
        color: Math.random() < 0.72 ? "#8ae8ff" : "#ffd86b",
        size: 3.5 + player.glowLevel * 4.5
      });
    }
  }

  // Generador de oleadas
  runStats.spawnTimer -= dt;
  if (runStats.spawnTimer <= 0) {
    if (!bossBlocksWaves()) spawnWave();
    const minInterval = Math.max(0.95, 1.65 - (runStats.speed - runStats.baseSpeed) * 0.025);
    runStats.spawnTimer = minInterval + Math.random() * 0.36;
  }

  // Dimensiones actuales de la hitbox de Alma
  const playerBottom = player.y;
  const playerTop = player.y + (player.sliding ? 0.76 : 1.48);

  // Actualizar y verificar colisión con obstáculos
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.z -= (runStats.speed + ob.extraSpeed) * dt;

    if (ob.z < DESPAWN_Z || ob.shattered) {
      obstacles.splice(i, 1);
      continue;
    }

    // Chequeo de colisión cerca de PLAYER_Z
    const zHalf = ob.type === "large" ? 1.15 : 0.65;
    if (Math.abs(ob.z - PLAYER_Z) < zHalf && Math.abs(ob.x - player.x) < 0.85) {
      let hit = false;
      if (ob.type === "large") {
        hit = true;
      } else if (ob.type === "low") {
        // Saltar por encima (altura del obstáculo ~0.92)
        if (playerBottom < 0.82) hit = true;
      } else if (ob.type === "high") {
        // Deslizarse por debajo (base de la barrera suspendida en y = 1.05)
        if (playerTop > 1.02) hit = true;
      }

      if (hit) {
        if (player.invulnTimer > 0) {
          continue;
        } else if (player.hasShield) {
          player.hasShield = false;
          player.invulnTimer = 0.65;
          ob.shattered = true;
          runStats.score += 150;
          runStats.shake = 0.25;
          audio.shieldBreak();
          spawnParticles(ob.x, 1.1, ob.z, 26, "#ff9ed2", 7.5, 6);
          spawnParticles(ob.x, 1.1, ob.z, 20, "#8ae8ff", 6.5, 5);
          addFloatingText("¡Barrera superada con empatía! +150", "#9bf2ff", 1.85);
          obstacles.splice(i, 1);
        } else {
          triggerGameOver(ob);
          return;
        }
      }
    }
  }

  // Actualizar monedas / mini-estrellas doradas
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.z -= runStats.speed * dt;
    if (c.z < DESPAWN_Z) {
      coins.splice(i, 1);
      continue;
    }

    // Efecto Imán de Luz (también activo automáticamente durante el Cohete Estelar)
    if ((player.magnetTimer > 0 || player.boostTimer > 0) && c.z < PLAYER_Z + 22 && c.z > PLAYER_Z - 2.5) {
      const dx = player.x - c.x;
      const dy = (player.y + 0.72) - c.y;
      const dzm = PLAYER_Z - c.z;
      const pull = Math.min(1, dt * 11);
      c.x += dx * pull;
      c.y += dy * pull;
      c.z += dzm * pull * 0.75;
    }

    // Recolección
    const dx = Math.abs(c.x - player.x);
    const dy = Math.abs(c.y - (player.y + (player.sliding ? 0.45 : 0.78)));
    const dzc = Math.abs(c.z - PLAYER_Z);
    if (dx < 1.05 && dy < 1.05 && dzc < 1.15) {
      runStats.stars += 1;
      runStats.combo += 1;
      runStats.comboTimer = 2.6;
      const bonus = 10 + Math.min(20, runStats.combo);
      runStats.score += bonus;
      player.glowLevel = Math.min(1.0, player.glowLevel + 0.06);

      spawnParticles(c.x, c.y, c.z, 8, "#ffd86b", 3.6, 4.5);
      audio.star(runStats.combo);
      coins.splice(i, 1);
    }
  }

  // Actualizar Power-Ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.z -= runStats.speed * dt;
    if (pu.z < DESPAWN_Z) {
      powerups.splice(i, 1);
      continue;
    }

    const dx = Math.abs(pu.x - player.x);
    const dy = Math.abs(pu.y - (player.y + 0.75));
    const dzp = Math.abs(pu.z - PLAYER_Z);
    if (dx < 1.1 && dy < 1.25 && dzp < 1.2) {
      audio.powerup();
      if (pu.type === "shield") {
        player.hasShield = true;
        spawnParticles(pu.x, pu.y, pu.z, 22, "#ff9ed2", 5.5, 5.5);
        addFloatingText("🛡️ Escudo de Empatía", "#ffb8df", 1.9);
      } else if (pu.type === "rocket") {
        player.boostTimer = BOOST_DURATION;
        player.grounded = false;
        player.squashX = 0.8; player.squashY = 1.3;
        audio.rocket();
        spawnParticles(pu.x, pu.y, pu.z, 30, "#ff9a4a", 7, 6.5);
        spawnParticles(pu.x, pu.y, pu.z, 20, "#fff2a8", 6, 5);
        addFloatingText("¡COHETE! ¡A volar!", "#ffb066", 1.9);
      } else {
        player.magnetTimer = 8.0;
        spawnParticles(pu.x, pu.y, pu.z, 22, "#ffd86b", 5.5, 5.5);
        addFloatingText("🧲 Imán de Luz activado", "#ffe68c", 1.9);
      }
      powerups.splice(i, 1);
    }
  }

  // Letras de la palabra
  for (let i = letters.length - 1; i >= 0; i--) {
    const l = letters[i];
    l.z -= runStats.speed * dt;
    if (l.z < DESPAWN_Z) { letters.splice(i, 1); continue; }
    const dxl = Math.abs(l.x - player.x);
    const dyl = Math.abs(l.y - (player.y + (player.sliding ? 0.45 : 0.78)));
    const dzl = Math.abs(l.z - PLAYER_Z);
    if (dxl < 1.1 && dyl < 1.3 && dzl < 1.3) {
      letters.splice(i, 1);
      collectLetter(l);
    }
  }

  updateBoss(dt);
  updateHUD();
}

/* =========================================================================
   12. RENDERIZADO DE ESCENARIO PLANETA A PLANETA, CARRILES Y ENTIDADES 3D
========================================================================= */
function lerpRGB(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function rgbStr(c, alpha = 1) {
  return alpha >= 1
    ? `rgb(${c[0]},${c[1]},${c[2]})`
    : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function getBlendedWorld() {
  const fromW = PLANET_WORLDS[planetState.fromIndex];
  const toW = PLANET_WORLDS[planetState.currentIndex];
  const t = planetState.transition;
  if (t >= 1 || fromW === toW) return { w: toW, fromW, t: 1 };
  const ease = t * t * (3 - 2 * t);
  return { w: toW, fromW, t: ease };
}

function drawHeroPlanet(world, alpha, parallaxX) {
  if (alpha <= 0.01) return;
  const pl = world.planet;
  const px = pl.x * W + parallaxX * 0.28;
  const py = pl.y * H + Math.sin(globalTime * 0.45) * 6;
  const r = Math.min(W, H) * pl.r;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Efecto especial: Aurora Boreal en Auroria
  if (pl.style === "aurora") {
    ctx.save();
    for (let band = 0; band < 2; band++) {
      const baseY = H * (0.14 + band * 0.06);
      const grad = ctx.createLinearGradient(0, baseY - 36, 0, baseY + 52);
      grad.addColorStop(0, "rgba(114, 255, 216, 0)");
      grad.addColorStop(0.5, band === 0 ? "rgba(114, 255, 216, 0.28)" : "rgba(140, 170, 255, 0.22)");
      grad.addColorStop(1, "rgba(114, 255, 216, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, baseY + 50);
      for (let x = 0; x <= W; x += Math.max(40, W / 10)) {
        const wy = baseY + Math.sin(x * 0.006 + globalTime * (0.9 + band * 0.4) + band) * 20;
        ctx.lineTo(x, wy);
      }
      ctx.lineTo(W, baseY + 52);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Halo atmosférico del planeta
  const halo = ctx.createRadialGradient(px, py, r * 0.6, px, py, r * 1.9);
  halo.addColorStop(0, pl.ring);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(px, py, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  if (pl.extra === "rainbow") {
    ctx.lineWidth = r * 0.13;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `hsla(${i * 55}, 90%, 66%, 0.38)`;
      ctx.beginPath();
      ctx.arc(px, py + r * 0.9, r * (2.9 - i * 0.2), Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();
    }
  } else if (pl.extra === "heart") {
    ctx.strokeStyle = "rgba(255, 150, 205, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const hs = r * 1.15;
    ctx.moveTo(px, py + hs * 0.95);
    ctx.bezierCurveTo(px - hs * 1.9, py - hs * 0.2, px - hs * 0.9, py - hs * 1.55, px, py - hs * 0.55);
    ctx.bezierCurveTo(px + hs * 0.9, py - hs * 1.55, px + hs * 1.9, py - hs * 0.2, px, py + hs * 0.95);
    ctx.stroke();
  }

  if (pl.style === "binary") {
    // Estrellas binarias orbitando en Supernova
    const sep = r * 0.95;
    const ang = globalTime * 0.55;
    const bodies = [
      { x: px + Math.cos(ang) * sep, y: py + Math.sin(ang) * sep * 0.4, rad: r * 0.72, c1: "#9bf2ff", c2: "#3b229e" },
      { x: px - Math.cos(ang) * sep, y: py - Math.sin(ang) * sep * 0.4, rad: r * 0.52, c1: "#fff2a8", c2: "#e85c90" }
    ];
    for (const b of bodies) {
      const g = ctx.createRadialGradient(b.x - b.rad * 0.3, b.y - b.rad * 0.3, b.rad * 0.1, b.x, b.y, b.rad);
      g.addColorStop(0, b.c1);
      g.addColorStop(1, b.c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.rad, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Planeta principal con sombra esférica
    const pGrad = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, r * 0.1, px, py, r);
    pGrad.addColorStop(0, pl.c1);
    pGrad.addColorStop(1, pl.c2);
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // Anillos según estilo de planeta
    if (pl.style === "ringed" || pl.style === "coral" || pl.style === "loto") {
      ctx.strokeStyle = pl.ring;
      ctx.lineWidth = Math.max(3, r * 0.08);
      ctx.beginPath();
      ctx.ellipse(px, py, r * 1.85, r * 0.42, -0.24, 0, Math.PI * 2);
      ctx.stroke();
      if (pl.style === "coral") {
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        ctx.beginPath();
        ctx.ellipse(px, py, r * 2.2, r * 0.52, -0.24, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (pl.style === "solar") {
      // Corona solar suave
      ctx.strokeStyle = "rgba(255, 224, 130, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, r * (1.22 + Math.sin(globalTime * 2.5) * 0.04), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Luna pequeña compañera
    const mx = px + r * 1.65;
    const my = py - r * 0.55;
    const mr = r * 0.22;
    ctx.fillStyle = pl.c1;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHorizonSilhouette(horizonRGB, parallaxX) {
  const hy = H * 0.305;
  ctx.fillStyle = rgbStr(horizonRGB, 0.72);
  ctx.beginPath();
  ctx.moveTo(0, hy + 18);
  const steps = 12;
  const shift = (runStats.worldScroll * 0.008) + parallaxX * 0.004;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * W;
    const h1 = Math.sin(i * 1.15 + shift) * 14 + Math.cos(i * 2.3 - shift * 0.5) * 8;
    ctx.lineTo(x, hy - Math.max(0, h1 + 8));
  }
  ctx.lineTo(W, hy + 18);
  ctx.closePath();
  ctx.fill();
}

function drawAmbientMotes(world) {
  const amb = world.ambient;
  ctx.fillStyle = amb.color;
  for (const m of ambientMotes) {
    const mx = m.x * W;
    const my = m.y * H;
    const alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(globalTime * 2.5 + m.phase));
    ctx.globalAlpha = alpha;
    if (amb.shape === "bubble") {
      ctx.strokeStyle = amb.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(mx, my, m.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (amb.shape === "petal") {
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(globalTime + m.phase);
      ctx.beginPath();
      ctx.ellipse(0, 0, m.size * 1.2, m.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (amb.shape === "heart") {
      const hs = m.size * 0.9;
      ctx.beginPath();
      ctx.moveTo(mx, my + hs * 0.7);
      ctx.bezierCurveTo(mx - hs * 1.4, my - hs * 0.2, mx - hs * 0.6, my - hs * 1.1, mx, my - hs * 0.35);
      ctx.bezierCurveTo(mx + hs * 0.6, my - hs * 1.1, mx + hs * 1.4, my - hs * 0.2, mx, my + hs * 0.7);
      ctx.fill();
    } else if (amb.shape === "rainbow") {
      ctx.fillStyle = `hsl(${(m.phase * 57 + globalTime * 30) % 360}, 90%, 68%)`;
      ctx.beginPath();
      ctx.arc(mx, my, m.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (amb.shape === "crystal" || amb.shape === "diamond") {
      const s = m.size;
      ctx.beginPath();
      ctx.moveTo(mx, my - s);
      ctx.lineTo(mx + s * 0.7, my);
      ctx.lineTo(mx, my + s);
      ctx.lineTo(mx - s * 0.7, my);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(mx, my, m.size * 0.75, m.size * 0.75);
    }
  }
  ctx.globalAlpha = 1;
}

function drawSpaceBackdrop() {
  const { w: toW, fromW, t } = getBlendedWorld();
  const s0 = lerpRGB(fromW.sky[0], toW.sky[0], t);
  const s1 = lerpRGB(fromW.sky[1], toW.sky[1], t);
  const s2 = lerpRGB(fromW.sky[2], toW.sky[2], t);
  const s3 = lerpRGB(fromW.sky[3], toW.sky[3], t);

  // Gradiente profundo del planeta actual
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, rgbStr(s0));
  sky.addColorStop(0.32, rgbStr(s1));
  sky.addColorStop(0.65, rgbStr(s2));
  sky.addColorStop(1, rgbStr(s3));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Nebulosas suavemente interpoladas
  const parallaxX = -player.x * 8;
  for (const neb of nebulae) {
    const nc = lerpRGB(fromW.nebula[neb.slot], toW.nebula[neb.slot], t);
    const cx = neb.nx * W + parallaxX * 0.35;
    const cy = neb.ny * H;
    const rad = Math.max(W, H) * neb.rx;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, rgbStr(nc, 0.25));
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }

  // Estrellas titilantes lejanas (fillRect optimizado para evitar 120 arcs/frame)
  const starShift = parallaxX * 0.15;
  for (let i = 0; i < bgStars.length; i++) {
    const s = bgStars[i];
    const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(globalTime * s.twinkleSpeed + s.phase));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.hue;
    const sz = s.r * 1.45;
    ctx.fillRect(s.x * W + starShift, s.y * H, sz, sz);
  }
  ctx.globalAlpha = 1;

  // Planeta protagonista (fundido suave entre el anterior y el nuevo)
  if (t < 1 && fromW !== toW) {
    drawHeroPlanet(fromW, 1 - t, parallaxX);
  }
  drawHeroPlanet(toW, t, parallaxX);

  // Silueta de horizonte planetario
  drawHorizonSilhouette(lerpRGB(fromW.horizon, toW.horizon, t), parallaxX);

  // Partículas ambientales del mundo actual
  drawAmbientMotes(toW);

  // Líneas de velocidad estelar desde el horizonte
  const vpX = W * 0.5 - player.x * 10;
  const vpY = H * 0.30;
  const maxRad = Math.hypot(W, H) * 0.65;
  ctx.lineCap = "round";
  for (const w of warpStreaks) {
    const d1 = w.dist * maxRad;
    const d2 = (w.dist + w.len * (1 + planetState.warpFlash * 1.6)) * maxRad;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 1.2 + w.dist * 1.6;
    ctx.beginPath();
    ctx.moveTo(vpX + Math.cos(w.angle) * d1, vpY + Math.sin(w.angle) * d1 * 0.72);
    ctx.lineTo(vpX + Math.cos(w.angle) * d2, vpY + Math.sin(w.angle) * d2 * 0.72);
    ctx.stroke();
  }

  // Anillo de portal estelar al cruzar hacia un nuevo planeta
  if (planetState.warpRing > 0) {
    const prog = planetState.warpRing;
    const ringR = prog * Math.max(W, H) * 0.75;
    ctx.save();
    ctx.globalAlpha = (1 - prog) * 0.85;
    ctx.strokeStyle = toW.accent;
    ctx.lineWidth = 4 + (1 - prog) * 10;
    ctx.beginPath();
    ctx.ellipse(vpX, vpY, ringR, ringR * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/* ---------- DIBUJO DE ETIQUETA LEGIBLE SOBRE OBSTÁCULOS ---------- */
function drawObstacleBadge(cx, cy, label, scaleX, accentColor, indicator = "") {
  const fontSize = Math.max(10, Math.min(24, Math.round(scaleX * 0.25)));
  if (fontSize < 10) return;

  ctx.save();
  ctx.font = `800 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  const fullText = indicator ? `${indicator} ${label}` : label;
  const cacheKey = `${fontSize}:${fullText}`;
  let textWidth = badgeWidthCache.get(cacheKey);
  if (textWidth === undefined) {
    textWidth = ctx.measureText(fullText).width;
    if (badgeWidthCache.size > 400) badgeWidthCache.clear();
    badgeWidthCache.set(cacheKey, textWidth);
  }
  const padX = fontSize * 0.65;
  const padY = fontSize * 0.42;
  const bw = textWidth + padX * 2;
  const bh = fontSize + padY * 2;
  const rx = cx - bw * 0.5;
  const ry = cy - bh * 0.5;
  const radius = Math.min(10, bh * 0.35);

  // Caja oscura de alto contraste
  ctx.fillStyle = "rgba(10, 8, 24, 0.88)";
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = Math.max(1.2, fontSize * 0.11);
  ctx.beginPath();
  ctx.roundRect(rx, ry, bw, bh, radius);
  ctx.fill();
  ctx.stroke();

  // Texto nítido
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fullText, cx, cy + 1);
  ctx.restore();
}

/* ---------- DIBUJO DE OBSTÁCULOS 3D SIMBÓLICOS ---------- */
function drawObstacle(ob) {
  const zFront = Math.max(0.5, ob.z - (ob.type === "large" ? 1.15 : 0.45));
  const zBack = ob.z + (ob.type === "large" ? 1.15 : 0.45);
  const halfW = ob.type === "high" ? 1.08 : 0.96;

  if (ob.type === "large") {
    // Roca espacial oscura / monolito denso con grietas púrpuras
    const height = 2.05;
    const fBL = project(ob.x - halfW, 0, zFront);
    const fBR = project(ob.x + halfW, 0, zFront);
    const fTL = project(ob.x - halfW * 0.88, height, zFront);
    const fTR = project(ob.x + halfW * 0.88, height, zFront);
    const bTL = project(ob.x - halfW * 0.88, height, zBack);
    const bTR = project(ob.x + halfW * 0.88, height, zBack);
    if (!fBL || !fBR || !fTL || !fTR || !bTL || !bTR) return;

    // Cara superior
    ctx.fillStyle = ob.moving ? "#3e1d4a" : "#2e2445";
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();

    // Cara frontal de roca oscura
    const rockGrad = ctx.createLinearGradient(0, fTL.y, 0, fBL.y);
    rockGrad.addColorStop(0, ob.moving ? "#4b183d" : "#2f2342");
    rockGrad.addColorStop(1, "#120c20");
    ctx.fillStyle = rockGrad;
    ctx.strokeStyle = ob.moving ? "#ff6896" : "#8e5bd6";
    ctx.lineWidth = Math.max(1.5, fBL.scaleX * 0.04);
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(fBR.x, fBR.y);
    ctx.lineTo(fBL.x, fBL.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Facetas de roca: luz superior y sombra lateral para dar volumen
    const fw = fTR.x - fTL.x, fh = fBL.y - fTL.y;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y); ctx.lineTo(fTR.x, fTR.y); ctx.lineTo(fBR.x, fBR.y); ctx.lineTo(fBL.x, fBL.y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y); ctx.lineTo(fTL.x + fw * 0.6, fTL.y);
    ctx.lineTo(fTL.x + fw * 0.2, fTL.y + fh * 0.5); ctx.lineTo(fTL.x, fTL.y + fh * 0.4);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.moveTo(fTR.x, fTR.y + fh * 0.2); ctx.lineTo(fTR.x, fBR.y);
    ctx.lineTo(fTL.x + fw * 0.55, fBL.y); ctx.lineTo(fTL.x + fw * 0.8, fTL.y + fh * 0.55);
    ctx.fill();
    // Resplandor inferior de polvo oscuro
    const smoke = ctx.createLinearGradient(0, fBL.y - fh * 0.3, 0, fBL.y);
    smoke.addColorStop(0, "rgba(140,80,220,0)");
    smoke.addColorStop(1, "rgba(140,80,220,0.28)");
    ctx.fillStyle = smoke;
    ctx.fillRect(fTL.x, fBL.y - fh * 0.3, fw * 1.2, fh * 0.3);
    ctx.restore();

    // Grietas de energía oscura
    ctx.strokeStyle = ob.moving ? "rgba(255, 110, 150, 0.72)" : "rgba(182, 120, 255, 0.5)";
    ctx.lineWidth = Math.max(1, fBL.scaleX * 0.03);
    ctx.beginPath();
    ctx.moveTo(fTL.x + (fTR.x - fTL.x) * 0.25, fTL.y + (fBL.y - fTL.y) * 0.15);
    ctx.lineTo(fTL.x + (fTR.x - fTL.x) * 0.45, fTL.y + (fBL.y - fTL.y) * 0.45);
    ctx.lineTo(fTL.x + (fTR.x - fTL.x) * 0.35, fTL.y + (fBL.y - fTL.y) * 0.78);
    ctx.stroke();

    const center = project(ob.x, height * 0.56, zFront);
    if (center) {
      drawObstacleBadge(
        center.x,
        center.y,
        ob.label,
        center.scaleX,
        ob.moving ? "#ff6b9d" : "#b88cff",
        ob.moving ? "⚡" : ""
      );
    }
  } else if (ob.type === "high") {
    // Barrera suspendida de energía / nube densa (para pasar deslizándose por debajo)
    const bottomY = 1.05;
    const topY = 2.35;
    const fBL = project(ob.x - halfW, bottomY, zFront);
    const fBR = project(ob.x + halfW, bottomY, zFront);
    const fTL = project(ob.x - halfW, topY, zFront);
    const fTR = project(ob.x + halfW, topY, zFront);
    const gL = project(ob.x - halfW * 0.94, 0, zFront);
    const gR = project(ob.x + halfW * 0.94, 0, zFront);
    if (!fBL || !fBR || !fTL || !fTR || !gL || !gR) return;

    // Pilares laterales dejando claro el hueco inferior
    ctx.strokeStyle = "rgba(195, 120, 255, 0.75)";
    ctx.lineWidth = Math.max(2, fBL.scaleX * 0.08);
    ctx.beginPath();
    ctx.moveTo(gL.x, gL.y);
    ctx.lineTo(fTL.x, fTL.y);
    ctx.moveTo(gR.x, gR.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.stroke();

    // Nube/barrera superior
    const cloudGrad = ctx.createLinearGradient(0, fTL.y, 0, fBL.y);
    cloudGrad.addColorStop(0, "#3b1c5e");
    cloudGrad.addColorStop(1, "#1e1038");
    ctx.fillStyle = cloudGrad;
    ctx.strokeStyle = "#ff85e1";
    ctx.lineWidth = Math.max(1.5, fBL.scaleX * 0.045);
    ctx.beginPath();
    ctx.roundRect(fTL.x, fTL.y, fTR.x - fTL.x, fBL.y - fTL.y, Math.max(4, fBL.scaleX * 0.14));
    ctx.fill();
    ctx.stroke();

    const center = project(ob.x, (bottomY + topY) * 0.5, zFront);
    if (center) {
      drawObstacleBadge(center.x, center.y, ob.label, center.scaleX, "#ff85e1", "▼");
    }
  } else {
    // Obstáculo bajo: grieta de sombra o meteorito bajo (para saltar por encima)
    const height = 0.86;
    const fBL = project(ob.x - halfW, 0, zFront);
    const fBR = project(ob.x + halfW, 0, zFront);
    const fMid = project(ob.x, height, zFront);
    const fLPeak = project(ob.x - halfW * 0.52, height * 0.78, zFront);
    const fRPeak = project(ob.x + halfW * 0.55, height * 0.72, zFront);
    if (!fBL || !fBR || !fMid || !fLPeak || !fRPeak) return;

    // Resplandor de grieta en el suelo
    ctx.fillStyle = "rgba(255, 86, 136, 0.32)";
    ctx.beginPath();
    ctx.ellipse((fBL.x + fBR.x) * 0.5, fBL.y, (fBR.x - fBL.x) * 0.56, Math.max(4, fBL.scaleY * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();

    // Meteorito / picos de sombra
    const lowGrad = ctx.createLinearGradient(0, fMid.y, 0, fBL.y);
    lowGrad.addColorStop(0, "#4e1b44");
    lowGrad.addColorStop(1, "#130b24");
    ctx.fillStyle = lowGrad;
    ctx.strokeStyle = "#ff789e";
    ctx.lineWidth = Math.max(1.5, fBL.scaleX * 0.04);
    ctx.beginPath();
    ctx.moveTo(fBL.x, fBL.y);
    ctx.lineTo(fLPeak.x, fLPeak.y);
    ctx.lineTo(fMid.x, fMid.y);
    ctx.lineTo(fRPeak.x, fRPeak.y);
    ctx.lineTo(fBR.x, fBR.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const labelPos = project(ob.x, height + 0.32, zFront);
    if (labelPos) {
      drawObstacleBadge(labelPos.x, labelPos.y, ob.label, labelPos.scaleX, "#ff789e", "▲");
    }
  }
}

/* ---------- DIBUJO DE MONEDAS (SPRITE PRE-RENDERIZADO PARA 60FPS) ---------- */
function drawCoin(coin) {
  const bob = Math.sin(globalTime * 5 + coin.phase) * 0.11;
  const p = project(coin.x, coin.y + bob, coin.z);
  if (!p) return;

  const r = Math.max(4, p.scaleX * 0.34);
  const spin = Math.cos(globalTime * 4 + coin.phase);
  const drawW = Math.max(r * 1.4, Math.abs(spin) * r * 4.2);
  const drawH = r * 4.2;

  ctx.drawImage(coinSprite, p.x - drawW * 0.5, p.y - drawH * 0.5, drawW, drawH);
}

/* ---------- DIBUJO DE POWER-UPS ---------- */
/** Iconos vectoriales de los power-ups (sin emojis). r = radio del orbe. */
function drawPowerIcon(type, r) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (type === "shield") {
    // Escudo con corazón de empatía
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.66);
    ctx.bezierCurveTo(r * 0.45, -r * 0.55, r * 0.62, -r * 0.5, r * 0.62, -r * 0.2);
    ctx.bezierCurveTo(r * 0.62, r * 0.3, r * 0.25, r * 0.56, 0, r * 0.72);
    ctx.bezierCurveTo(-r * 0.25, r * 0.56, -r * 0.62, r * 0.3, -r * 0.62, -r * 0.2);
    ctx.bezierCurveTo(-r * 0.62, -r * 0.5, -r * 0.45, -r * 0.55, 0, -r * 0.66);
    const g = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, "#c8f7ff"); g.addColorStop(1, "#3fb6ee");
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#e9fdff"; ctx.lineWidth = r * 0.08; ctx.stroke();
    // corazón
    ctx.fillStyle = "#ff5c93";
    ctx.beginPath();
    ctx.moveTo(0, r * 0.32);
    ctx.bezierCurveTo(-r * 0.46, -r * 0.02, -r * 0.26, -r * 0.34, 0, -r * 0.12);
    ctx.bezierCurveTo(r * 0.26, -r * 0.34, r * 0.46, -r * 0.02, 0, r * 0.32);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath(); ctx.ellipse(-r * 0.14, -r * 0.14, r * 0.07, r * 0.04, -0.6, 0, Math.PI * 2); ctx.fill();
  } else if (type === "magnet") {
    // Imán de herradura
    const R = r * 0.40;
    ctx.lineWidth = r * 0.30;
    ctx.lineCap = "butt";
    ctx.strokeStyle = "#ff4d6d";
    ctx.beginPath(); ctx.arc(0, -r * 0.05, R, Math.PI, 0, false); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R, -r * 0.05); ctx.lineTo(-R, r * 0.26); ctx.moveTo(R, -r * 0.05); ctx.lineTo(R, r * 0.26); ctx.stroke();
    ctx.strokeStyle = "#eef6ff";
    ctx.beginPath(); ctx.moveTo(-R, r * 0.26); ctx.lineTo(-R, r * 0.52); ctx.moveTo(R, r * 0.26); ctx.lineTo(R, r * 0.52); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(0, -r * 0.05, R + r * 0.06, Math.PI * 1.05, Math.PI * 1.7, false); ctx.stroke();
    // chispas
    ctx.fillStyle = "#ffe27a";
    for (const [sx, sy] of [[-0.62, -0.5], [0.6, -0.55], [0, -0.82]]) {
      ctx.beginPath(); ctx.arc(r * sx, r * sy, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Cohete
    ctx.rotate(0.6);
    const fl = 0.28 + Math.sin(globalTime * 40) * 0.08;
    ctx.fillStyle = "#ff8a2a";
    ctx.beginPath(); ctx.moveTo(-r * 0.14, r * 0.5); ctx.quadraticCurveTo(0, r * (0.9 + fl), r * 0.14, r * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff2a8";
    ctx.beginPath(); ctx.moveTo(-r * 0.07, r * 0.5); ctx.quadraticCurveTo(0, r * (0.75 + fl * 0.6), r * 0.07, r * 0.5); ctx.closePath(); ctx.fill();
    // aletas
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath(); ctx.moveTo(-r * 0.22, r * 0.12); ctx.lineTo(-r * 0.5, r * 0.58); ctx.lineTo(-r * 0.2, r * 0.46); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(r * 0.22, r * 0.12); ctx.lineTo(r * 0.5, r * 0.58); ctx.lineTo(r * 0.2, r * 0.46); ctx.closePath(); ctx.fill();
    // cuerpo
    const bg = ctx.createLinearGradient(-r * 0.25, 0, r * 0.25, 0);
    bg.addColorStop(0, "#dfe8f7"); bg.addColorStop(0.5, "#ffffff"); bg.addColorStop(1, "#b8c6e0");
    ctx.fillStyle = bg;
    ctx.strokeStyle = "#5b6a86"; ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.78);
    ctx.bezierCurveTo(r * 0.34, -r * 0.45, r * 0.28, r * 0.1, r * 0.22, r * 0.52);
    ctx.lineTo(-r * 0.22, r * 0.52);
    ctx.bezierCurveTo(-r * 0.28, r * 0.1, -r * 0.34, -r * 0.45, 0, -r * 0.78);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // nariz roja
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.78);
    ctx.bezierCurveTo(r * 0.2, -r * 0.6, r * 0.27, -r * 0.42, r * 0.28, -r * 0.34);
    ctx.lineTo(-r * 0.28, -r * 0.34);
    ctx.bezierCurveTo(-r * 0.27, -r * 0.42, -r * 0.2, -r * 0.6, 0, -r * 0.78);
    ctx.fill();
    // ventana
    ctx.fillStyle = "#4fc3f7"; ctx.strokeStyle = "#2b6fa8"; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.13, r * 0.04, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPowerup(pu) {
  const bob = Math.sin(globalTime * 4.5 + pu.phase) * 0.16;
  const p = project(pu.x, pu.y + bob, pu.z);
  if (!p) return;

  const r = Math.max(9, p.scaleX * 0.56);
  const style = {
    shield: ["rgba(255, 122, 184, 0.5)", "#8ae8ff"],
    magnet: ["rgba(255, 216, 107, 0.5)", "#ffe27a"],
    rocket: ["rgba(255, 120, 50, 0.6)", "#ffae5c"]
  }[pu.type];

  ctx.save();
  ctx.translate(p.x, p.y);

  const pulse = 1 + Math.sin(globalTime * 6 + pu.phase) * 0.08;
  const orbGlow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.1 * pulse);
  orbGlow.addColorStop(0, style[0]);
  orbGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = orbGlow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.1 * pulse, 0, Math.PI * 2);
  ctx.fill();

  const orb = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  orb.addColorStop(0, "rgba(60, 50, 130, 0.95)");
  orb.addColorStop(1, "rgba(14, 12, 40, 0.95)");
  ctx.fillStyle = orb;
  ctx.strokeStyle = style[1];
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawPowerIcon(pu.type, r);
  ctx.restore();
}

/** Letra coleccionable: baldosa dorada brillante estilo arcade. */
function drawLetter(l) {
  const bob = Math.sin(globalTime * 4 + l.phase) * 0.15;
  const p = project(l.x, l.y + bob, l.z);
  if (!p) return;
  const r = Math.max(13, p.scaleX * 0.66);

  ctx.save();
  ctx.translate(p.x, p.y);

  const halo = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 2.4);
  halo.addColorStop(0, "rgba(255, 226, 122, 0.65)");
  halo.addColorStop(1, "rgba(255, 150, 60, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2); ctx.fill();

  ctx.rotate(Math.sin(globalTime * 3 + l.phase) * 0.14);
  const s = 1 + Math.sin(globalTime * 7 + l.phase) * 0.05;
  ctx.scale(s, s);

  const tg = ctx.createLinearGradient(0, -r, 0, r);
  tg.addColorStop(0, "#fff6c2");
  tg.addColorStop(0.5, "#ffd24d");
  tg.addColorStop(1, "#ff9a3c");
  ctx.fillStyle = tg;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.38);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.roundRect(-r * 0.82, -r * 0.86, r * 1.64, r * 0.5, r * 0.25);
  ctx.fill();

  ctx.font = `900 ${Math.round(r * 1.5)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#4a1580";
  ctx.fillText(l.ch, 0, r * 0.07);
  ctx.restore();
}

/* ---------- RENDER PRINCIPAL ---------- */
function render() {
  ctx.save();
  if (runStats.shake > 0) {
    const mag = runStats.shake * 16;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  drawSpaceBackdrop();
  drawLuminousTrack();
  drawRoadsideProps();

  // Ordenar todas las entidades en profundidad (Painter's Algorithm: mayor Z primero)
  drawQueue.length = 0;
  for (const ob of obstacles) {
    drawQueue.push({ z: ob.z, kind: "obstacle", item: ob });
  }
  for (const coin of coins) {
    drawQueue.push({ z: coin.z, kind: "coin", item: coin });
  }
  for (const pu of powerups) {
    drawQueue.push({ z: pu.z, kind: "powerup", item: pu });
  }
  for (const l of letters) {
    drawQueue.push({ z: l.z, kind: "letter", item: l });
  }
  if (gate) drawQueue.push({ z: gate.z, kind: "gate", item: gate });
  if (boss) drawQueue.push({ z: boss.z, kind: "boss", item: boss });
  for (const s of shots) drawQueue.push({ z: s.z, kind: "shot", item: s });
  for (const a of ammoPickups) drawQueue.push({ z: a.z, kind: "ammo", item: a });
  if (gameState !== STATE.START) {
    drawQueue.push({ z: PLAYER_Z, kind: "player" });
  }

  drawQueue.sort((a, b) => b.z - a.z);

  for (const entry of drawQueue) {
    if (entry.kind === "obstacle") {
      drawObstacle(entry.item);
    } else if (entry.kind === "coin") {
      drawCoin(entry.item);
    } else if (entry.kind === "powerup") {
      drawPowerup(entry.item);
        } else if (entry.kind === "letter") {
          drawLetter(entry.item);
    } else if (entry.kind === "gate") {
      drawGate(entry.item);
    } else if (entry.kind === "boss") {
      drawBoss(entry.item);
    } else if (entry.kind === "shot") {
      drawShot(entry.item);
    } else if (entry.kind === "ammo") {
      drawAmmoPickup(entry.item);
    } else if (entry.kind === "player") {
      // Sombra luminosa proyectada en el carril bajo Alma
      const shadowP = project(player.x, 0.02, PLAYER_Z);
      if (shadowP) {
        const shadowScale = Math.max(0.45, 1 - player.y * 0.28);
        const sr = shadowP.scaleX * 0.62 * shadowScale;
        ctx.fillStyle = `rgba(123, 232, 255, ${0.32 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(shadowP.x, shadowP.y, sr, sr * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dibujar a Alma en su posición actual
      const bob = player.grounded && !player.sliding ? Math.sin(globalTime * 11) * 0.08 : 0;
      const p = project(player.x, player.y + (player.sliding ? 0.48 : 0.85) + bob, PLAYER_Z);
      if (p) {
        // Alejar ligeramente la escala de Alma durante el cohete para dejar amplia visibilidad de la pista
        const size = p.scaleY * (player.boostTimer > 0 ? 1.12 : 1.48);
        // Parpadeo breve solo durante invulnerabilidad post-escudo (nunca durante el Cohete Estelar)
        if (player.boostTimer > 0 || player.invulnTimer <= 0 || Math.floor(globalTime * 20) % 2 === 0) {
          drawAlma(ctx, p.x, p.y, size, {
            time: globalTime,
            tilt: player.tilt,
            squashX: player.squashX,
            squashY: player.squashY,
            sliding: player.sliding,
            hasShield: player.hasShield,
            glowLevel: player.glowLevel,
            isHurt: player.hurtTimer > 0,
            yaw: player.yaw + (player.spinning ? (1 - Math.pow(1 - player.spin, 3)) * Math.PI * 2 : 0),
            pitch: Math.max(-0.5, Math.min(0.5, player.vy * 0.025)),
            grounded: player.grounded,
            vy: player.vy,
            laneDir: player.laneDir,
            boosting: player.boostTimer > 0
          });
        }

        if (boss) drawMegaphone(p.x, p.y, size);

        // Rayos de atracción visual cuando el Imán de Luz está activo
        if (player.magnetTimer > 0) {
          ctx.save();
          ctx.strokeStyle = "rgba(255, 224, 120, 0.35)";
          ctx.lineWidth = 1.6;
          for (const c of coins) {
            if (c.z < PLAYER_Z + 14 && c.z > PLAYER_Z - 1.5) {
              const cp = project(c.x, c.y, c.z);
              if (cp) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(cp.x, cp.y);
                ctx.stroke();
              }
            }
          }
          ctx.restore();
        }
      }
    }
  }

  // Partículas luminosas y destellos
  for (const pt of particles) {
    const p = project(pt.x, pt.y, pt.z);
    if (!p) continue;
    const alpha = 1 - pt.life / pt.maxLife;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = pt.color;
    const pr = Math.max(1.5, pt.size * p.invZ * 4.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Textos flotantes de feedback
  for (const ft of floatingTexts) {
    const p = project(ft.x, ft.y, ft.z);
    if (!p) continue;
    const alpha = 1 - ft.life / ft.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `800 ${Math.max(15, Math.round(W * 0.018))}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#08061a";
    ctx.fillText(ft.text, p.x + 2, p.y + 2);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, p.x, p.y);
    ctx.restore();
  }

  // Líneas de velocidad arcade sutiles solo en los bordes exteriores durante el Cohete Estelar
  if (player.boostTimer > 0) {
    ctx.save();
    const cx = W * 0.5;
    const cy = H * 0.42;
    const outerR = Math.hypot(W, H) * 0.62;
    const colors = ["rgba(255, 216, 107, 0.34)", "rgba(138, 232, 255, 0.34)", "rgba(255, 110, 199, 0.30)"];
    ctx.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + Math.sin(globalTime * 3 + i) * 0.04;
      const pulse = ((globalTime * 4.2 + i * 0.37) % 1);
      const r1 = outerR * (0.76 + pulse * 0.16);
      const r2 = outerR * (0.96 + pulse * 0.16);
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 1.6 + (1 - pulse) * 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Destello suave de salto estelar al llegar a un nuevo planeta
  if (planetState.warpFlash > 0.01) {
    ctx.fillStyle = `rgba(220, 248, 255, ${planetState.warpFlash * 0.28})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Viñeta cósmica cacheada para rendimiento estable
  if (cachedVignette) {
    ctx.fillStyle = cachedVignette;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

/* =========================================================================
   13. ANIMACIÓN DE PREVIEW DE ALMA EN LA PANTALLA DE INICIO
========================================================================= */
function renderStartPreview() {
  if (gameState !== STATE.START) return;
  const pw = previewCanvas.width;
  const ph = previewCanvas.height;
  previewCtx.clearRect(0, 0, pw, ph);
  const floatY = Math.sin(globalTime * 2.8) * 10;
  drawAlma(previewCtx, pw * 0.5, ph * 0.53 + floatY, 175, {
    time: globalTime,
    tilt: Math.sin(globalTime * 1.6) * 0.06,
    glowLevel: 0.65,
    isPreview: true
  });
}

/* =========================================================================
   14. BUCLE PRINCIPAL (REQUESTANIMATIONFRAME)
========================================================================= */
let lastTs = performance.now();

document.addEventListener("visibilitychange", () => {
  if (document.hidden && gameState === STATE.PLAYING) {
    pauseGame();
  } else {
    lastTs = performance.now();
  }
});

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
  lastTs = now;

  update(dt);
  render();
  renderStartPreview();
}

requestAnimationFrame(loop);
