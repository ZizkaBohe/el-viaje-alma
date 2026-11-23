"use strict";

/* =========================================================================
   JEFES, MEGÁFONO DE LUZ Y MUNICIÓN DE PALABRAS BONITAS
   -------------------------------------------------------------------------
   Cada cierto tiempo aparece un jefe (una barrera social gigante) con 3 vidas.
   Alma lleva un "Megáfono de Luz": su munición son palabras bonitas que se
   recogen en el camino. Dispara con F / E, con clic en el megáfono del HUD o
   tocando la pantalla. Cada palabra que impacta le quita una vida.
   ========================================================================= */

const BOSS_Z = 38;
let boss = null;
let shots = [];
let ammoPickups = [];
const bossState = { nextAt: BOSS_FIRST_DISTANCE, defeated: 0, lastSkin: null };
const weapon = { ammo: [], cooldown: 0, recoil: 0 };

const bossHudEl = document.getElementById("bossHud");
const bossNameEl = document.getElementById("bossName");
const bossLivesEl = document.getElementById("bossLives");
const weaponHudEl = document.getElementById("weaponHud");
const ammoRowEl = document.getElementById("ammoRow");
let bossHudSig = "#";
let ammoSig = "#";
let bossHudVisible = false;

const HEART_SVG = '<svg class="heart" viewBox="0 0 24 24" width="26" height="26"><path d="M12 21s-7.500-4.600-9.600-9.200C.9 8.400 2.600 4.500 6.300 4.500c2.200 0 3.700 1.200 4.400 2.500.8-1.300 2.300-2.500 4.500-2.500 3.700 0 5.400 3.900 3.900 7.300C19.500 16.400 12 21 12 21z"/></svg>';

function bossIsActive() { return !!boss; }
function bossBlocksWaves() { return !!boss; }
function bossSpeedCap() { return boss ? 22 : 999; }

function resetBoss() {
  boss = null;
  shots = [];
  ammoPickups = [];
  weapon.ammo = [];
  weapon.cooldown = 0;
  weapon.recoil = 0;
  bossState.nextAt = BOSS_FIRST_DISTANCE;
  bossState.defeated = 0;
  bossState.lastSkin = null;
  bossHudSig = "#";
  ammoSig = "#";
  updateBossHud();
}

function showBanner(kicker, title, color, sub) {
  planetBannerEl.innerHTML =
    `<div class="pb-kicker">${kicker}</div>` +
    `<div class="pb-name" style="color:${color}">${title}</div>` +
    `<div class="pb-sub">${sub}</div>`;
  planetBannerEl.classList.remove("show");
  void planetBannerEl.offsetWidth;
  planetBannerEl.classList.add("show");
}

function startBoss() {
  const pool = BOSS_ROSTER.filter((b) => b.skin !== bossState.lastSkin);
  const def = pickFrom(pool.length ? pool : BOSS_ROSTER);
  bossState.lastSkin = def.skin;
  weapon.ammo = [];
  for (let i = 0; i < 3; i++) weapon.ammo.push(pickFrom(AMMO_WORDS));
  boss = {
    def, lives: BOSS_LIVES, z: SPAWN_Z, x: 0, phase: "intro",
    t: 0, attackTimer: 1.2, hitFlash: 0, attackAnim: 0, attackCount: 0,
    scale: 1, dyingT: 0
  };
  audio.bossAppear();
  runStats.shake = Math.max(runStats.shake, 0.3);
  showBanner("¡Jefe!", def.name, def.color, "Dispara palabras bonitas: F o toca el megáfono");
}

function fireWord() {
  if (gameState !== STATE.PLAYING || !boss || boss.phase !== "fight") return;
  if (weapon.cooldown > 0) return;
  if (weapon.ammo.length === 0) {
    addFloatingText("¡Sin palabras! Recoge más", "#ffb8df", 2.0);
    weapon.cooldown = 0.45;
    return;
  }
  const word = weapon.ammo.shift();
  shots.push({ x: player.x, y: player.y + 1.35, z: PLAYER_Z + 1.2, word });
  weapon.cooldown = 0.28;
  weapon.recoil = 1;
  spawnParticles(player.x, player.y + 1.4, PLAYER_Z + 0.8, 8, "#ffe27a", 4, 4.5);
  audio.shoot();
  updateBossHud();
}

function hitBoss(s) {
  boss.lives--;
  boss.hitFlash = 1;
  runStats.score += 100;
  runStats.shake = Math.max(runStats.shake, 0.3);
  spawnParticles(boss.x, 6, boss.z, 14, "#ffe27a", 7, 6);
  spawnParticles(boss.x, 6, boss.z, 10, "#ff9ed2", 6, 5);
  floatingTexts.push({ text: `¡${s.word}!`, color: "#ffe27a", x: boss.x, y: 9.5, z: boss.z, life: 0, maxLife: 1.3 });
  audio.bossHit();
  if (boss.lives <= 0) {
    boss.phase = "dying";
    boss.dyingT = 0;
    audio.bossDefeat();
  } else {
    boss.attackTimer = Math.max(boss.attackTimer, 1.1);
  }
  updateBossHud();
}

function finishBoss() {
  const bonus = 1000 + 500 * bossState.defeated;
  runStats.score += bonus;
  bossState.defeated++;
  bossState.nextAt = runStats.distance + BOSS_INTERVAL;
  const def = boss.def;
  boss = null;
  shots = [];
  weapon.ammo = [];
  player.hasShield = true;
  for (let i = 0; i < 3; i++) spawnStarLine(LANES[i], 44, 6, 3.0, 0.62);
  for (const c of ["#ffe27a", "#ff7ab8", "#8ae8ff", "#b88cff", "#ffffff"]) {
    spawnParticles(player.x, player.y + 1.0, PLAYER_Z, 18, c, 9, 6);
  }
  showBanner("¡Victoria!", `Superaste ${def.label.toLowerCase()}`, "#ffe27a",
    `+${bonus.toLocaleString("es-ES")} puntos · Escudo de Empatía`);
  updateBossHud();
}

function bossAttack() {
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const safe = lanes[0];
  const chances = [0.95, 0.6];
  for (let k = 1; k <= 2; k++) {
    if (Math.random() < chances[k - 1]) {
      const roll = Math.random();
      const type = roll < 0.45 ? "large" : (roll < 0.75 ? "low" : "high");
      obstacles.push(createObstacle(lanes[k], type, boss.z + 1.5, false));
    }
  }
  spawnParticles(boss.x, 5.5, boss.z, 14, boss.def.color, 6, 6);
  boss.attackAnim = 1;
  boss.attackCount++;
  audio.bossAttack();
  if ((boss.attackCount % 2 === 0 || weapon.ammo.length === 0) && ammoPickups.length < 2) {
    ammoPickups.push({
      x: LANES[safe], y: 1.0, z: boss.z + 3.5,
      word: pickFrom(AMMO_WORDS), phase: Math.random() * 6
    });
  }
}

function updateBoss(dt) {
  // Disparo de un nuevo jefe
  if (!boss && runStats.distance >= bossState.nextAt && !gate && player.boostTimer <= 0 && gameState === STATE.PLAYING) {
    startBoss();
  }

  weapon.cooldown = Math.max(0, weapon.cooldown - dt);
  weapon.recoil = Math.max(0, weapon.recoil - dt * 5);

  // Palabras disparadas
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.z += 78 * dt;
    if (particles.length < MAX_PARTICLES) {
      particles.push({
        x: s.x, y: s.y, z: s.z - 0.6, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8,
        vz: -6, life: 0, maxLife: 0.3, color: Math.random() < 0.5 ? "#ffe27a" : "#ffb8df", size: 4
      });
    }
    if (boss && boss.phase === "fight" && s.z >= boss.z - 2.2) {
      shots.splice(i, 1);
      hitBoss(s);
      continue;
    }
    if (s.z > SPAWN_Z + 20) shots.splice(i, 1);
  }

  // Palabras-munición recogibles
  for (let i = ammoPickups.length - 1; i >= 0; i--) {
    const a = ammoPickups[i];
    a.z -= runStats.speed * dt;
    if (a.z < DESPAWN_Z) { ammoPickups.splice(i, 1); continue; }
    const dx = Math.abs(a.x - player.x);
    const dy = Math.abs(a.y - (player.y + (player.sliding ? 0.45 : 0.78)));
    const dz = Math.abs(a.z - PLAYER_Z);
    if (dx < 1.15 && dy < 1.4 && dz < 1.3) {
      ammoPickups.splice(i, 1);
      if (weapon.ammo.length < MAX_AMMO) weapon.ammo.push(a.word);
      spawnParticles(a.x, a.y, a.z, 10, "#8ae8ff", 4.5, 5);
      addFloatingText(`+ ${a.word}`, "#8ae8ff", 2.0);
      audio.ammo();
      updateBossHud();
    }
  }

  if (!boss) return;

  boss.t += dt;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt * 2.5);
  boss.attackAnim = Math.max(0, boss.attackAnim - dt * 2);

  if (boss.phase === "intro") {
    boss.z += (BOSS_Z - boss.z) * Math.min(1, dt * 1.6);
    boss.x = Math.sin(boss.t * 0.9) * LANE_WIDTH * 0.5;
    if (Math.abs(boss.z - BOSS_Z) < 0.8 && boss.t > 1.9) {
      boss.phase = "fight";
      boss.attackTimer = 1.0;
      updateBossHud();
    }
  } else if (boss.phase === "fight") {
    boss.x = Math.sin(boss.t * 0.9) * LANE_WIDTH * 0.85;
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      bossAttack();
      boss.attackTimer = Math.max(1.5, 2.7 - (BOSS_LIVES - boss.lives) * 0.4 - bossState.defeated * 0.12);
    }
  } else if (boss.phase === "dying") {
    boss.dyingT += dt;
    boss.scale = Math.max(0.001, 1 - boss.dyingT / 1.8);
    if (particles.length < MAX_PARTICLES) {
      spawnParticles(boss.x + (Math.random() - 0.5) * 4, 4 + Math.random() * 4, boss.z, 2,
        Math.random() < 0.5 ? "#ffe27a" : "#ff9ed2", 5, 6);
    }
    if (boss.dyingT >= 1.8) finishBoss();
  }
}

/* ---------- HUD del jefe y del arma (solo toca el DOM al cambiar) ---------- */
function updateBossHud() {
  const sig = boss ? `${boss.def.name}|${boss.lives}` : "";
  if (sig !== bossHudSig) {
    bossHudSig = sig;
    if (boss) {
      bossNameEl.textContent = boss.def.name;
      let h = "";
      for (let i = 0; i < BOSS_LIVES; i++) h += i < boss.lives ? HEART_SVG : HEART_SVG.replace('class="heart"', 'class="heart lost"');
      bossLivesEl.innerHTML = h;
    }
  }
  const visible = !!boss;
  if (visible !== bossHudVisible) {
    bossHudVisible = visible;
    bossHudEl.classList.toggle("active", visible);
    weaponHudEl.classList.toggle("active", visible);
    wordHudEl.classList.toggle("hidden-for-boss", visible);
  }
  const asig = weapon.ammo.join("|");
  if (asig !== ammoSig) {
    ammoSig = asig;
    let h = "";
    for (let i = 0; i < MAX_AMMO; i++) {
      h += weapon.ammo[i]
        ? `<span class="ammo-chip full">${weapon.ammo[i]}</span>`
        : '<span class="ammo-chip empty"></span>';
    }
    ammoRowEl.innerHTML = h;
  }
}

weaponHudEl.addEventListener("click", () => { fireWord(); weaponHudEl.blur(); });

// Tocar la pantalla (sin deslizar) también dispara durante el jefe
canvas.addEventListener("touchend", () => {
  if (!touchHandled && gameState === STATE.PLAYING && boss) fireWord();
}, { passive: true });

/* =========================================================================
   DIBUJO
========================================================================= */
function drawHeartShape(x, y, s, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.7, y - s * 0.2, x - s * 0.8, y - s * 1.4, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 1.4, x + s * 1.7, y - s * 0.2, x, y + s * 0.9);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

/* ---------- SKINS INDIVIDUALES DE LOS 3 JEFES ---------- */

/** Skin 1: EXCLUSIÓN — Fortaleza blindada con rejas, escudos-puerta y corona de hierro. */
function drawBossSkinExclusion(b, R, light, hurt, look) {
  const def = b.def;
  const armLift = b.attackAnim * R * 0.55;

  // Escudos-reja flotantes a los costados (puertas cerradas)
  for (const sd of [-1, 1]) {
    const sx = sd * R * 1.18;
    const sy = R * 0.05 - armLift;
    const sw = R * 0.42, sh = R * 0.78;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(sd * (0.12 - b.attackAnim * 0.2));
    ctx.fillStyle = "#26102c";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = Math.max(2, R * 0.045);
    ctx.beginPath();
    ctx.roundRect(-sw * 0.5, -sh * 0.5, sw, sh, R * 0.08);
    ctx.fill();
    ctx.stroke();
    // Barrotes de la reja
    ctx.strokeStyle = "rgba(255, 130, 185, 0.75)";
    ctx.lineWidth = Math.max(1.5, R * 0.03);
    ctx.beginPath();
    ctx.moveTo(-sw * 0.16, -sh * 0.42); ctx.lineTo(-sw * 0.16, sh * 0.42);
    ctx.moveTo(sw * 0.16, -sh * 0.42); ctx.lineTo(sw * 0.16, sh * 0.42);
    ctx.moveTo(-sw * 0.42, 0); ctx.lineTo(sw * 0.42, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Cuerpo hexagonal acorazado (muro oscuro)
  const bg = ctx.createLinearGradient(0, -R, 0, R);
  bg.addColorStop(0, `rgb(${Math.round(78 + light * 110)},${Math.round(24 + light * 90)},${Math.round(74 + light * 100)})`);
  bg.addColorStop(1, "#1a0a24");
  ctx.fillStyle = bg;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = Math.max(2, R * 0.055);
  ctx.beginPath();
  ctx.moveTo(-R * 0.62, -R * 0.96);
  ctx.lineTo(R * 0.62, -R * 0.96);
  ctx.lineTo(R * 1.02, -R * 0.25);
  ctx.lineTo(R * 0.82, R * 0.82);
  ctx.lineTo(0, R * 1.04);
  ctx.lineTo(-R * 0.82, R * 0.82);
  ctx.lineTo(-R * 1.02, -R * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Almenas de fortaleza en la cabeza
  ctx.fillStyle = "#36123e";
  for (const bx of [-0.46, 0, 0.46]) {
    ctx.beginPath();
    ctx.roundRect(bx * R - R * 0.15, -R * 1.18, R * 0.30, R * 0.26, R * 0.05);
    ctx.fill();
    ctx.stroke();
  }

  // Grietas doradas que crecen al perder vidas
  if (b.lives < BOSS_LIVES) {
    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = Math.max(2, R * 0.04);
    ctx.beginPath();
    ctx.moveTo(-R * 0.4, -R * 0.55); ctx.lineTo(-R * 0.12, -R * 0.2); ctx.lineTo(-R * 0.32, R * 0.18);
    if (b.lives <= 1) {
      ctx.moveTo(R * 0.42, -R * 0.48); ctx.lineTo(R * 0.14, 0); ctx.lineTo(R * 0.36, R * 0.45);
    }
    ctx.stroke();
  }

  // Visor angular furioso
  for (const sd of [-1, 1]) {
    const ex = sd * R * 0.34, ey = -R * 0.16;
    if (hurt) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = R * 0.06;
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.13, ey - R * 0.13); ctx.lineTo(ex + R * 0.13, ey + R * 0.13);
      ctx.moveTo(ex + R * 0.13, ey - R * 0.13); ctx.lineTo(ex - R * 0.13, ey + R * 0.13);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ff2e6e";
      ctx.beginPath();
      ctx.moveTo(ex - sd * R * 0.22, ey - R * 0.14);
      ctx.lineTo(ex + sd * R * 0.22, ey - R * 0.02);
      ctx.lineTo(ex + sd * R * 0.14, ey + R * 0.14);
      ctx.lineTo(ex - sd * R * 0.18, ey + R * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff0a8";
      ctx.beginPath();
      ctx.arc(ex + look * R * 0.06, ey, R * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Reja de boca cerrada
  ctx.fillStyle = "#12061a";
  ctx.strokeStyle = def.color;
  ctx.lineWidth = Math.max(1.5, R * 0.035);
  ctx.beginPath();
  ctx.roundRect(-R * 0.42, R * 0.20, R * 0.84, R * 0.26, R * 0.08);
  ctx.fill();
  ctx.stroke();
  if (!hurt) {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * R * 0.14, R * 0.20);
      ctx.lineTo(i * R * 0.14, R * 0.46);
      ctx.stroke();
    }
  }
}

/** Skin 2: SOLEDAD — Espectro encapuchado de sombras con manto ondulante y vacío en el pecho. */
function drawBossSkinSoledad(b, R, light, hurt, look) {
  const def = b.def;
  const sway = Math.sin(b.t * 2.8) * R * 0.08;

  // Gotas / lunas solitarias orbitando alrededor
  for (let i = 0; i < 4; i++) {
    const a = b.t * 1.15 + (i * Math.PI * 2) / 4;
    const ox = Math.cos(a) * R * 1.38;
    const oy = Math.sin(a) * R * 0.65 - R * 0.1;
    ctx.fillStyle = "rgba(126, 158, 255, 0.72)";
    ctx.beginPath();
    ctx.moveTo(ox, oy - R * 0.16);
    ctx.quadraticCurveTo(ox + R * 0.12, oy + R * 0.06, ox, oy + R * 0.14);
    ctx.quadraticCurveTo(ox - R * 0.12, oy + R * 0.06, ox, oy - R * 0.16);
    ctx.fill();
  }

  // Manto espectral con jirones ondulantes
  const cloakGrad = ctx.createLinearGradient(0, -R * 1.1, 0, R * 1.2);
  cloakGrad.addColorStop(0, `rgb(${Math.round(32 + light * 100)},${Math.round(42 + light * 100)},${Math.round(110 + light * 110)})`);
  cloakGrad.addColorStop(1, "rgba(14, 16, 48, 0.94)");
  ctx.fillStyle = cloakGrad;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = Math.max(2, R * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.16);
  ctx.bezierCurveTo(R * 0.85, -R * 1.05, R * 1.15, -R * 0.25, R * 0.95 + sway, R * 0.92);
  ctx.quadraticCurveTo(R * 0.55, R * 0.65, R * 0.32 + sway, R * 1.08);
  ctx.quadraticCurveTo(0, R * 0.72, -R * 0.32 + sway, R * 1.08);
  ctx.quadraticCurveTo(-R * 0.55, R * 0.65, -R * 0.95 + sway, R * 0.92);
  ctx.bezierCurveTo(-R * 1.15, -R * 0.25, -R * 0.85, -R * 1.05, 0, -R * 1.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rostro sombrío dentro de la capucha
  ctx.fillStyle = "#0b0d26";
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.22, R * 0.62, R * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corazón hueco en el pecho que se llena de luz dorada al recibir palabras
  const heartFill = b.lives < BOSS_LIVES
    ? `rgba(255, 224, 120, ${0.45 + (BOSS_LIVES - b.lives) * 0.25})`
    : "rgba(18, 26, 68, 0.95)";
  drawHeartShape(0, R * 0.42, R * 0.22, heartFill, "#9bb8ff");

  // Ojos melancólicos brillantes azul hielo
  for (const sd of [-1, 1]) {
    const ex = sd * R * 0.25, ey = -R * 0.26;
    if (hurt) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = R * 0.055;
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.11, ey - R * 0.11); ctx.lineTo(ex + R * 0.11, ey + R * 0.11);
      ctx.moveTo(ex + R * 0.11, ey - R * 0.11); ctx.lineTo(ex - R * 0.11, ey + R * 0.11);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#a8dcff";
      ctx.beginPath();
      ctx.ellipse(ex + look * R * 0.05, ey, R * 0.14, R * 0.19, sd * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex - R * 0.03 + look * R * 0.05, ey - R * 0.06, R * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Skin 3: INDIFERENCIA — Máscara monolítica de piedra y hielo con anillos geométricos fríos. */
function drawBossSkinIndiferencia(b, R, light, hurt, look) {
  const def = b.def;

  // Halo geométrico frío y fragmentos de piedra orbitando
  ctx.save();
  ctx.rotate(b.t * 0.6);
  ctx.strokeStyle = "rgba(140, 225, 240, 0.55)";
  ctx.lineWidth = Math.max(2, R * 0.04);
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.24, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6;
    const sx = Math.cos(a) * R * 1.24;
    const sy = Math.sin(a) * R * 1.24;
    ctx.fillStyle = "#c8f2fa";
    ctx.beginPath();
    ctx.moveTo(sx, sy - R * 0.13);
    ctx.lineTo(sx + R * 0.09, sy);
    ctx.lineTo(sx, sy + R * 0.13);
    ctx.lineTo(sx - R * 0.09, sy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Máscara monolítica esculpida (forma de rombo-escudo de porcelana/piedra fría)
  const maskGrad = ctx.createLinearGradient(-R * 0.8, -R, R * 0.8, R);
  maskGrad.addColorStop(0, `rgb(${Math.round(140 + light * 90)},${Math.round(168 + light * 75)},${Math.round(186 + light * 60)})`);
  maskGrad.addColorStop(0.55, "#5b738a");
  maskGrad.addColorStop(1, "#253447");
  ctx.fillStyle = maskGrad;
  ctx.strokeStyle = def.color;
  ctx.lineWidth = Math.max(2, R * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.12);
  ctx.lineTo(R * 0.86, -R * 0.42);
  ctx.lineTo(R * 0.72, R * 0.56);
  ctx.lineTo(0, R * 1.06);
  ctx.lineTo(-R * 0.72, R * 0.56);
  ctx.lineTo(-R * 0.86, -R * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Sombra vertical de media máscara (estilo escultura fría)
  ctx.fillStyle = "rgba(14, 24, 38, 0.28)";
  ctx.beginPath();
  ctx.moveTo(0, -R * 1.10);
  ctx.lineTo(R * 0.84, -R * 0.42);
  ctx.lineTo(R * 0.70, R * 0.55);
  ctx.lineTo(0, R * 1.04);
  ctx.closePath();
  ctx.fill();

  // Grietas de luz cálida al recibir impactos
  if (b.lives < BOSS_LIVES) {
    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = Math.max(2, R * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.85); ctx.lineTo(-R * 0.16, -R * 0.35); ctx.lineTo(R * 0.08, R * 0.12);
    if (b.lives <= 1) {
      ctx.lineTo(-R * 0.18, R * 0.65);
    }
    ctx.stroke();
  }

  // Ojos apáticos entrecerrados (se sorprenden al recibir daño)
  for (const sd of [-1, 1]) {
    const ex = sd * R * 0.32, ey = -R * 0.18;
    if (hurt) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, R * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#0f1c2b";
      ctx.beginPath();
      ctx.ellipse(ex, ey, R * 0.21, R * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#aef6ff";
      ctx.beginPath();
      ctx.arc(ex + look * R * 0.06, ey + R * 0.02, R * 0.075, 0, Math.PI * 2);
      ctx.fill();
      // Párpado plano superior (expresión fría/indiferente)
      ctx.strokeStyle = "#18293b";
      ctx.lineWidth = Math.max(2, R * 0.065);
      ctx.beginPath();
      ctx.moveTo(ex - R * 0.23, ey - R * 0.04);
      ctx.lineTo(ex + R * 0.23, ey - R * 0.04);
      ctx.stroke();
    }
  }

  // Boca sellada recta e inexpresiva
  ctx.strokeStyle = "#152436";
  ctx.lineWidth = Math.max(2, R * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-R * 0.30, R * 0.28);
  ctx.lineTo(R * 0.30, R * 0.28);
  ctx.stroke();
}

function drawBoss(b) {
  const base = project(b.x, 0, b.z);
  if (!base) return;
  const u = base.scaleY;
  const sc = b.scale;
  const R = u * 5.6 * sc;
  if (R < 4) return;
  const bob = Math.sin(b.t * 2) * u * 0.22;
  const cx = base.x + (b.hitFlash > 0 ? Math.sin(b.t * 70) * R * 0.05 * b.hitFlash : 0);
  const cy = base.y - u * 5.7 * sc - bob;
  const def = b.def;
  const light = (BOSS_LIVES - b.lives) / BOSS_LIVES * 0.5;
  const hurt = b.hitFlash > 0.3 || b.phase === "dying";
  const look = Math.max(-1, Math.min(1, (player.x - b.x) / 6));

  ctx.save();
  ctx.translate(cx, cy);
  if (b.phase === "dying") {
    ctx.rotate(b.dyingT * 2.2);
    ctx.globalAlpha = Math.max(0, b.scale);
  }

  // Aura del jefe
  const aura = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 1.9);
  aura.addColorStop(0, def.color + "66");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2); ctx.fill();

  // Dibujar la skin correspondiente al jefe
  if (def.skin === "exclusion") {
    drawBossSkinExclusion(b, R, light, hurt, look);
  } else if (def.skin === "soledad") {
    drawBossSkinSoledad(b, R, light, hurt, look);
  } else {
    drawBossSkinIndiferencia(b, R, light, hurt, look);
  }

  // Etiqueta del nombre del jefe
  const fs = Math.max(9, R * 0.19);
  ctx.font = `900 ${fs}px "Segoe UI", system-ui, sans-serif`;
  const tw = ctx.measureText(def.label).width;
  ctx.fillStyle = "rgba(10, 6, 24, 0.9)";
  ctx.strokeStyle = def.color;
  ctx.lineWidth = Math.max(1.5, fs * 0.1);
  ctx.beginPath();
  ctx.roundRect(-tw / 2 - fs * 0.6, R * 0.72 - fs * 0.7, tw + fs * 1.2, fs * 1.4, fs * 0.5);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def.label, 0, R * 0.72 + 1);

  // Destello al recibir una palabra
  if (b.hitFlash > 0) {
    ctx.globalAlpha = b.hitFlash * 0.65;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(0, 0, R * 1.06, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 3 Corazones de vida sobre el jefe
  if (b.phase !== "dying") {
    ctx.lineWidth = Math.max(1.5, R * 0.03);
    for (let i = 0; i < BOSS_LIVES; i++) {
      const hx = (i - (BOSS_LIVES - 1) / 2) * R * 0.46;
      const alive = i < b.lives;
      drawHeartShape(hx, -R * 1.42, R * 0.17, alive ? "#ff4d7d" : "rgba(40,20,50,0.8)", alive ? "#ffd0e0" : "rgba(255,255,255,0.25)");
    }
  }
  ctx.restore();
}

function drawShot(s) {
  const p = project(s.x, s.y, s.z);
  if (!p) return;
  const fs = Math.max(13, Math.min(36, p.scaleX * 0.5));
  ctx.save();
  ctx.font = `900 ${fs}px "Segoe UI", system-ui, sans-serif`;
  const tw = ctx.measureText(s.word).width;
  const bw = tw + fs * 1.1, bh = fs * 1.5;
  const glow = ctx.createRadialGradient(p.x, p.y, bh * 0.3, p.x, p.y, bw * 0.9);
  glow.addColorStop(0, "rgba(255, 226, 122, 0.5)");
  glow.addColorStop(1, "rgba(255, 226, 122, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - bw, p.y - bw, bw * 2, bw * 2);
  const g = ctx.createLinearGradient(0, p.y - bh / 2, 0, p.y + bh / 2);
  g.addColorStop(0, "#fff6c2"); g.addColorStop(1, "#ffb23e");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, fs * 0.1);
  ctx.beginPath(); ctx.roundRect(p.x - bw / 2, p.y - bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#4a1580";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s.word, p.x, p.y + 1);
  ctx.restore();
}

function drawAmmoPickup(a) {
  const bob = Math.sin(globalTime * 4 + a.phase) * 0.14;
  const p = project(a.x, a.y + bob, a.z);
  if (!p) return;
  const fs = Math.max(11, Math.min(26, p.scaleX * 0.3));
  ctx.save();
  ctx.font = `900 ${fs}px "Segoe UI", system-ui, sans-serif`;
  const tw = ctx.measureText(a.word).width;
  const bw = tw + fs * 1.1, bh = fs * 1.6;
  const halo = ctx.createRadialGradient(p.x, p.y, bh * 0.3, p.x, p.y, bw);
  halo.addColorStop(0, "rgba(138, 232, 255, 0.5)");
  halo.addColorStop(1, "rgba(138, 232, 255, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(p.x - bw, p.y - bw, bw * 2, bw * 2);
  const g = ctx.createLinearGradient(p.x - bw / 2, 0, p.x + bw / 2, 0);
  g.addColorStop(0, "#ff9ed2"); g.addColorStop(1, "#8ae8ff");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, fs * 0.1);
  ctx.beginPath(); ctx.roundRect(p.x - bw / 2, p.y - bh / 2, bw, bh, bh / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2a0f55";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(a.word, p.x, p.y + 1);
  ctx.restore();
}

/** Megáfono de Luz en la mano de Alma. */
function drawMegaphone(cx, cy, size) {
  const u = size * 0.3;
  ctx.save();
  ctx.translate(cx + size * 0.6, cy - size * 0.1 + weapon.recoil * u * 0.25);
  ctx.rotate(0.12 - weapon.recoil * 0.12);

  // Mango
  ctx.fillStyle = "#7a3fb0";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, u * 0.06);
  ctx.beginPath(); ctx.roundRect(-u * 0.13, u * 0.55, u * 0.26, u * 0.5, u * 0.08); ctx.fill(); ctx.stroke();

  // Cono
  const g = ctx.createLinearGradient(-u * 0.7, 0, u * 0.7, 0);
  g.addColorStop(0, "#ffd24d"); g.addColorStop(0.5, "#fff2a8"); g.addColorStop(1, "#ff9a3c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-u * 0.3, u * 0.62); ctx.lineTo(u * 0.3, u * 0.62);
  ctx.lineTo(u * 0.74, -u * 0.8); ctx.lineTo(-u * 0.74, -u * 0.8);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Boca del megáfono
  ctx.fillStyle = "#ff9ed2";
  ctx.beginPath(); ctx.ellipse(0, -u * 0.8, u * 0.74, u * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Estrella emblema
  ctx.fillStyle = "#8a2be2";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? u * 0.2 : u * 0.09;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(a) * rr, py = u * 0.0 + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();

  // Destello al disparar
  if (weapon.recoil > 0) {
    const fg = ctx.createRadialGradient(0, -u * 0.9, 0, 0, -u * 0.9, u * 1.3);
    fg.addColorStop(0, `rgba(255, 240, 160, ${0.85 * weapon.recoil})`);
    fg.addColorStop(1, "rgba(255, 240, 160, 0)");
    ctx.fillStyle = fg;
    ctx.fillRect(-u * 1.4, -u * 2.3, u * 2.8, u * 2.8);
  }
  ctx.restore();
}
