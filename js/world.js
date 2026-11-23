"use strict";

/* =========================================================================
   MUNDO: VÉRTICE TIPO TEMPLE RUN, CAMINO CURVO Y ADORNOS POR PLANETA
   -------------------------------------------------------------------------
   Cada PLANET_DISTANCE el camino se dobla (curva) hacia un lado y aparece un
   portal-vértice con palabras del planeta siguiente. Si Alma ya está en el
   carril hacia donde gira el camino, hace un "giro perfecto" (+150).
   ========================================================================= */

let gate = null; // portal-vértice activo

function resetWorldEvents() {
  gate = null;
  planetState.curve = 0;
  planetState.curveTarget = 0;
}

function enterNextPlanet(target, number) {
  planetState.fromIndex = planetState.currentIndex;
  planetState.currentIndex = target;
  planetState.transition = 0;
  planetState.warpFlash = 1;
  planetState.warpRing = 0.02;
  showPlanetBanner(PLANET_WORLDS[target], number);
  audio.planetWarp();
}

function updateWorldEvents(dt) {
  // Suavizado de la curva del camino
  planetState.curve += (planetState.curveTarget - planetState.curve) * Math.min(1, dt * 1.7);

  const total = Math.floor(runStats.distance / PLANET_DISTANCE);
  planetState.progress = (runStats.distance % PLANET_DISTANCE) / PLANET_DISTANCE;

  // Programar un nuevo vértice (no durante un jefe)
  if (total > planetState.visited && !gate && !bossIsActive()) {
    planetState.visited = total;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const target = total % PLANET_WORLDS.length;
    gate = { z: SPAWN_Z + 12, dir, target, number: total + 1, passed: false };
    planetState.curveTarget = dir;
    addFloatingText(dir < 0 ? "◀ ¡El camino gira a la izquierda!" : "¡El camino gira a la derecha! ▶", PLANET_WORLDS[target].accent, 2.2);
  }

  if (gate) {
    gate.z -= runStats.speed * dt;
    if (!gate.passed && gate.z <= PLAYER_Z) {
      gate.passed = true;
      const turnLane = gate.dir > 0 ? 2 : 0;
      if (player.targetLane === turnLane) {
        runStats.score += 150;
        spawnParticles(player.x, player.y + 1.0, PLAYER_Z, 22, "#ffe27a", 7, 6);
        addFloatingText("¡Giro perfecto! +150", "#ffe27a", 2.2);
      }
      enterNextPlanet(gate.target, gate.number);
      planetState.curveTarget = 0;
    }
    if (gate.z < DESPAWN_Z) gate = null;
  }
}

/* ---------- Portal-vértice con palabras ---------- */
function drawGate(g) {
  const w = PLANET_WORLDS[g.target];
  const half = LANE_WIDTH * 1.5 + 0.55;
  const z = Math.max(0.7, g.z);
  const bL = project(-half, 0, z), bR = project(half, 0, z);
  const tL = project(-half, 5.4, z), tR = project(half, 5.4, z);
  const mL = project(-half, 3.9, z);
  if (!bL || !bR || !tL || !tR || !mL) return;

  const col = w.railOuter, col2 = w.railInner;
  const pw = Math.max(5, bL.scaleX * 0.42);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, (112 - g.z) / 22));
  ctx.lineCap = "round";

  // Pilares con resplandor
  for (const [x0, y0, x1, y1] of [[bL.x, bL.y, tL.x, tL.y], [bR.x, bR.y, tR.x, tR.y]]) {
    ctx.strokeStyle = rgbStr(col, 0.26);
    ctx.lineWidth = pw * 2.3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = rgbStr(col2, 0.95);
    ctx.lineWidth = pw;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(1.5, pw * 0.25);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  // Panel superior con el nombre del planeta y sus palabras
  const bx = tL.x, by = tL.y, bw = tR.x - tL.x, bh = mL.y - tL.y;
  if (bw > 20 && bh > 8) {
    const pg = ctx.createLinearGradient(0, by, 0, by + bh);
    pg.addColorStop(0, "rgba(14, 10, 38, 0.95)");
    pg.addColorStop(1, "rgba(30, 14, 60, 0.92)");
    ctx.fillStyle = pg;
    ctx.strokeStyle = rgbStr(col, 0.95);
    ctx.lineWidth = Math.max(2, pw * 0.3);
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, Math.max(6, bh * 0.16));
    ctx.fill();
    ctx.stroke();

    const fitFont = (text, weight, target, maxW) => {
      ctx.font = `${weight} ${target}px "Segoe UI", system-ui, sans-serif`;
      const wdt = ctx.measureText(text).width;
      return wdt > maxW ? target * (maxW / wdt) : target;
    };
    const textW = bw * 0.74;
    const line1 = w.name.toUpperCase();
    const line2 = w.vertexWords.join("  ·  ");
    const f1 = fitFont(line1, 900, bh * 0.34, textW);
    const f2 = fitFont(line2, 700, bh * 0.22, textW);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${f1}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = w.accent;
    ctx.fillText(line1, bx + bw / 2, by + bh * 0.36);
    ctx.font = `700 ${f2}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = "#fff4cc";
    ctx.fillText(line2, bx + bw / 2, by + bh * 0.74);

    // Flechas que indican hacia dónde gira el camino
    const arrow = g.dir < 0 ? "◀" : "▶";
    ctx.font = `900 ${bh * 0.42}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = rgbStr(col2, 0.55 + 0.4 * Math.sin(globalTime * 7));
    ctx.fillText(arrow, bx + bw * 0.07, by + bh * 0.52);
    ctx.fillText(arrow, bx + bw * 0.93, by + bh * 0.52);
  }
  ctx.restore();
}

/* ---------- Flechas en el suelo antes del vértice ---------- */
function drawGateChevrons(g) {
  const w = PLANET_WORLDS[g.target];
  for (let k = 1; k <= 4; k++) {
    const cz = g.z - 5.5 * k;
    if (cz < PLAYER_Z + 1.5 || cz > SPAWN_Z) continue;
    const a = project(-g.dir * 1.3, 0.03, cz - 1.0);
    const b = project(g.dir * 1.3, 0.03, cz);
    const c = project(-g.dir * 1.3, 0.03, cz + 1.0);
    if (!a || !b || !c) continue;
    ctx.strokeStyle = rgbStr(w.railOuter, Math.max(0.1, 0.25 + 0.55 * Math.sin(globalTime * 6 - k * 0.9)));
    ctx.lineWidth = Math.max(3, b.scaleX * 0.16);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }
}

/* ---------- Pista luminosa que se CURVA (polilíneas) ---------- */
const TRACK_ZS = [1.2, 3, 5, 8, 12, 17, 23, 30, 38, 47, 57, 68, 80, 93, SPAWN_Z];

function trackColumn(x) {
  const pts = [];
  for (let i = 0; i < TRACK_ZS.length; i++) {
    const p = project(x, 0, TRACK_ZS[i]);
    if (p) pts.push(p);
  }
  return pts;
}

function traceStrip(leftPts, rightPts) {
  ctx.beginPath();
  ctx.moveTo(leftPts[0].x, leftPts[0].y);
  for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
  for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
  ctx.closePath();
}

function drawLuminousTrack() {
  const halfTrack = LANE_WIDTH * 1.5 + 0.35;
  const { w: toW, fromW, t } = getBlendedWorld();
  const bridgeRGB = lerpRGB(fromW.bridge, toW.bridge, t);
  const sideRGB = lerpRGB(fromW.laneSide, toW.laneSide, t);
  const centerRGB = lerpRGB(fromW.laneCenter, toW.laneCenter, t);
  const outerRGB = lerpRGB(fromW.railOuter, toW.railOuter, t);
  const innerRGB = lerpRGB(fromW.railInner, toW.railInner, t);
  const crossRGB = lerpRGB(fromW.cross, toW.cross, t);

  const left = trackColumn(-halfTrack);
  const right = trackColumn(halfTrack);
  if (left.length < 2 || right.length < 2) return;
  const farY = left[left.length - 1].y;

  const bridgeGrad = ctx.createLinearGradient(0, farY, 0, H);
  bridgeGrad.addColorStop(0, rgbStr(bridgeRGB, 0.08));
  bridgeGrad.addColorStop(0.25, rgbStr(bridgeRGB, 0.24));
  bridgeGrad.addColorStop(1, rgbStr(sideRGB, 0.34));
  ctx.fillStyle = bridgeGrad;
  traceStrip(left, right);
  ctx.fill();

  // Brillo por carril
  const laneColors = [rgbStr(sideRGB, 0.14), rgbStr(centerRGB, 0.16), rgbStr(sideRGB, 0.14)];
  for (let i = 0; i < 3; i++) {
    const l = trackColumn(LANES[i] - LANE_WIDTH * 0.44);
    const r = trackColumn(LANES[i] + LANE_WIDTH * 0.44);
    if (l.length < 2 || r.length < 2) continue;
    ctx.fillStyle = laneColors[i];
    traceStrip(l, r);
    ctx.fill();
  }

  // Travesaños que avanzan hacia el jugador
  const step = 4.5;
  const offset = runStats.worldScroll % step;
  for (let z = 1.2 + (step - offset); z < SPAWN_Z; z += step) {
    const l = project(-halfTrack, 0, z);
    const r = project(halfTrack, 0, z);
    if (!l || !r) continue;
    const alpha = Math.max(0.03, Math.min(0.45, (1 - z / SPAWN_Z) * 0.55));
    ctx.strokeStyle = rgbStr(crossRGB, alpha);
    ctx.lineWidth = Math.max(1, l.scaleY * 0.045);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
  }

  // Rieles (curvos)
  const rails = [-halfTrack, -LANE_WIDTH * 0.5, LANE_WIDTH * 0.5, halfTrack];
  ctx.lineJoin = "round";
  for (let idx = 0; idx < rails.length; idx++) {
    const pts = trackColumn(rails[idx]);
    if (pts.length < 2) continue;
    const outer = idx === 0 || idx === rails.length - 1;
    ctx.strokeStyle = outer ? rgbStr(outerRGB, 0.88) : rgbStr(innerRGB, 0.45);
    ctx.lineWidth = outer ? 3.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    for (let i = pts.length - 2; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  if (gate) drawGateChevrons(gate);
}

/* ---------- Adornos a los lados del camino (distintos por planeta) ---------- */
function drawProp(type, p, color, idx, alpha) {
  const u = p.scaleY;
  const x = p.x, y = p.y;
  if (u < 3) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const c = rgbStr(color, 1);
  const cs = rgbStr(color, 0.28);

  if (type === "heartLamp") {
    ctx.strokeStyle = "rgba(220,230,255,0.7)";
    ctx.lineWidth = Math.max(1.5, u * 0.07);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - u * 2.0); ctx.stroke();
    const hy = y - u * 2.3, s = u * 0.42;
    ctx.fillStyle = cs; ctx.beginPath(); ctx.arc(x, hy, s * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, hy + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.7, hy - s * 0.2, x - s * 0.8, hy - s * 1.4, x, hy - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.8, hy - s * 1.4, x + s * 1.7, hy - s * 0.2, x, hy + s * 0.9);
    ctx.fill();
  } else if (type === "coral") {
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(2, u * 0.16);
    const tips = [[-0.6, -1.5], [0, -2.1], [0.55, -1.6]];
    for (const [tx, ty] of tips) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + tx * u * 0.2, y + ty * u * 0.5, x + tx * u, y + ty * u); ctx.stroke();
      ctx.fillStyle = "#fff0f6";
      ctx.beginPath(); ctx.arc(x + tx * u, y + ty * u, u * 0.14, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === "crystal") {
    const shard = (cx, h, wd, a) => {
      ctx.fillStyle = rgbStr(color, a);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(1, u * 0.04);
      ctx.beginPath();
      ctx.moveTo(cx, y - h * u);
      ctx.lineTo(cx + wd * u, y - h * u * 0.35);
      ctx.lineTo(cx + wd * u * 0.6, y);
      ctx.lineTo(cx - wd * u * 0.6, y);
      ctx.lineTo(cx - wd * u, y - h * u * 0.35);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    };
    shard(x - u * 0.5, 1.4, 0.3, 0.55);
    shard(x + u * 0.5, 1.1, 0.26, 0.5);
    shard(x, 2.3, 0.38, 0.8);
  } else if (type === "obelisk") {
    ctx.fillStyle = "rgba(40,24,14,0.9)";
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1.5, u * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.4, y); ctx.lineTo(x - u * 0.25, y - u * 2.4);
    ctx.lineTo(x, y - u * 2.9); ctx.lineTo(x + u * 0.25, y - u * 2.4); ctx.lineTo(x + u * 0.4, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgbStr(color, 0.5 + 0.4 * Math.sin(globalTime * 3 + idx));
    ctx.lineWidth = Math.max(2, u * 0.09);
    ctx.beginPath(); ctx.moveTo(x, y - u * 0.3); ctx.lineTo(x, y - u * 2.3); ctx.stroke();
  } else if (type === "flower") {
    ctx.strokeStyle = "#4fd68a";
    ctx.lineWidth = Math.max(2, u * 0.09);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + u * 0.25, y - u, x, y - u * 1.9); ctx.stroke();
    ctx.fillStyle = c;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + idx;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * u * 0.3, y - u * 1.9 + Math.sin(a) * u * 0.3, u * 0.26, u * 0.16, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff2a8";
    ctx.beginPath(); ctx.arc(x, y - u * 1.9, u * 0.15, 0, Math.PI * 2); ctx.fill();
  } else if (type === "prism") {
    const hue = (idx * 47) % 360;
    ctx.fillStyle = `hsla(${hue}, 90%, 68%, 0.85)`;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1.5, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y - u * 2.3); ctx.lineTo(x + u * 0.7, y); ctx.lineTo(x - u * 0.7, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `hsla(${(hue + 120) % 360}, 90%, 70%, 0.6)`;
    ctx.beginPath();
    ctx.moveTo(x, y - u * 2.3); ctx.lineTo(x + u * 0.7, y); ctx.lineTo(x + u * 0.1, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawRoadsideProps() {
  const { w: toW, fromW, t } = getBlendedWorld();
  const world = t < 0.5 ? fromW : toW;
  const fade = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2; // desvanece al cambiar de planeta
  const half = LANE_WIDTH * 1.5 + 1.5;
  const step = 7;
  const off = runStats.worldScroll % step;
  for (let z = 3 + (step - off); z < 86; z += step) {
    const idx = Math.floor((z + runStats.worldScroll) / step);
    const alpha = Math.max(0, Math.min(1, (86 - z) / 26)) * fade;
    if (alpha < 0.03) continue;
    for (const side of [-1, 1]) {
      const p = project(side * half, 0, z);
      if (p) drawProp(world.prop, p, world.propColor, idx + (side > 0 ? 3 : 0), alpha);
    }
  }
}
