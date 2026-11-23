"use strict";

/* =========================================================================
   ALMA — RENDERIZADO DEL PERSONAJE
   -------------------------------------------------------------------------
   drawAlma(ctx, cx, cy, size, opts) dibuja a Alma en capas:
     aura → cuerpo (degradado + borde) → sombra interior → brillos →
     mejillas → ojos → boca (con dientes de fondo y lengua) → escudo.
   Si ALMA_SPRITE_CONFIG.enabled es true (ver js/config.js) se usa tu sprite.
   ========================================================================= */

/**
 * Trazo del cuerpo (estrella redondeada). Cada extremidad se controla por separado.
 * Valores positivos: brazos hacia ARRIBA, piernas estiradas hacia ABAJO (negativo = encogidas).
 */
function almaBodyPath(c, r, pose) {
  // Limitar desplazamientos para que ningún brazo ni pierna se cruce o deforme
  const aR = Math.max(-0.28, Math.min(0.32, pose.armR));
  const aL = Math.max(-0.28, Math.min(0.35, pose.armL));
  const lR = Math.max(-0.22, Math.min(0.22, pose.legR));
  const lL = Math.max(-0.22, Math.min(0.22, pose.legL));

  c.beginPath();
  c.moveTo(r * 0.04, -r * 1.03);
  c.bezierCurveTo(r * 0.20, -r * 1.09, r * 0.32, -r * 0.96, r * 0.17, -r * 0.88); // rizo
  c.bezierCurveTo(r * 0.34, -r * 0.76, r * 0.52, -r * 0.50, r * 0.62, -r * 0.25);

  // Brazo derecho (sube y baja suavemente sin estirarse de más)
  c.bezierCurveTo(
    r * 0.80, -r * (0.46 + aR * 0.65),
    r * 0.97, -r * (0.62 + aR * 0.80),
    r * 1.06, -r * (0.48 + aR * 0.75)
  );
  c.bezierCurveTo(
    r * 1.12, -r * (0.34 + aR * 0.60),
    r * 0.94, -r * (0.04 + aR * 0.25),
    r * 0.76, r * 0.20
  );

  // Pierna derecha
  c.bezierCurveTo(r * 0.75, r * 0.45, r * 0.84, r * (0.82 + lR), r * 0.64, r * (0.94 + lR));
  c.bezierCurveTo(r * 0.44, r * (1.03 + lR), r * 0.24, r * 0.78, r * 0.03, r * 0.73);

  // Pierna izquierda
  c.bezierCurveTo(-r * 0.18, r * 0.74, -r * 0.34, r * (0.98 + lL), -r * 0.54, r * (0.92 + lL));
  c.bezierCurveTo(-r * 0.72, r * (0.84 + lL), -r * 0.68, r * 0.52, -r * 0.70, r * 0.36);

  // Brazo izquierdo (ambos bordes suben juntos cuando aL > 0, sin auto-cruce)
  c.bezierCurveTo(
    -r * 0.90, r * (0.38 - aL * 0.55),
    -r * 1.13, r * (0.28 - aL * 0.85),
    -r * 1.08, r * (0.12 - aL * 0.90)
  );
  c.bezierCurveTo(
    -r * 1.02, r * (-0.04 - aL * 0.75),
    -r * 0.78, r * (-0.16 - aL * 0.35),
    -r * 0.62, -r * 0.25
  );

  c.bezierCurveTo(-r * 0.54, -r * 0.56, -r * 0.34, -r * 0.98, r * 0.04, -r * 1.03);
  c.closePath();
}

/** Calcula la pose según el estado (correr, saltar, flotar, caer, deslizar, girar de carril). */
function almaComputePose(o) {
  const t = o.time;
  const pose = { armR: 0, armL: 0, legR: 0, legL: 0, talk: 0, wide: false, state: "run" };
  if (o.isPreview) {
    pose.armR = 0.16 + Math.sin(t * 4.2) * 0.08;
    pose.armL = 0.02 + Math.sin(t * 2.1) * 0.04;
    pose.legR = Math.sin(t * 2.5) * 0.04; pose.legL = -pose.legR;
    pose.talk = 0.015 * (1 + Math.sin(t * 3));
    pose.state = "idle";
    return pose;
  }
  const lean = o.laneDir || 0; // -1 izquierda, +1 derecha
  if (o.boosting) {                              // COHETE: pose aerodinámica alegre y proporcionada
    pose.state = "rocket";
    pose.armR = 0.26 + Math.sin(t * 18) * 0.03;
    pose.armL = 0.28 - Math.sin(t * 18) * 0.03;
    pose.legR = -0.10; pose.legL = -0.10;
    pose.talk = 0.09;
    pose.armR += lean * 0.10; pose.armL -= lean * 0.08;
    return pose;
  }
  if (o.sliding) {
    pose.state = "slide";
    pose.armR = -0.22; pose.armL = -0.22;       // brazos hacia atrás
    pose.legR = 0.10; pose.legL = 0.10;
    pose.talk = 0.05;
  } else if (!o.grounded) {
    if (o.vy > 3) {                              // SUBIENDO: brazos arriba proporcionados, piernas encogidas
      pose.state = "rise";
      pose.armR = 0.28 + Math.sin(t * 16) * 0.04; pose.armL = 0.30 - Math.sin(t * 16) * 0.04;
      pose.legR = -0.18; pose.legL = -0.14;
      pose.talk = 0.06;
    } else if (o.vy > -4) {                      // CIMA: flotando alegre
      pose.state = "fly";
      pose.armR = 0.20 + Math.sin(t * 9) * 0.08; pose.armL = 0.22 - Math.sin(t * 9) * 0.08;
      pose.legR = Math.sin(t * 8) * 0.10 - 0.04; pose.legL = -Math.sin(t * 8) * 0.10 - 0.04;
      pose.talk = 0.03;
    } else {                                     // BAJANDO: brazos arriba, piernas colgando, ojos grandes
      pose.state = "fall";
      pose.armR = 0.26 + Math.sin(t * 20) * 0.08; pose.armL = 0.28 - Math.sin(t * 20) * 0.08;
      pose.legR = 0.18 + Math.sin(t * 18) * 0.05; pose.legL = 0.14 - Math.sin(t * 18) * 0.05;
      pose.talk = 0.11; pose.wide = true;
    }
  } else {                                       // CORRIENDO
    const sw = Math.sin(t * 13);
    pose.armR = Math.sin(t * 11) * 0.11 + 0.04;
    pose.armL = -Math.sin(t * 11) * 0.11 + 0.02;
    pose.legR = sw * 0.10; pose.legL = -sw * 0.10;
    pose.talk = 0.02 * (1 + Math.sin(t * 9));
  }
  pose.armR += lean * 0.18; pose.armL -= lean * 0.12;
  return pose;
}

/** Ojo ovalado brillante: iris oscuro con degradado + 2 reflejos. */
function almaDrawEye(c, r, blink, hurt) {
  if (blink) {
    c.strokeStyle = "#11151c";
    c.lineWidth = Math.max(2, r * 0.07);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-r * 0.10, 0);
    c.quadraticCurveTo(0, r * 0.07, r * 0.10, 0);
    c.stroke();
    return;
  }
  if (hurt) {
    c.strokeStyle = "#11151c";
    c.lineWidth = Math.max(2, r * 0.07);
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-r * 0.08, -r * 0.08); c.lineTo(r * 0.08, r * 0.08);
    c.moveTo(r * 0.08, -r * 0.08); c.lineTo(-r * 0.08, r * 0.08);
    c.stroke();
    return;
  }
  const g = c.createLinearGradient(0, -r * 0.17, 0, r * 0.17);
  g.addColorStop(0, "#0b0e14");
  g.addColorStop(0.7, "#1a2230");
  g.addColorStop(1, "#27324a");
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, r * 0.105, r * 0.165, 0, 0, Math.PI * 2);
  c.fill();
  // Reflejo grande
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(-r * 0.03, -r * 0.065, r * 0.036, r * 0.05, -0.2, 0, Math.PI * 2);
  c.fill();
  // Reflejo pequeño
  c.globalAlpha = 0.8;
  c.beginPath();
  c.arc(r * 0.035, r * 0.07, r * 0.017, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/**
 * Boca abierta sonriente con interior oscuro y una LENGUA real:
 * una sola masa rosada con dos lóbulos suaves, surco central, degradado
 * y brillo húmedo, que sube desde el fondo de la boca.
 */
function almaDrawMouth(c, r, size, hurt, talk) {
  c.save();
  c.translate(r * 0.02, r * 0.22);
  c.rotate(-0.07);

  if (hurt) {
    c.fillStyle = "#1b2029";
    c.beginPath();
    c.ellipse(0, r * 0.07, r * 0.10, r * 0.13, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }

  const mw = r * 0.30;            // semi-ancho de la boca
  const mh = r * (0.20 + talk);   // alto (se abre un poco al correr)

  // Silueta de la boca (D invertida: borde superior casi recto, fondo curvo)
  const mouth = new Path2D();
  mouth.moveTo(-mw, -mh * 0.10);
  mouth.quadraticCurveTo(0, mh * 0.22, mw, -mh * 0.20);
  mouth.bezierCurveTo(mw * 0.98, mh * 1.05, mw * 0.30, mh * 1.62, -mw * 0.10, mh * 1.55);
  mouth.bezierCurveTo(-mw * 0.72, mh * 1.45, -mw * 1.02, mh * 0.80, -mw, -mh * 0.10);
  mouth.closePath();

  // Interior oscuro con degradado profundo
  const inner = c.createLinearGradient(0, -mh * 0.2, 0, mh * 1.6);
  inner.addColorStop(0, "#2a1f2b");
  inner.addColorStop(1, "#120c14");
  c.fillStyle = inner;
  c.fill(mouth);

  c.save();
  c.clip(mouth);

  // --- LENGUA ---
  const tongue = new Path2D();
  tongue.moveTo(-mw * 0.78, mh * 1.75);
  tongue.bezierCurveTo(-mw * 0.86, mh * 0.88, -mw * 0.46, mh * 0.60, -mw * 0.10, mh * 0.82); // lóbulo izq
  tongue.bezierCurveTo(mw * 0.08, mh * 0.66, mw * 0.18, mh * 0.56, mw * 0.46, mh * 0.60);   // lóbulo der
  tongue.bezierCurveTo(mw * 0.86, mh * 0.66, mw * 0.92, mh * 1.20, mw * 0.80, mh * 1.75);
  tongue.closePath();

  const tg = c.createLinearGradient(0, mh * 0.55, 0, mh * 1.6);
  tg.addColorStop(0, "#ff9fb2");
  tg.addColorStop(0.5, "#f57d97");
  tg.addColorStop(1, "#d9506f");
  c.fillStyle = tg;
  c.fill(tongue);

  // Surco central de la lengua
  c.strokeStyle = "rgba(168, 48, 78, 0.75)";
  c.lineWidth = Math.max(1.2, size * 0.016);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-mw * 0.02, mh * 0.82);
  c.quadraticCurveTo(mw * 0.04, mh * 1.12, -mw * 0.01, mh * 1.42);
  c.stroke();

  // Brillo húmedo en cada lóbulo
  c.fillStyle = "rgba(255, 255, 255, 0.55)";
  c.beginPath();
  c.ellipse(-mw * 0.34, mh * 0.83, mw * 0.16, mh * 0.07, -0.25, 0, Math.PI * 2);
  c.ellipse(mw * 0.36, mh * 0.80, mw * 0.14, mh * 0.065, 0.2, 0, Math.PI * 2);
  c.fill();

  // Sombra bajo el labio superior (da profundidad)
  const lip = c.createLinearGradient(0, -mh * 0.2, 0, mh * 0.5);
  lip.addColorStop(0, "rgba(0,0,0,0.55)");
  lip.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = lip;
  c.fillRect(-mw * 1.2, -mh * 0.3, mw * 2.4, mh * 0.9);
  c.restore();

  // Contorno de la boca
  c.strokeStyle = "#0d1118";
  c.lineWidth = Math.max(1.8, size * 0.026);
  c.lineJoin = "round";
  c.stroke(mouth);

  // Pequeños pliegues de la sonrisa en las comisuras
  c.lineWidth = Math.max(1.2, size * 0.018);
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-mw * 1.08, -mh * 0.12); c.quadraticCurveTo(-mw * 1.18, mh * 0.12, -mw * 1.04, mh * 0.30);
  c.moveTo(mw * 1.08, -mh * 0.22); c.quadraticCurveTo(mw * 1.16, mh * 0.04, mw * 1.02, mh * 0.22);
  c.stroke();

  c.restore();
}

/**
 * Tabla-Cohete Estelar bajo los pies de Alma (modo Boost):
 * Alma surfea un cohete cósmico brillante con estela arcoíris y anillos sónicos.
 */
function almaDrawFlame(c, r, time) {
  c.save();
  c.translate(0, r * 0.88);

  // 1. Halo compacto y luminoso alrededor de la tabla-cohete
  const halo = c.createRadialGradient(0, r * 0.15, r * 0.08, 0, r * 0.15, r * 1.25);
  halo.addColorStop(0, "rgba(255, 224, 120, 0.42)");
  halo.addColorStop(0.5, "rgba(255, 110, 199, 0.18)");
  halo.addColorStop(1, "rgba(123, 232, 255, 0)");
  c.fillStyle = halo;
  c.beginPath();
  c.arc(0, r * 0.15, r * 1.25, 0, Math.PI * 2);
  c.fill();

  // 2. Anillos sónicos compactos pulsando hacia atrás
  for (let i = 0; i < 2; i++) {
    const ph = (time * 2.4 + i * 0.5) % 1;
    const ry = r * (0.22 + ph * 0.72);
    const rx = r * (0.36 + ph * 0.46);
    c.strokeStyle = i === 0
      ? `rgba(138, 232, 255, ${(1 - ph) * 0.65})`
      : `rgba(255, 216, 107, ${(1 - ph) * 0.65})`;
    c.lineWidth = Math.max(1.5, (1 - ph) * r * 0.075);
    c.beginPath();
    c.ellipse(0, ry, rx, rx * 0.25, 0, 0, Math.PI * 2);
    c.stroke();
  }

  // 3. Estela arcoíris estilizada (sin tapar la pista)
  const wave = Math.sin(time * 28) * r * 0.08;
  const tailLen = r * (1.02 + Math.sin(time * 34) * 0.12);
  const ribbons = [
    { w: 0.56, len: 1.00, c0: "rgba(255, 96, 188, 0.85)", c1: "rgba(255, 96, 188, 0)" },
    { w: 0.40, len: 0.88, c0: "rgba(255, 212, 78, 0.92)", c1: "rgba(255, 140, 60, 0)" },
    { w: 0.26, len: 0.74, c0: "rgba(128, 240, 255, 0.95)", c1: "rgba(128, 240, 255, 0)" },
    { w: 0.14, len: 0.52, c0: "rgba(255, 255, 255, 1)", c1: "rgba(255, 255, 220, 0)" }
  ];
  for (const rb of ribbons) {
    const g = c.createLinearGradient(0, r * 0.10, 0, r * 0.10 + tailLen * rb.len);
    g.addColorStop(0, rb.c0);
    g.addColorStop(1, rb.c1);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-r * rb.w, r * 0.08);
    c.quadraticCurveTo(-r * rb.w * 0.45 + wave, r * 0.08 + tailLen * rb.len * 0.55, wave * 1.1, r * 0.08 + tailLen * rb.len);
    c.quadraticCurveTo(r * rb.w * 0.45 + wave, r * 0.08 + tailLen * rb.len * 0.55, r * rb.w, r * 0.08);
    c.closePath();
    c.fill();
  }

  // 4. Aletas deportivas estilizadas
  c.fillStyle = "#ff4d7d";
  c.strokeStyle = "#ffffff";
  c.lineWidth = Math.max(1.5, r * 0.032);
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * r * 0.54, -r * 0.06);
    c.lineTo(side * r * 0.98, r * 0.18);
    c.lineTo(side * r * 0.74, r * 0.22);
    c.lineTo(side * r * 0.46, r * 0.12);
    c.closePath();
    c.fill();
    c.stroke();
  }

  // 5. Cuerpo compacto de la Tabla-Cohete Estelar
  const boardGrad = c.createLinearGradient(0, -r * 0.22, 0, r * 0.22);
  boardGrad.addColorStop(0, "#ffffff");
  boardGrad.addColorStop(0.45, "#d8f6ff");
  boardGrad.addColorStop(1, "#7298d8");
  c.fillStyle = boardGrad;
  c.strokeStyle = "#3a6bb0";
  c.lineWidth = Math.max(1.8, r * 0.04);
  c.beginPath();
  c.ellipse(0, 0, r * 0.78, r * 0.21, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.strokeStyle = "#ffd86b";
  c.lineWidth = Math.max(1.8, r * 0.045);
  c.beginPath();
  c.ellipse(0, -r * 0.02, r * 0.58, r * 0.11, 0, 0, Math.PI);
  c.stroke();

  c.fillStyle = "#ff9a3c";
  c.beginPath();
  c.ellipse(0, r * 0.13, r * 0.26, r * 0.08, 0, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

/**
 * Dibuja a Alma como muñeco pseudo-3D:
 *  - yaw: giro sobre el eje vertical (radianes). 0 = de frente, π = de espaldas.
 *  - pitch: inclinación adelante/atrás.
 *  - Cuerpo extruido en capas para dar grosor, cara que "rueda" sobre la superficie.
 */
function drawAlma(targetCtx, cx, cy, size, opts = {}) {
  const {
    time = 0, tilt = 0, squashX = 1, squashY = 1,
    sliding = false, hasShield = false, glowLevel = 0.35,
    isHurt = false, isPreview = false,
    yaw = 0, pitch = 0, grounded = true, vy = 0, laneDir = 0, boosting = false
  } = opts;
  const c = targetCtx;
  const pose = almaComputePose({ time, isPreview, sliding, grounded, vy, laneDir, boosting });

  c.save();
  c.translate(cx, cy);

  // --- Aura de polvo estelar ---
  const auraR = size * (0.98 + glowLevel * 0.6);
  const ag = c.createRadialGradient(0, 0, size * 0.12, 0, 0, auraR);
  ag.addColorStop(0, `rgba(150, 236, 255, ${0.45 + glowLevel * 0.28})`);
  ag.addColorStop(0.5, `rgba(110, 200, 255, ${0.20 + glowLevel * 0.14})`);
  ag.addColorStop(1, "rgba(110, 200, 255, 0)");
  c.fillStyle = ag;
  c.beginPath(); c.arc(0, 0, auraR, 0, Math.PI * 2); c.fill();

  // Destellos orbitando
  const sparks = 3 + Math.round(glowLevel * 4);
  for (let i = 0; i < sparks; i++) {
    const a = time * (1.1 + i * 0.13) + i * (Math.PI * 2 / sparks);
    const d = size * (0.78 + 0.1 * Math.sin(time * 2 + i));
    const sx = Math.cos(a) * d, sy = Math.sin(a) * d * 0.8;
    const sr = size * (0.025 + 0.015 * Math.sin(time * 5 + i * 2));
    c.fillStyle = i % 2 ? "rgba(255, 232, 140, 0.9)" : "rgba(220, 250, 255, 0.9)";
    c.beginPath();
    c.moveTo(sx, sy - sr * 2.2); c.lineTo(sx + sr * 0.6, sy - sr * 0.6);
    c.lineTo(sx + sr * 2.2, sy); c.lineTo(sx + sr * 0.6, sy + sr * 0.6);
    c.lineTo(sx, sy + sr * 2.2); c.lineTo(sx - sr * 0.6, sy + sr * 0.6);
    c.lineTo(sx - sr * 2.2, sy); c.lineTo(sx - sr * 0.6, sy - sr * 0.6);
    c.closePath(); c.fill();
  }

  // --- Pose global (squash & stretch, inclinación) ---
  const airStretch = (!grounded && !sliding) ? 1 + Math.min(0.12, Math.abs(vy) * 0.008) : 1;
  c.rotate(tilt + (sliding ? -0.18 : 0));
  c.scale(squashX * (sliding ? 1.24 : 1) / Math.sqrt(airStretch), squashY * (sliding ? 0.62 : 1) * airStretch);

  if (ALMA_SPRITE_CONFIG.enabled && ALMA_SPRITE_CONFIG.loaded && ALMA_SPRITE_CONFIG.image) {
    // >>> AQUÍ se dibuja TU sprite/textura de Alma (ver js/config.js) <<<
    const s = size * 1.35;
    c.drawImage(ALMA_SPRITE_CONFIG.image, -s / 2, -s / 2, s, s);
  } else {
    const r = size * 0.56;
    c.lineJoin = "round"; c.lineCap = "round";

    // Llamas del cohete (detrás del cuerpo)
    if (boosting) almaDrawFlame(c, r, time);

    // Giro 3D sobre el eje Y
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const back = cosY < 0;
    const sxYaw = (back ? -1 : 1) * Math.max(Math.abs(cosY), 0.24);

    // Dirección del grosor (extrusión): luz arriba-izquierda + efecto del giro y cabeceo
    const T = r * 0.20;
    const dirX = 0.30 + sinY * 0.9;
    const dirY = 0.22 - pitch * 0.6;
    const LAYERS = 5;

    // Capas traseras (grosor) de oscuro a claro
    for (let k = LAYERS; k >= 1; k--) {
      const f = k / LAYERS;
      c.save();
      c.translate(dirX * T * f, dirY * T * f);
      c.scale(sxYaw, 1);
      almaBodyPath(c, r, pose);
      const shade = Math.round(70 + (1 - f) * 40);
      c.fillStyle = `rgb(${shade - 20}, ${shade + 80}, ${shade + 150})`;
      c.fill();
      if (k === LAYERS) {
        c.strokeStyle = "#2f78b0";
        c.lineWidth = Math.max(2.4, size * 0.04);
        c.stroke();
      }
      c.restore();
    }

    // Cara frontal (o espalda)
    c.save();
    c.scale(sxYaw, 1);
    almaBodyPath(c, r, pose);
    const bg = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.25);
    if (back) {
      bg.addColorStop(0, "#9fe6fb"); bg.addColorStop(1, "#58b9ea");
    } else {
      bg.addColorStop(0, "#c4f6ff"); bg.addColorStop(0.45, "#8fe9ff"); bg.addColorStop(1, "#5fc6f3");
    }
    c.fillStyle = bg;
    c.fill();

    c.save();
    almaBodyPath(c, r, pose);
    c.clip();

    const sh = c.createRadialGradient(r * 0.45, r * 0.5, r * 0.15, r * 0.45, r * 0.5, r * 1.1);
    sh.addColorStop(0, "rgba(40, 120, 200, 0.0)");
    sh.addColorStop(1, "rgba(40, 120, 200, 0.34)");
    c.fillStyle = sh;
    c.fillRect(-r * 1.6, -r * 1.6, r * 3.2, r * 3.2);

    c.strokeStyle = "rgba(90, 190, 245, 0.7)";
    c.lineWidth = r * 0.12;
    almaBodyPath(c, r, pose);
    c.stroke();

    // Brillos tipo gloss
    c.strokeStyle = "rgba(240, 253, 255, 0.92)";
    c.lineWidth = Math.max(2.2, size * 0.05);
    c.beginPath();
    c.moveTo(-r * 0.55, -r * 0.16);
    c.bezierCurveTo(-r * 0.50, -r * 0.56, -r * 0.28, -r * 0.90, r * 0.05, -r * 0.94);
    c.stroke();
    c.lineWidth = Math.max(1.8, size * 0.04);
    c.beginPath();
    c.moveTo(-r * 0.97, r * 0.10);
    c.quadraticCurveTo(-r * 0.84, -r * 0.02, -r * 0.68, -r * 0.07);
    c.stroke();

    if (!back) {
      // La cara se desplaza con el giro (efecto de volumen esférico)
      const faceShift = sinY * r * 0.55;
      c.save();
      c.translate(faceShift, 0);
      // Mejillas
      for (const [mx, my] of [[-0.46, 0.14], [0.47, 0.08]]) {
        const ch = c.createRadialGradient(r * mx, r * my, 0, r * mx, r * my, r * 0.2);
        ch.addColorStop(0, "rgba(255, 140, 170, 0.45)");
        ch.addColorStop(1, "rgba(255, 140, 170, 0)");
        c.fillStyle = ch;
        c.beginPath(); c.arc(r * mx, r * my, r * 0.2, 0, Math.PI * 2); c.fill();
      }
      const blink = !isHurt && (time % 4.2) > 4.05;
      const eyeK = pose.wide ? 1.22 : 1;
      c.save(); c.translate(-r * 0.22, -r * 0.10); c.rotate(-0.06); c.scale(eyeK, eyeK); almaDrawEye(c, r, blink, isHurt); c.restore();
      c.save(); c.translate(r * 0.21, -r * 0.15); c.rotate(0.05); c.scale(eyeK, eyeK); almaDrawEye(c, r, blink, isHurt); c.restore();
      almaDrawMouth(c, r, size, isHurt, pose.talk);
      c.restore();
    }
    c.restore(); // clip

    almaBodyPath(c, r, pose);
    c.strokeStyle = "#3a8cc8";
    c.lineWidth = Math.max(2.4, size * 0.04);
    c.stroke();
    c.restore();
  }

  // --- Burbuja del Escudo de Empatía ---
  if (hasShield) {
    const pulse = 1 + Math.sin(time * 6) * 0.04;
    const sr = size * 0.88 * pulse;
    const sg = c.createRadialGradient(-sr * 0.3, -sr * 0.3, sr * 0.1, 0, 0, sr);
    sg.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    sg.addColorStop(0.7, "rgba(138, 232, 255, 0.18)");
    sg.addColorStop(1, "rgba(255, 122, 184, 0.45)");
    c.fillStyle = sg;
    c.beginPath(); c.arc(0, 0, sr, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(180, 245, 255, 0.9)";
    c.lineWidth = Math.max(2, size * 0.04);
    c.beginPath(); c.arc(0, 0, sr, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = "rgba(255, 255, 255, 0.75)";
    c.lineWidth = Math.max(1.5, size * 0.03);
    c.beginPath(); c.arc(0, 0, sr * 0.84, -Math.PI * 0.82, -Math.PI * 0.48); c.stroke();
  }

  c.restore();
}
