// Pugo: a savings pet game. Phase 1: backyard, egg, chick, reactions, sounds.

const STORAGE_KEY = "pugo-save-v1";
const W = 96;
const H = 72;

// ---------- Saved state ----------

function freshState() {
  return { entries: [], stage: "egg", muted: false };
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.entries)) {
      return { ...freshState(), ...data };
    }
  } catch (error) {
    // Bad or blocked storage: start fresh.
  }
  return freshState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Storage unavailable: the game still works for this visit.
  }
}

let state = loadState();

function totalSaved() {
  return state.entries.reduce((sum, entry) => sum + entry.amount, 0);
}

// Whole amounts show as ₱100, others as ₱12.50
const pesoWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const pesoCents = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const peso = {
  format: (amount) => (Number.isInteger(amount) ? pesoWhole : pesoCents).format(amount)
};

// ---------- Sounds (made with the Web Audio API, no files) ----------

let audioCtx = null;

function audio() {
  if (state.muted) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(from, to, duration, type = "sine", volume = 0.15, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration, volume = 0.3, freq = 2000, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(start);
}

const sfx = {
  peep: () => tone(1800, 2700, 0.09),
  happyChirp: () => {
    tone(1500, 2400, 0.09);
    tone(1700, 2800, 0.09, "sine", 0.15, 0.11);
    tone(2000, 3200, 0.12, "sine", 0.15, 0.22);
  },
  coo: () => {
    tone(520, 640, 0.12, "triangle", 0.18);
    tone(640, 470, 0.2, "triangle", 0.18, 0.12);
  },
  bwee: () => {
    tone(400, 1200, 0.18, "square", 0.05);
    tone(1200, 300, 0.3, "square", 0.05, 0.18);
  },
  tapTap: () => {
    noise(0.04, 0.35, 1800);
    noise(0.04, 0.35, 1800, 0.12);
  },
  crack: () => noise(0.09, 0.5, 3000),
  pop: () => {
    tone(300, 900, 0.12, "triangle", 0.2);
    noise(0.06, 0.3, 2500);
  },
  jingle: () => {
    tone(1318, 1318, 0.09, "square", 0.05);
    tone(1568, 1568, 0.09, "square", 0.05, 0.08);
    tone(2093, 2093, 0.16, "square", 0.05, 0.16);
  },
  peck: () => noise(0.025, 0.08, 4000)
};

// ---------- Sprites (pixel maps drawn in code; placeholders for real art) ----------

const COLORS = {
  k: "#5a3b1e", // outline
  y: "#e8c26a", // chick body
  b: "#a8742f", // stripes
  w: "#cf9f4a", // wing
  o: "#d98a3a", // beak
  c: "#f1e6c8", // egg shell
  d: "#7a5532", // egg speckles
  r: "#e2556b", // heart
  s: "#f6d55c" // star
};

function makeSprite(rows) {
  const canvas = document.createElement("canvas");
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const g = canvas.getContext("2d");
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (COLORS[ch]) {
        g.fillStyle = COLORS[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
  });
  return canvas;
}

const SPRITES = {
  chick: makeSprite([
    "....kkkk....",
    "...kbybbk...",
    "..kyybyyyk..",
    "..kyyyyyykoo",
    ".kyyyyyyyk..",
    "kyyywwyyyyk.",
    "kyywwwyyyyk.",
    "kyyywwyyyk..",
    ".kyyyyyyyk..",
    "..kkkkkkk..."
  ]),
  egg: makeSprite([
    "..kkk..",
    ".kcdck.",
    "kcccdck",
    "kdcccck",
    "kccdcck",
    "kcccdck",
    "kdcccck",
    ".kcdck.",
    "..kkk.."
  ]),
  heart: makeSprite([".r.r.", "rrrrr", ".rrr.", "..r.."]),
  star: makeSprite([".s.", "sss", ".s."])
};

// ---------- Background (drawn once) ----------

function makeBackground() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const rect = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };

  rect(0, 0, W, 34, "#bfe6f5"); // sky
  rect(80, 4, 7, 7, "#f8d65c"); // sun
  rect(79, 6, 9, 3, "#f8d65c");

  // Fence
  for (let x = 2; x < W; x += 10) {
    rect(x, 14, 6, 20, "#c08a57");
    rect(x, 14, 6, 2, "#8a5a2b");
  }
  rect(0, 19, W, 2, "#8a5a2b");
  rect(0, 28, W, 2, "#8a5a2b");

  // Grass
  rect(0, 32, W, H - 32, "#8fcf6a");
  rect(0, 32, W, 2, "#74b956");
  for (let i = 0; i < 26; i++) {
    const x = (i * 37 + 11) % (W - 3);
    const y = 37 + ((i * 23) % 32);
    rect(x, y, 1, 2, "#5f9e45");
    rect(x + 2, y + 1, 1, 1, "#5f9e45");
  }

  // Flowers
  [[8, 40, "#f28fb1"], [60, 66, "#ffffff"], [88, 44, "#f6d55c"], [40, 68, "#f28fb1"]].forEach(([x, y, color]) => {
    rect(x, y + 2, 1, 2, "#3f7a32");
    rect(x - 1, y, 3, 2, color);
  });

  // Feeding bowl (empty for now)
  rect(70, 57, 13, 4, "#7a5236");
  rect(69, 56, 15, 2, "#5b3b24");
  rect(71, 56, 11, 1, "#3e2a1b");

  return canvas;
}

const NEST = { x: 14, y: 52, w: 24, h: 9 };

function drawNestBack(g) {
  g.fillStyle = "#a8762a";
  g.fillRect(NEST.x + 2, NEST.y, NEST.w - 4, 3);
}

function drawNestFront(g) {
  g.fillStyle = "#c9973f";
  g.fillRect(NEST.x, NEST.y + 3, NEST.w, 5);
  g.fillStyle = "#d9a441";
  g.fillRect(NEST.x + 1, NEST.y + 2, NEST.w - 2, 2);
  g.fillStyle = "#a8762a";
  for (let x = NEST.x + 2; x < NEST.x + NEST.w - 2; x += 4) g.fillRect(x, NEST.y + 5, 2, 1);
  g.fillStyle = "#8a5f22";
  g.fillRect(NEST.x + 1, NEST.y + 8, NEST.w - 2, 1);
}

// ---------- Game objects ----------

const canvas = document.getElementById("yard-canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const background = makeBackground();

const clouds = [
  { x: 10, y: 5, w: 12 },
  { x: 52, y: 9, w: 9 }
];

const egg = {
  x: NEST.x + 9,
  y: NEST.y - 5,
  wobbleTime: 0,
  nextWobble: 2,
  hatching: false,
  hatchTime: 0,
  cracks: 0
};

const chick = {
  x: NEST.x + 12,
  y: NEST.y + 4,
  face: 1,
  mode: "idle",
  timer: 1.5,
  target: null,
  speed: 14,
  frame: 0,
  frameTime: 0,
  pecks: 0,
  emotion: "normal",
  emotionTime: 0,
  blinkTime: 0,
  nextBlink: 3,
  hop: 0,
  tapCount: 0,
  tapResetTime: 0
};

let particles = [];
let time = 0;

const BOUNDS = { left: 6, right: 90, top: 42, bottom: 69 };

function setEmotion(emotion, seconds) {
  chick.emotion = emotion;
  chick.emotionTime = seconds;
}

function addParticle(kind, x, y, vx, vy, life) {
  particles.push({ kind, x, y, vx, vy, life, max: life });
}

function burstHearts(count) {
  for (let i = 0; i < count; i++) {
    addParticle("heart", chick.x - 2 + (Math.random() * 8 - 4), chick.y - 14, Math.random() * 6 - 3, -10 - Math.random() * 6, 1.2);
  }
}

// ---------- Behavior ----------

function pickNextMode() {
  const roll = Math.random();
  if (roll < 0.5) {
    chick.mode = "walk";
    chick.speed = 14;
    chick.target = {
      x: BOUNDS.left + Math.random() * (BOUNDS.right - BOUNDS.left),
      y: BOUNDS.top + Math.random() * (BOUNDS.bottom - BOUNDS.top)
    };
  } else if (roll < 0.8) {
    startPecking();
  } else {
    chick.face *= -1;
    chick.mode = "idle";
    chick.timer = 1 + Math.random() * 1.5;
  }
}

function startPecking() {
  chick.mode = "peck";
  chick.pecks = 3;
  chick.timer = 0.35;
  chick.frame = 0;
}

function updateChick(dt) {
  // Emotion timers
  if (chick.emotionTime > 0) {
    chick.emotionTime -= dt;
    if (chick.emotionTime <= 0) chick.emotion = "normal";
  }

  // Blinking
  chick.nextBlink -= dt;
  if (chick.nextBlink <= 0) {
    chick.blinkTime = 0.15;
    chick.nextBlink = 2 + Math.random() * 3;
  }
  if (chick.blinkTime > 0) chick.blinkTime -= dt;

  // Tap combo resets after a short pause
  if (chick.tapResetTime > 0) {
    chick.tapResetTime -= dt;
    if (chick.tapResetTime <= 0) chick.tapCount = 0;
  }

  // Hopping (happy / excited)
  if (chick.hop > 0) chick.hop = Math.max(0, chick.hop - dt);

  if (chick.mode === "react") {
    chick.timer -= dt;
    if (chick.emotion === "dizzy" && Math.random() < dt * 4) {
      chick.face *= -1;
    }
    if (chick.timer <= 0) {
      chick.mode = "idle";
      chick.timer = 0.8;
    }
    return;
  }

  if (chick.mode === "idle") {
    chick.timer -= dt;
    if (chick.timer <= 0) pickNextMode();
    return;
  }

  if (chick.mode === "walk") {
    const dx = chick.target.x - chick.x;
    const dy = chick.target.y - chick.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      if (chick.speed > 14) {
        startPecking();
      } else {
        chick.mode = "idle";
        chick.timer = 1 + Math.random() * 2;
      }
      return;
    }
    const step = Math.min(dist, chick.speed * dt);
    chick.x += (dx / dist) * step;
    chick.y += (dy / dist) * step;
    if (Math.abs(dx) > 0.5) chick.face = dx > 0 ? 1 : -1;
    chick.frameTime += dt;
    if (chick.frameTime > 0.14) {
      chick.frameTime = 0;
      chick.frame = 1 - chick.frame;
    }
    return;
  }

  if (chick.mode === "peck") {
    chick.timer -= dt;
    if (chick.timer <= 0) {
      chick.frame = 1 - chick.frame;
      chick.timer = 0.3;
      if (chick.frame === 1) {
        sfx.peck();
        addParticle("dust", chick.x + chick.face * 6, chick.y - 1, chick.face * 3, -6, 0.35);
      } else {
        chick.pecks -= 1;
        if (chick.pecks <= 0) {
          chick.mode = "idle";
          chick.timer = 1 + Math.random() * 1.5;
        }
      }
    }
  }
}

function updateEgg(dt) {
  if (egg.hatching) {
    egg.hatchTime += dt;
    const t = egg.hatchTime;
    const cracksDue = t > 1.3 ? 3 : t > 0.9 ? 2 : t > 0.5 ? 1 : 0;
    if (cracksDue > egg.cracks) {
      egg.cracks = cracksDue;
      sfx.crack();
    }
    if (t > 1.7) finishHatch();
    return;
  }

  egg.nextWobble -= dt;
  if (egg.nextWobble <= 0) {
    egg.wobbleTime = 0.5;
    egg.nextWobble = 2.5 + Math.random() * 2.5;
  }
  if (egg.wobbleTime > 0) egg.wobbleTime -= dt;
}

function updateParticles(dt) {
  particles.forEach((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "shell") p.vy += 60 * dt;
  });
  particles = particles.filter((p) => p.life > 0);
}

// ---------- Drawing ----------

function px(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawEyes() {
  const dark = "#2a1a0e";
  const blush = "#f29a9a";
  const emotion = chick.emotion;

  if (emotion === "dizzy") {
    px(6, 1, dark); px(8, 1, dark); px(7, 2, dark); px(6, 3, dark); px(8, 3, dark);
    return;
  }
  if (emotion === "happy") {
    px(6, 3, dark); px(7, 2, dark); px(8, 3, dark);
    px(8, 4, blush);
    return;
  }
  if (emotion === "excited") {
    px(7, 1, "#ffffff"); px(8, 1, dark); px(7, 2, dark); px(8, 2, dark);
    px(8, 4, blush);
    return;
  }
  if (chick.blinkTime > 0) {
    px(6, 2, "#a8742f"); px(7, 2, "#a8742f");
    return;
  }
  px(7, 2, dark);
}

function drawChick() {
  const pecking = chick.mode === "peck" && chick.frame === 1;
  const walking = chick.mode === "walk";
  const bob = walking && chick.frame === 1 ? -1 : 0;
  const hop = chick.hop > 0 ? -Math.round(Math.abs(Math.sin(chick.hop * 10)) * 4) : 0;
  const x = Math.round(chick.x);
  const y = Math.round(chick.y);

  // Shadow
  ctx.fillStyle = "rgba(40, 60, 20, 0.25)";
  ctx.fillRect(x - 4, y, 9, 1);

  ctx.save();
  ctx.translate(x, y + bob + hop);
  if (chick.face < 0) ctx.scale(-1, 1);
  ctx.translate(-6, -11);

  // Feet
  ctx.fillStyle = COLORS.o;
  if (walking && chick.frame === 1) {
    ctx.fillRect(4, 10, 1, 1);
    ctx.fillRect(6, 10, 1, 1);
  } else {
    ctx.fillRect(3, 10, 2, 1);
    ctx.fillRect(7, 10, 2, 1);
  }

  if (pecking) {
    ctx.translate(1, 2);
  }
  ctx.drawImage(SPRITES.chick, 0, 0);
  drawEyes();
  ctx.restore();

  // Dizzy stars circle the head
  if (chick.emotion === "dizzy") {
    for (let i = 0; i < 3; i++) {
      const angle = time * 5 + (i * Math.PI * 2) / 3;
      ctx.drawImage(SPRITES.star, Math.round(x - 1 + Math.cos(angle) * 6), Math.round(y - 15 + Math.sin(angle) * 2));
    }
  }
}

function drawEgg() {
  let shake = 0;
  if (egg.hatching) {
    shake = Math.round(Math.sin(egg.hatchTime * 40) * (1 + egg.hatchTime));
  } else if (egg.wobbleTime > 0) {
    shake = Math.round(Math.sin(egg.wobbleTime * 30));
  }
  const x = egg.x + Math.max(-2, Math.min(2, shake));
  ctx.drawImage(SPRITES.egg, x, egg.y);

  // Cracks appear one by one while hatching
  const crack = [[1, 4], [2, 3], [3, 4], [4, 3], [5, 4]];
  const shown = egg.cracks === 0 ? 0 : egg.cracks === 1 ? 2 : egg.cracks === 2 ? 4 : 5;
  for (let i = 0; i < shown; i++) px(x + crack[i][0], egg.y + crack[i][1], COLORS.k);
}

function drawClouds() {
  ctx.fillStyle = "#ffffff";
  clouds.forEach((c) => {
    const x = Math.round(c.x);
    ctx.fillRect(x, c.y, c.w, 3);
    ctx.fillRect(x + 2, c.y - 2, c.w - 5, 2);
  });
}

function drawParticles() {
  particles.forEach((p) => {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (p.kind === "heart") {
      if (p.life > 0.25 || Math.floor(p.life * 20) % 2 === 0) ctx.drawImage(SPRITES.heart, x, y);
    } else if (p.kind === "star") {
      ctx.drawImage(SPRITES.star, x, y);
    } else if (p.kind === "shell") {
      px(x, y, COLORS.c);
      px(x + 1, y, COLORS.d);
    } else if (p.kind === "dust") {
      px(x, y, "#c7b27a");
    } else if (p.kind === "spark") {
      if (Math.floor(p.life * 12) % 2 === 0) px(x, y, "#fff4b0");
    }
  });
}

function draw() {
  ctx.drawImage(background, 0, 0);
  drawClouds();
  drawNestBack(ctx);
  if (state.stage === "egg") {
    drawEgg();
    drawNestFront(ctx);
  } else {
    drawNestFront(ctx);
    drawChick();
  }
  drawParticles();
}

// ---------- Main loop ----------

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  time += dt;

  clouds.forEach((c) => {
    c.x += 1.5 * dt;
    if (c.x > W) c.x = -c.w;
  });

  if (state.stage === "egg") updateEgg(dt);
  else updateChick(dt);
  updateParticles(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------- UI ----------

const totalEl = document.getElementById("total-saved");
const hintEl = document.getElementById("hint");
const floatersEl = document.getElementById("floaters");
const announcer = document.getElementById("announcer");
const muteButton = document.getElementById("mute-button");
const saveButton = document.getElementById("save-button");
const dialog = document.getElementById("save-dialog");
const form = document.getElementById("save-form");
const amountInput = document.getElementById("amount-input");
const amountError = document.getElementById("amount-error");

let tappedOnce = false;

function renderUI() {
  totalEl.textContent = peso.format(totalSaved());
  muteButton.setAttribute("aria-pressed", String(state.muted));
  muteButton.setAttribute("aria-label", state.muted ? "Unmute sounds" : "Mute sounds");
  if (state.stage === "egg") {
    hintEl.textContent = "Save anything to hatch Pugo";
  } else if (!tappedOnce) {
    hintEl.textContent = "Tap Pugo to say hi";
  } else {
    hintEl.textContent = "";
  }
}

function announce(message) {
  announcer.textContent = message;
}

function floatText(text) {
  const el = document.createElement("span");
  el.className = "floater";
  el.textContent = text;
  floatersEl.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function startHatch() {
  egg.hatching = true;
  egg.hatchTime = 0;
  egg.cracks = 0;
  hintEl.textContent = "";
  sfx.tapTap();
}

function finishHatch() {
  egg.hatching = false;
  state.stage = "chick";
  saveState();

  chick.x = egg.x + 3;
  chick.y = NEST.y + 4;
  chick.face = 1;
  chick.mode = "react";
  chick.timer = 1.6;
  chick.hop = 0.6;
  setEmotion("excited", 1.6);

  for (let i = 0; i < 8; i++) {
    addParticle("shell", egg.x + 3, egg.y + 4, Math.random() * 30 - 15, -20 - Math.random() * 15, 0.8);
  }
  for (let i = 0; i < 10; i++) {
    addParticle("spark", egg.x + 3 + Math.random() * 16 - 8, egg.y + Math.random() * 10 - 6, 0, -4, 1);
  }
  sfx.pop();
  setTimeout(sfx.peep, 250);
  setTimeout(sfx.peep, 450);
  burstHearts(3);
  announce("Pugo hatched! Tap Pugo to say hi.");
  renderUI();
}

function celebrateSaving() {
  chick.mode = "react";
  chick.timer = 1.4;
  chick.hop = 0.6;
  setEmotion("excited", 1.4);
  for (let i = 0; i < 8; i++) {
    addParticle("spark", chick.x + Math.random() * 14 - 7, chick.y - 6 - Math.random() * 10, 0, -6, 0.9);
  }
  sfx.happyChirp();
  setTimeout(sfx.jingle, 300);
}

function addSaving(amount) {
  state.entries.push({ id: Date.now(), amount, date: new Date().toISOString() });
  saveState();
  renderUI();
  floatText("+" + peso.format(amount));
  announce("Saved " + peso.format(amount) + ". Total " + peso.format(totalSaved()) + ".");

  if (state.stage === "egg") {
    if (!egg.hatching) startHatch();
  } else {
    celebrateSaving();
  }
}

// Tapping the yard
function toYard(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H
  };
}

function hitsChick(point) {
  return point.x > chick.x - 8 && point.x < chick.x + 8 && point.y > chick.y - 14 && point.y < chick.y + 3;
}

function hitsEgg(point) {
  return point.x > egg.x - 3 && point.x < egg.x + 10 && point.y > egg.y - 3 && point.y < egg.y + 12;
}

function petChick() {
  if (!tappedOnce) {
    tappedOnce = true;
    renderUI();
  }
  chick.tapCount += 1;
  chick.tapResetTime = 1.5;

  if (chick.tapCount >= 5) {
    chick.tapCount = 0;
    chick.mode = "react";
    chick.timer = 2.2;
    setEmotion("dizzy", 2.2);
    sfx.bwee();
    announce("Pugo is dizzy!");
    return;
  }

  if (chick.emotion === "dizzy") return;
  chick.mode = "react";
  chick.timer = 1.1;
  chick.hop = 0.3;
  setEmotion("happy", 1.1);
  burstHearts(2);
  sfx.coo();
}

canvas.addEventListener("pointerdown", (event) => {
  const point = toYard(event);

  if (state.stage === "egg") {
    if (hitsEgg(point) && !egg.hatching) {
      egg.wobbleTime = 0.5;
      sfx.tapTap();
    }
    return;
  }

  if (hitsChick(point)) {
    petChick();
    return;
  }

  // Tap the ground: Pugo runs over to check it out
  if (chick.mode === "react") return;
  chick.mode = "walk";
  chick.speed = 26;
  chick.target = {
    x: Math.max(BOUNDS.left, Math.min(BOUNDS.right, point.x)),
    y: Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, point.y + 5))
  };
  sfx.peep();
  addParticle("star", point.x - 1, point.y - 1, 0, -4, 0.4);
});

// Mute
muteButton.addEventListener("click", () => {
  state.muted = !state.muted;
  saveState();
  renderUI();
  if (!state.muted) sfx.peep();
});

// Add savings dialog
function clearError() {
  amountError.textContent = "";
  amountInput.removeAttribute("aria-invalid");
}

saveButton.addEventListener("click", () => {
  form.reset();
  clearError();
  dialog.showModal();
  amountInput.focus();
});

document.getElementById("cancel-save").addEventListener("click", () => dialog.close());

document.querySelectorAll("[data-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    amountInput.value = button.dataset.amount;
    clearError();
    amountInput.focus();
  });
});

amountInput.addEventListener("input", clearError);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Math.round(Number(amountInput.value) * 100) / 100;

  if (!amountInput.value.trim() || !Number.isFinite(amount) || amount <= 0) {
    amountError.textContent = "Enter an amount greater than ₱0.";
    amountInput.setAttribute("aria-invalid", "true");
    amountInput.focus();
    return;
  }
  if (amount > 10000000) {
    amountError.textContent = "That's more than ₱10,000,000. Check the amount.";
    amountInput.setAttribute("aria-invalid", "true");
    amountInput.focus();
    return;
  }

  dialog.close();
  addSaving(amount);
});

// Start over
document.getElementById("reset-button").addEventListener("click", () => {
  if (!confirm("Start over? This clears your savings and Pugo goes back to an egg.")) return;
  const muted = state.muted;
  state = freshState();
  state.muted = muted;
  saveState();
  egg.hatching = false;
  egg.cracks = 0;
  particles = [];
  tappedOnce = false;
  renderUI();
});

renderUI();
requestAnimationFrame(loop);
