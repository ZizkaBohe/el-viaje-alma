"use strict";

/* =========================================================================
   1. CONFIGURACIÓN DE SPRITE PERSONALIZADO PARA ALMA
   -------------------------------------------------------------------------
   Por defecto, Alma se dibuja por código (Canvas 2D) siguiendo el diseño de
   estrella celeste brillante, con su rizo superior, ojos expresivos y
   sonrisa. Si deseas usar tu propia imagen PNG/JPG/WebP o Data-URL como
   sprite o textura de Alma:
     1) Cambia `enabled` a `true` y pega la ruta o Data-URL en `src`, O
     2) Llama en consola o desde tu código a:
        cargarSpriteDeAlma("ruta/a/tu/alma.png");
========================================================================= */
const ALMA_SPRITE_CONFIG = {
  enabled: false,
  src: "", // Ejemplo: "alma_sprite.png" o "data:image/png;base64,..."
  image: null,
  loaded: false
};

function cargarSpriteDeAlma(rutaODataURL) {
  if (!rutaODataURL) {
    ALMA_SPRITE_CONFIG.enabled = false;
    ALMA_SPRITE_CONFIG.loaded = false;
    ALMA_SPRITE_CONFIG.image = null;
    return;
  }
  const img = new Image();
  img.onload = () => {
    ALMA_SPRITE_CONFIG.image = img;
    ALMA_SPRITE_CONFIG.loaded = true;
    ALMA_SPRITE_CONFIG.enabled = true;
  };
  img.onerror = () => {
    console.warn("No se pudo cargar el sprite de Alma; se usará el dibujo procedural.");
    ALMA_SPRITE_CONFIG.loaded = false;
    ALMA_SPRITE_CONFIG.enabled = false;
  };
  ALMA_SPRITE_CONFIG.src = rutaODataURL;
  img.src = rutaODataURL;
}

if (ALMA_SPRITE_CONFIG.enabled && ALMA_SPRITE_CONFIG.src) {
  cargarSpriteDeAlma(ALMA_SPRITE_CONFIG.src);
}
// Exponer globalmente por conveniencia si el usuario quiere cambiarlo desde DevTools
window.cargarSpriteDeAlma = cargarSpriteDeAlma;

/* =========================================================================
   2. CATÁLOGO DE BARRERAS SOCIALES Y FRASES MOTIVADORAS
========================================================================= */
const BARRIER_CATALOG = {
  large: [
    {
      label: "Prejuicios",
      display: "Los Prejuicios",
      quote: "Los prejuicios nacen del miedo a lo desconocido; tu autenticidad y tu luz siempre serán más grandes que cualquier idea preconcebida."
    },
    {
      label: "Discriminación",
      display: "La Discriminación",
      quote: "Mereces ocupar cada espacio con dignidad. La diversidad enriquece el universo entero; no dejes que nadie apague tu lugar."
    },
    {
      label: "Exclusión",
      display: "La Exclusión",
      quote: "Cuando te cierran una puerta, tu propio brillo abre nuevos caminos de estrellas donde todas las personas caben."
    },
    {
      label: "Rechazo",
      display: "El Rechazo",
      quote: "El rechazo habla de quien no supo mirar con empatía, nunca de tu valor. Sigue brillando para quienes sí saben ver."
    },
    {
      label: "Desigualdad",
      display: "La Desigualdad",
      quote: "Cada paso que das reclamando oportunidades justas construye puentes de luz más firmes para quienes vienen detrás."
    },
    {
      label: "Estereotipos",
      display: "Los Estereotipos",
      quote: "Ninguna etiqueta puede encerrar la inmensidad de lo que eres y puedes lograr. Eres mucho más que un molde."
    }
  ],
  high: [
    {
      label: "Sobreprotección",
      display: "La Sobreprotección",
      quote: "Cuidar no es encerrar ni limitar. Confiar en tu propia fuerza te permite descubrir hasta dónde eres capaz de llegar."
    },
    {
      label: "Infantilización",
      display: "La Infantilización",
      quote: "Tu voz, tus decisiones y tus sueños tienen pleno valor. Mereces ser escuchada y tratada con respeto y autonomía."
    }
  ],
  low: [
    {
      label: "Burlas",
      display: "Las Burlas",
      quote: "Quien se burla intenta opacar lo que no comprende. Salta por encima del ruido y conserva intacta tu alegría."
    },
    {
      label: "Lástima",
      display: "La Lástima",
      quote: "No necesitas compasión que te haga pequeña, sino empatía que camine a tu lado de igual a igual."
    },
    {
      label: "Miradas de pena",
      display: "Las Miradas de pena",
      quote: "Alza la mirada hacia el cosmos: tu historia está hecha de valentía, talento y luz propia, nunca de lástima."
    },
    {
      label: "Ignorar",
      display: "El Ignorar",
      quote: "Aunque a veces el mundo mire hacia otro lado, tu presencia importa y deja una estela imposible de borrar."
    }
  ]
};

const GENERAL_QUOTES = [
  "Cada obstáculo superado transforma el espacio en un lugar más justo y luminoso.",
  "La empatía es el escudo más poderoso del universo: úsala para abrir camino."
];

/* =========================================================================
   PALABRAS COLECCIONABLES (estilo Subway Surfers)
   Recoge las letras en orden para completar la palabra y ganar puntos extra.
   Puedes editar o añadir palabras libremente.
========================================================================= */
const WORDS = ["ALMA", "EMPATÍA", "RESPETO", "IGUALDAD", "INCLUSIÓN", "AMISTAD", "DIVERSIDAD"];
const WORD_BONUS_BASE = 500;   // puntos al completar la primera palabra
const WORD_BONUS_STEP = 250;   // puntos extra por cada palabra completada después

/* =========================================================================
   MUNDOS / PLANETAS DEL VIAJE DE ALMA (cada uno es un VALOR)
   Cada PLANET_DISTANCE unidades aparece un VÉRTICE (curva tipo Temple Run):
   el camino se dobla hacia un lado y al final hay un portal con palabras del
   planeta siguiente. Cada mundo tiene paleta, atmósfera, adornos del camino
   (prop) y su propio JEFE.
========================================================================= */
const PLANET_DISTANCE = 620;

// Jefes: aparecen cada cierto tiempo, tienen 3 vidas y se vencen con palabras bonitas
const BOSS_FIRST_DISTANCE = 950;
const BOSS_INTERVAL = 1500;
const BOSS_LIVES = 3;
const MAX_AMMO = 5;
const AMMO_WORDS = [
  "Amor", "Respeto", "Empatía", "Valentía", "Amistad", "Esperanza",
  "Igualdad", "Ternura", "Inclusión", "Bondad", "Alegría", "Gratitud",
  "Paz", "Unión", "Luz", "Confianza"
];

// Los 3 jefes principales, cada uno con su propia skin visual en js/boss.js
const BOSS_ROSTER = [
  { name: "Exclusión", label: "EXCLUSIÓN", skin: "exclusion", color: "#ff4d94" },
  { name: "Soledad", label: "SOLEDAD", skin: "soledad", color: "#6e8bff" },
  { name: "Indiferencia", label: "INDIFERENCIA", skin: "indiferencia", color: "#7ad8e8" }
];

const PLANET_WORLDS = [
  {
    name: "Planeta Empatía",
    subtitle: "Mundo de los Corazones",
    accent: "#8ae8ff",
    vertexWords: ["Escuchar", "Comprender", "Ternura", "Cuidar"],
    prop: "heartLamp", propColor: [255, 130, 190],
    boss: { name: "La Indiferencia", label: "INDIFERENCIA", color: "#ff6ab0" },
    sky: [[4, 6, 20], [19, 9, 48], [31, 12, 63], [9, 7, 26]],
    nebula: [[92, 48, 198], [204, 48, 152]],
    bridge: [70, 118, 255],
    laneSide: [138, 232, 255],
    laneCenter: [200, 150, 255],
    railOuter: [138, 232, 255],
    railInner: [215, 165, 255],
    cross: [170, 240, 255],
    horizon: [26, 14, 58],
    planet: { style: "ringed", extra: "heart", c1: "#7254ff", c2: "#1e104c", ring: "rgba(255, 150, 210, 0.45)", x: 0.22, y: 0.19, r: 0.085 },
    ambient: { shape: "heart", color: "#ff9ec8" }
  },
  {
    name: "Planeta Amistad",
    subtitle: "Océano de los Lazos",
    accent: "#ff94c2",
    vertexWords: ["Lealtad", "Compañía", "Confianza", "Risas"],
    prop: "coral", propColor: [255, 140, 190],
    boss: { name: "La Soledad", label: "SOLEDAD", color: "#ff7a5c" },
    sky: [[24, 6, 36], [68, 18, 66], [116, 34, 78], [22, 9, 34]],
    nebula: [[235, 78, 148], [64, 196, 214]],
    bridge: [232, 96, 166],
    laneSide: [255, 154, 196],
    laneCenter: [110, 236, 240],
    railOuter: [255, 166, 208],
    railInner: [120, 238, 245],
    cross: [255, 194, 222],
    horizon: [56, 18, 52],
    planet: { style: "coral", c1: "#ff8ab8", c2: "#541345", ring: "rgba(130, 245, 245, 0.42)", x: 0.78, y: 0.18, r: 0.095 },
    ambient: { shape: "bubble", color: "#ffd2eb" }
  },
  {
    name: "Planeta Respeto",
    subtitle: "Bosque de Cristal",
    accent: "#72ffd8",
    vertexWords: ["Dignidad", "Escucha", "Valorar", "Cortesía"],
    prop: "crystal", propColor: [120, 255, 224],
    boss: { name: "El Burlón", label: "BURLAS", color: "#b06cff" },
    sky: [[3, 18, 32], [8, 46, 66], [16, 76, 86], [5, 18, 30]],
    nebula: [[42, 214, 180], [92, 118, 255]],
    bridge: [56, 206, 192],
    laneSide: [114, 255, 224],
    laneCenter: [152, 198, 255],
    railOuter: [120, 255, 224],
    railInner: [150, 210, 255],
    cross: [180, 255, 240],
    horizon: [10, 42, 56],
    planet: { style: "aurora", c1: "#8cf7ff", c2: "#16466b", ring: "rgba(120, 255, 216, 0.4)", x: 0.25, y: 0.17, r: 0.082 },
    ambient: { shape: "crystal", color: "#b8fff0" }
  },
  {
    name: "Planeta Igualdad",
    subtitle: "Dunas de Oro",
    accent: "#ffd26b",
    vertexWords: ["Justicia", "Equidad", "Derechos", "Oportunidad"],
    prop: "obelisk", propColor: [255, 214, 110],
    boss: { name: "El Coloso Desigual", label: "DESIGUALDAD", color: "#ffb347" },
    sky: [[26, 10, 22], [78, 32, 24], [124, 62, 28], [26, 12, 18]],
    nebula: [[255, 168, 64], [216, 76, 114]],
    bridge: [242, 152, 58],
    laneSide: [255, 212, 110],
    laneCenter: [255, 142, 112],
    railOuter: [255, 218, 120],
    railInner: [255, 156, 110],
    cross: [255, 232, 166],
    horizon: [64, 28, 18],
    planet: { style: "solar", c1: "#fff09c", c2: "#d95b26", ring: "rgba(255, 218, 120, 0.45)", x: 0.50, y: 0.22, r: 0.105 },
    ambient: { shape: "ember", color: "#ffe08a" }
  },
  {
    name: "Planeta Inclusión",
    subtitle: "Jardín de Todos",
    accent: "#98ff9c",
    vertexWords: ["Pertenecer", "Acoger", "Participar", "Juntos"],
    prop: "flower", propColor: [255, 170, 228],
    boss: { name: "El Gran Muro", label: "EXCLUSIÓN", color: "#ff6cd8" },
    sky: [[8, 24, 30], [22, 54, 58], [56, 30, 74], [12, 20, 32]],
    nebula: [[78, 212, 146], [238, 118, 204]],
    bridge: [76, 198, 156],
    laneSide: [148, 255, 192],
    laneCenter: [255, 168, 226],
    railOuter: [152, 255, 196],
    railInner: [255, 174, 226],
    cross: [198, 255, 220],
    horizon: [20, 46, 44],
    planet: { style: "loto", c1: "#7ef5b8", c2: "#1d524c", ring: "rgba(255, 166, 224, 0.45)", x: 0.76, y: 0.18, r: 0.088 },
    ambient: { shape: "petal", color: "#ffb8e6" }
  },
  {
    name: "Planeta Diversidad",
    subtitle: "Corazón Arcoíris",
    accent: "#d6a4ff",
    vertexWords: ["Colores", "Culturas", "Voces", "Únicos"],
    prop: "prism", propColor: [224, 168, 255],
    boss: { name: "El Estereotipo", label: "ESTEREOTIPOS", color: "#7ad0ff" },
    sky: [[10, 4, 34], [44, 14, 92], [92, 22, 120], [16, 6, 38]],
    nebula: [[164, 78, 255], [255, 196, 86]],
    bridge: [158, 92, 255],
    laneSide: [142, 238, 255],
    laneCenter: [255, 220, 124],
    railOuter: [224, 168, 255],
    railInner: [255, 224, 136],
    cross: [240, 212, 255],
    horizon: [40, 14, 78],
    planet: { style: "binary", extra: "rainbow", c1: "#9bf2ff", c2: "#3b229e", ring: "rgba(255, 226, 130, 0.48)", x: 0.30, y: 0.18, r: 0.075 },
    ambient: { shape: "rainbow", color: "#fff0b8" }
  }
];
