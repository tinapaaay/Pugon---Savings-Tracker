// Pugo: a savings pet game. Phase 1: backyard, egg, chick, reactions, sounds.
// Art lives in assets/ (made with Gemini). Sprite sheets use a magenta
// background, which is removed in code when the game loads.

const STORAGE_KEY = "pugo-save-v1";
const W = 1024;
const H = 765;

// Where things sit in the background image (in image pixels)
const NEST = { x: 475, y: 238, width: 200 };
const BOUNDS = { left: 330, right: 725, top: 175, bottom: 400 };
const CLEARING_CENTER_X = 530; // the phone camera centers here

// ---------- Saved state ----------

const PESOS_PER_COIN = 10;
const STARTER_COINS = 10;

function freshState() {
  return { entries: [], stage: "egg", muted: false, coins: 0, lastFedAt: null };
}

function coinsFor(amount) {
  return Math.floor(amount / PESOS_PER_COIN);
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.entries)) {
      const loaded = { ...freshState(), ...data };
      // Saves from before coins existed: give the coins they would have earned
      if (typeof data.coins !== "number") {
        const earned = data.entries.reduce((sum, entry) => sum + coinsFor(entry.amount), 0);
        loaded.coins = earned + (loaded.stage === "egg" ? 0 : STARTER_COINS);
      }
      return loaded;
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
  peck: () => noise(0.025, 0.08, 4000),
  crunch: () => {
    noise(0.05, 0.3, 1300);
    noise(0.04, 0.22, 2300, 0.05);
  },
  burp: () => tone(230, 90, 0.32, "sawtooth", 0.07),
  coin: () => {
    tone(1568, 1568, 0.06, "square", 0.05);
    tone(2093, 2093, 0.14, "square", 0.05, 0.06);
  },
  thud: () => noise(0.08, 0.35, 320),
  nope: () => tone(320, 200, 0.16, "square", 0.04)
};

// ---------- Loading the art ----------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

// Makes the magenta background (and its pinkish edges) see-through.
function removeMagenta(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const pixels = g.getImageData(0, 0, c.width, c.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const gr = d[i + 1];
    const b = d[i + 2];
    if (r > gr + 40 && b > gr + 40) d[i + 3] = 0;
  }
  g.putImageData(pixels, 0, 0);
  return c;
}

// Finds each drawing in a sheet by looking for see-through gaps between them.
function sliceFrames(sheet, count) {
  const g = sheet.getContext("2d", { willReadFrequently: true });
  const { width, height } = sheet;
  const alpha = g.getImageData(0, 0, width, height).data;
  const isFilled = (x, y) => alpha[(y * width + x) * 4 + 3] > 0;

  const filledColumn = [];
  for (let x = 0; x < width; x++) {
    let filled = false;
    for (let y = 0; y < height && !filled; y++) filled = isFilled(x, y);
    filledColumn.push(filled);
  }

  // Group filled columns into segments, ignoring tiny gaps
  let segments = [];
  let start = -1;
  let gap = 0;
  for (let x = 0; x <= width; x++) {
    const filled = x < width && filledColumn[x];
    if (filled) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap > 6 || x === width) {
        segments.push({ left: start, right: x - gap });
        start = -1;
        gap = 0;
      }
    }
  }

  // Specks (like flying shell bits) can make extra segments: merge the
  // narrowest one into its closest neighbor until the count is right.
  while (segments.length > count) {
    let i = 0;
    segments.forEach((s, j) => {
      if (s.right - s.left < segments[i].right - segments[i].left) i = j;
    });
    const s = segments[i];
    const prev = segments[i - 1];
    const next = segments[i + 1];
    const useNext = !prev || (next && next.left - s.right < s.left - prev.right);
    const other = useNext ? next : prev;
    other.left = Math.min(other.left, s.left);
    other.right = Math.max(other.right, s.right);
    segments.splice(i, 1);
  }

  return segments.map(({ left, right }) => {
    let top = height;
    let bottom = 0;
    for (let x = left; x <= right; x++) {
      for (let y = 0; y < height; y++) {
        if (isFilled(x, y)) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    const frame = document.createElement("canvas");
    frame.width = right - left + 1;
    frame.height = bottom - top + 1;
    frame.getContext("2d").drawImage(sheet, left, top, frame.width, frame.height, 0, 0, frame.width, frame.height);
    return frame;
  });
}

// Shrinks a frame smoothly so it matches the background's scale.
function scaleFrame(frame, scale) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(frame.width * scale));
  c.height = Math.max(1, Math.round(frame.height * scale));
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(frame, 0, 0, c.width, c.height);
  return c;
}

const art = {};

async function loadArt() {
  const [background, nest, egg, chick] = await Promise.all([
    loadImage("assets/background.webp"),
    loadImage("assets/nest.webp"),
    loadImage("assets/egg.png"),
    loadImage("assets/chick.png")
  ]);

  art.background = background;

  const nestFrame = sliceFrames(removeMagenta(nest), 1)[0];
  art.nest = scaleFrame(nestFrame, NEST.width / nestFrame.width);

  const eggFrames = sliceFrames(removeMagenta(egg), 3);
  const eggScale = 82 / eggFrames[0].height;
  art.egg = eggFrames.map((f) => scaleFrame(f, eggScale));

  // Chick poses: stand, walk A, walk B, peck, sleep, happy
  const chickFrames = sliceFrames(removeMagenta(chick), 6);
  const chickScale = 92 / chickFrames[0].height;
  const [stand, walkA, walkB, peck, sleep, happy] = chickFrames.map((f) => scaleFrame(f, chickScale));
  art.chick = { stand, walkA, walkB, peck, sleep, happy };

  // Food art is optional: use placeholders when assets/food.png is missing
  art.food = {};
  FOODS.forEach((food) => (art.food[food.id] = placeholderFood(food.id)));
  try {
    const sheet = await loadImage("assets/food.png");
    const frames = sliceFrames(removeMagenta(sheet), FOODS.length);
    const foodScale = 44 / Math.max(...frames.map((f) => f.height));
    FOODS.forEach((food, i) => (art.food[food.id] = scaleFrame(frames[i], foodScale)));
  } catch (error) {
    // No food sheet yet
  }
}

// Small pixel effects (hearts, stars) drawn in code
function makePixelSprite(rows, colors, size) {
  const c = document.createElement("canvas");
  c.width = rows[0].length * size;
  c.height = rows.length * size;
  const g = c.getContext("2d");
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (colors[ch]) {
        g.fillStyle = colors[ch];
        g.fillRect(x * size, y * size, size, size);
      }
    });
  });
  return c;
}

const FX = {
  heart: makePixelSprite(
    [".kk.kk.", "krrkrrk", "krrrrrk", ".krrrk.", "..krk..", "...k..."],
    { k: "#5a1f2a", r: "#ef5a74" },
    3
  ),
  star: makePixelSprite(
    ["..k..", ".kyk.", "kyyyk", ".kyk.", "..k.."],
    { k: "#7a5a12", y: "#ffe066" },
    3
  )
};

// ---------- Food ----------
// Bites = how many pecks it takes to finish. Locked treats open with goals (Phase 4).

const FOODS = [
  { id: "seeds", name: "Seeds", price: 3, kind: "everyday", bites: 2, note: "A quick snack" },
  { id: "worm", name: "Worm", price: 6, kind: "everyday", bites: 3, note: "Happy chirp" },
  { id: "berries", name: "Berries", price: 10, kind: "everyday", bites: 3, note: "Extra hearts" },
  { id: "pandesal", name: "Pandesal", price: 40, kind: "treat", bites: 4, note: "Happy dance" },
  { id: "ensaymada", name: "Ensaymada", price: 60, kind: "treat", bites: 4, note: "Happy dance", lockedNote: "Unlocks when a goal reaches 25%" },
  { id: "turon", name: "Turon", price: 90, kind: "treat", bites: 5, note: "Special dance", lockedNote: "Unlocks when a goal reaches 50%" },
  { id: "lechon", name: "Lechon", price: 200, kind: "treat", bites: 6, note: "Big celebration", lockedNote: "Unlocks when a goal reaches 100%" }
];

function isUnlocked(food) {
  return !food.lockedNote; // Goals arrive in Phase 4
}

// Simple placeholder icons until assets/food.png is made in Gemini
const FOOD_PIXELS = {
  seeds: [["..a....a", "a...a...", "..a...a.", ".a..a..a", "a..a...."], { a: "#b98a3e" }],
  worm: [["....kpp.", "...kppek", "kk.kpppk", "kppkppk.", ".kppk..."], { k: "#7a2f3d", p: "#ef8fa6", e: "#2b1a10" }],
  berries: [["...g.g..", "..g..g..", ".krkkrk.", "krhrkrhr", "krrrkrrr", ".kkk.kk."], { k: "#5a1424", r: "#d23a4a", h: "#ff9aa6", g: "#4f8f3d" }],
  pandesal: [["..kkkk..", ".kbllbk.", "kbllbbbk", "kbbbbbbk", ".kkkkkk."], { k: "#6b3f1c", b: "#c98a4a", l: "#e8b877" }],
  ensaymada: [[".kkkkk.", "kwywywk", "kywwwyk", "kwywywk", ".kkkkk."], { k: "#8a5a2b", w: "#fff4d6", y: "#f2c94c" }],
  turon: [["kkkkkkkk", "kyyyyyyk", "kbybybyk", "kkkkkkkk"], { k: "#6b3f1c", y: "#e9b44c", b: "#a8652a" }],
  lechon: [[".kkkkkk..", "kbbbbbbkk", "kbhbbbbbk", "kbbbbbbek", ".kkkkkkk.", ".k.k..k.k"], { k: "#5a2a12", b: "#c46a2c", h: "#e89a5a", e: "#2b1a10" }]
};

function placeholderFood(id) {
  const [rows, colors] = FOOD_PIXELS[id];
  return makePixelSprite(rows, colors, 5);
}

// ---------- Game objects ----------

const canvas = document.getElementById("yard-canvas");
const ctx = canvas.getContext("2d");

// Camera: on narrow (phone) screens, show a taller crop centered on the
// clearing so Pugo looks bigger. Wider screens see the whole yard.
const view = { x: 0, width: W };

function updateView() {
  const narrow = window.innerWidth < 600;
  view.width = narrow ? 600 : W;
  view.x = narrow ? Math.round(Math.min(W - view.width, Math.max(0, CLEARING_CENTER_X - view.width / 2))) : 0;
  if (canvas.width !== view.width) canvas.width = view.width;
}

updateView();
window.addEventListener("resize", updateView);

const egg = {
  x: NEST.x,
  y: NEST.y + 22,
  wobbleTime: 0,
  nextWobble: 2,
  hatching: false,
  hatchTime: 0,
  cracks: 0
};

const chick = {
  x: NEST.x,
  y: NEST.y + 20,
  face: 1,
  mode: "idle",
  timer: 1.5,
  target: null,
  speed: 70,
  walkFrame: 0,
  frameTime: 0,
  pecking: false,
  pecks: 0,
  emotion: "normal",
  emotionTime: 0,
  hop: 0,
  hopHeight: 0,
  tapCount: 0,
  tapResetTime: 0,
  foodTarget: null
};

let particles = [];
let foods = []; // food dropped in the yard
let time = 0;

function setEmotion(emotion, seconds) {
  chick.emotion = emotion;
  chick.emotionTime = seconds;
}

function startHop(seconds, height) {
  chick.hop = seconds;
  chick.hopHeight = height;
}

function addParticle(kind, x, y, vx, vy, life) {
  particles.push({ kind, x, y, vx, vy, life, max: life });
}

function burstHearts(count) {
  for (let i = 0; i < count; i++) {
    addParticle("heart", chick.x + (Math.random() * 40 - 20), chick.y - 100, Math.random() * 30 - 15, -50 - Math.random() * 30, 1.2);
  }
}

// ---------- Behavior ----------

function nearestFood() {
  let best = null;
  foods.forEach((food) => {
    if (!food.landed) return;
    const dist = Math.hypot(food.x - chick.x, food.y - chick.y);
    if (!best || dist < best.dist) best = { food, dist };
  });
  return best && best.food;
}

function goToFood(food) {
  // Stand beside the food so the beak reaches it
  const fromLeft = chick.x <= food.x;
  chick.foodTarget = food;
  chick.mode = "walk";
  chick.speed = 150;
  chick.target = { x: food.x + (fromLeft ? -40 : 40), y: food.y };
}

function pickNextMode() {
  const food = nearestFood();
  if (food) {
    goToFood(food);
    return;
  }
  const roll = Math.random();
  if (roll < 0.5) {
    chick.mode = "walk";
    chick.speed = 70;
    chick.foodTarget = null;
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
  chick.pecking = false;
  chick.timer = 0.3;
}

function startEating(food) {
  if (!foods.includes(food)) {
    // Food is gone (eaten or cleared): look for another
    chick.foodTarget = null;
    chick.mode = "idle";
    chick.timer = 0.2;
    return;
  }
  chick.mode = "eat";
  chick.face = food.x >= chick.x ? 1 : -1;
  chick.pecking = false;
  chick.timer = 0.25;
}

function updateEating(dt) {
  const food = chick.foodTarget;
  if (!foods.includes(food)) {
    chick.foodTarget = null;
    chick.mode = "idle";
    chick.timer = 0.2;
    return;
  }
  chick.timer -= dt;
  if (chick.timer > 0) return;

  chick.pecking = !chick.pecking;
  chick.timer = 0.26;
  if (!chick.pecking) return;

  // One bite
  sfx.crunch();
  food.bitesLeft -= 1;
  for (let i = 0; i < 4; i++) {
    addParticle("crumb", food.x, food.y - 10, Math.random() * 80 - 40, -60 - Math.random() * 50, 0.5);
  }
  if (food.bitesLeft <= 0) finishEating(food);
}

function finishEating(food) {
  foods = foods.filter((f) => f !== food);
  chick.foodTarget = null;
  state.lastFedAt = new Date().toISOString();
  saveState();

  const info = FOODS.find((f) => f.id === food.id);
  chick.mode = "react";
  chick.pecking = false;

  if (info.kind === "treat") {
    // Treats: happy dance and a little burp
    chick.timer = 2;
    startHop(1.6, 30);
    setEmotion("excited", 2);
    burstHearts(4);
    for (let i = 0; i < 14; i++) {
      addParticle("spark", chick.x + Math.random() * 90 - 45, chick.y - 30 - Math.random() * 70, 0, -30, 1);
    }
    sfx.happyChirp();
    setTimeout(sfx.burp, 700);
  } else {
    chick.timer = 1.2;
    startHop(0.3, 14);
    setEmotion("happy", 1.2);
    burstHearts(food.id === "berries" ? 4 : 2);
    if (food.id === "worm") sfx.happyChirp();
    else sfx.coo();
  }
  announce("Pugo ate the " + info.name.toLowerCase() + ".");
}

// True when a spot is too close to the nest for Pugo to stand and eat
function nearNest(x, y) {
  const dx = (x - NEST.x) / 160;
  const dy = (y - NEST.y) / 100;
  return dx * dx + dy * dy < 1;
}

function dropFood(id) {
  // Land somewhere in the open grass, away from the nest
  let x;
  let y;
  let tries = 0;
  do {
    x = BOUNDS.left + 40 + Math.random() * (BOUNDS.right - BOUNDS.left - 80);
    y = BOUNDS.top + 20 + Math.random() * (BOUNDS.bottom - BOUNDS.top - 30);
    tries += 1;
  } while (nearNest(x, y) && tries < 50);

  const info = FOODS.find((f) => f.id === id);
  foods.push({ id, x, y, z: 260, vz: 0, landed: false, bounced: false, bitesLeft: info.bites, bites: info.bites });
}

function updateFoods(dt) {
  foods.forEach((food) => {
    if (food.landed) return;
    food.vz -= 900 * dt;
    food.z += food.vz * dt;
    if (food.z <= 0) {
      food.z = 0;
      if (!food.bounced) {
        food.bounced = true;
        food.vz = 160;
        sfx.thud();
        for (let i = 0; i < 4; i++) {
          addParticle("dust", food.x, food.y - 2, Math.random() * 80 - 40, -40 - Math.random() * 30, 0.4);
        }
      } else {
        food.landed = true;
        foodLanded();
      }
    }
  });
}

function foodLanded() {
  // Pugo notices the food: excited peep, then runs over
  if (chick.mode === "eat" || chick.emotion === "dizzy") return;
  chick.mode = "react";
  chick.timer = 0.5;
  startHop(0.25, 12);
  setEmotion("excited", 0.5);
  sfx.peep();
  setTimeout(sfx.peep, 140);
}

function updateChick(dt) {
  if (chick.emotionTime > 0) {
    chick.emotionTime -= dt;
    if (chick.emotionTime <= 0) chick.emotion = "normal";
  }

  if (chick.tapResetTime > 0) {
    chick.tapResetTime -= dt;
    if (chick.tapResetTime <= 0) chick.tapCount = 0;
  }

  if (chick.hop > 0) chick.hop = Math.max(0, chick.hop - dt);

  if (chick.mode === "react") {
    chick.timer -= dt;
    if (chick.timer <= 0) {
      chick.mode = "idle";
      chick.timer = nearestFood() ? 0.1 : 0.8;
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
    if (dist < 3) {
      if (chick.foodTarget) {
        startEating(chick.foodTarget);
      } else if (chick.speed > 70) {
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
    if (Math.abs(dx) > 2) chick.face = dx > 0 ? 1 : -1;
    chick.frameTime += dt;
    if (chick.frameTime > 0.16) {
      chick.frameTime = 0;
      chick.walkFrame = 1 - chick.walkFrame;
    }
    return;
  }

  if (chick.mode === "eat") {
    updateEating(dt);
    return;
  }

  if (chick.mode === "peck") {
    chick.timer -= dt;
    if (chick.timer <= 0) {
      chick.pecking = !chick.pecking;
      chick.timer = 0.28;
      if (chick.pecking) {
        sfx.peck();
        for (let i = 0; i < 3; i++) {
          addParticle("dust", chick.x + chick.face * 36, chick.y - 2, chick.face * (10 + Math.random() * 20), -20 - Math.random() * 20, 0.4);
        }
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
    const cracksDue = t > 1.2 ? 2 : t > 0.6 ? 1 : 0;
    if (cracksDue > egg.cracks) {
      egg.cracks = cracksDue;
      sfx.crack();
    }
    if (t > 1.8) finishHatch();
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
    if (p.kind === "shell" || p.kind === "dust" || p.kind === "crumb") p.vy += 240 * dt;
  });
  particles = particles.filter((p) => p.life > 0);
}

// ---------- Drawing ----------

function drawShadow(x, y, width) {
  ctx.fillStyle = "rgba(30, 50, 20, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, width / 2, width / 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNest() {
  ctx.drawImage(art.nest, Math.round(NEST.x - art.nest.width / 2), Math.round(NEST.y - art.nest.height / 2));
}

function drawEgg() {
  const frame = art.egg[egg.cracks];
  let angle = 0;
  if (egg.hatching) {
    angle = Math.sin(egg.hatchTime * 30) * (0.08 + egg.hatchTime * 0.08);
  } else if (egg.wobbleTime > 0) {
    angle = Math.sin(egg.wobbleTime * 25) * 0.12;
  }
  ctx.save();
  ctx.translate(egg.x, egg.y);
  ctx.rotate(angle);
  ctx.drawImage(frame, -frame.width / 2, -frame.height);
  ctx.restore();
}

function drawFoods() {
  foods.forEach((food) => {
    const sprite = art.food[food.id];
    const size = 0.45 + 0.55 * (food.bitesLeft / food.bites);
    const w = sprite.width * size;
    const h = sprite.height * size;
    drawShadow(food.x, food.y, w * 0.9 * (1 - Math.min(food.z, 200) / 300));
    ctx.drawImage(sprite, food.x - w / 2, food.y - h - food.z, w, h);
  });
}

function chickFrame() {
  if (chick.emotion === "happy" || chick.emotion === "excited") return art.chick.happy;
  if (chick.mode === "walk") return chick.walkFrame ? art.chick.walkB : art.chick.walkA;
  if ((chick.mode === "peck" || chick.mode === "eat") && chick.pecking) return art.chick.peck;
  return art.chick.stand;
}

function drawChick() {
  const frame = chickFrame();
  const x = chick.x;
  const y = chick.y;

  // Hop height, plus squash and stretch for a bouncy feel
  let lift = 0;
  let scaleX = 1;
  let scaleY = 1;
  if (chick.hop > 0) {
    const bounce = Math.abs(Math.sin(chick.hop * 12));
    lift = bounce * chick.hopHeight;
    scaleX = 1 - bounce * 0.08;
    scaleY = 1 + bounce * 0.1;
  } else if (chick.mode === "walk") {
    lift = chick.walkFrame ? 2 : 0;
  } else if (chick.mode !== "peck" && chick.mode !== "eat") {
    const breath = Math.sin(time * 3) * 0.025;
    scaleX = 1 + breath;
    scaleY = 1 - breath;
  }

  let tilt = 0;
  if (chick.emotion === "dizzy") tilt = Math.sin(time * 9) * 0.15;

  drawShadow(x, y, frame.width * 0.7 * (1 - lift / 120));

  ctx.save();
  ctx.translate(x, y - lift);
  ctx.rotate(tilt);
  ctx.scale(scaleX * chick.face, scaleY);
  ctx.drawImage(frame, -frame.width / 2, -frame.height);
  ctx.restore();

  if (chick.emotion === "dizzy") {
    for (let i = 0; i < 3; i++) {
      const angle = time * 5 + (i * Math.PI * 2) / 3;
      const sx = x + Math.cos(angle) * 36 - FX.star.width / 2;
      const sy = y - 104 + Math.sin(angle) * 8;
      ctx.drawImage(FX.star, Math.round(sx), Math.round(sy));
    }
  }
}

function drawParticles() {
  particles.forEach((p) => {
    const fade = Math.min(1, p.life / (p.max * 0.4));
    ctx.globalAlpha = fade;
    if (p.kind === "heart") {
      ctx.drawImage(FX.heart, Math.round(p.x), Math.round(p.y));
    } else if (p.kind === "star") {
      ctx.drawImage(FX.star, Math.round(p.x), Math.round(p.y));
    } else if (p.kind === "shell") {
      ctx.fillStyle = "#efdcb4";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 6, 5);
      ctx.fillStyle = "#7a4e2c";
      ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) + 1, 2, 2);
    } else if (p.kind === "crumb") {
      ctx.fillStyle = "#c98a4a";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
    } else if (p.kind === "dust") {
      ctx.fillStyle = "#d8c690";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
    } else if (p.kind === "spark") {
      ctx.fillStyle = "#fff6c4";
      const s = Math.floor(p.life * 10) % 2 === 0 ? 6 : 3;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
  });
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, -view.x, 0);
  ctx.drawImage(art.background, 0, 0, W, H);
  if (state.stage === "egg") {
    drawNest();
    drawEgg();
  } else if (chick.y < NEST.y - 20) {
    // Pugo is behind the nest
    drawFoods();
    drawChick();
    drawNest();
  } else {
    drawNest();
    drawFoods();
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

  if (state.stage === "egg") updateEgg(dt);
  else updateChick(dt);
  updateFoods(dt);
  updateParticles(dt);
  draw();
  requestAnimationFrame(loop);
}

// ---------- UI ----------

const totalEl = document.getElementById("total-saved");
const coinEl = document.getElementById("coin-count");
const shopButton = document.getElementById("shop-button");
const shopDialog = document.getElementById("shop-dialog");
const shopCoinsEl = document.getElementById("shop-coins");
const shopMessage = document.getElementById("shop-message");
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
let ready = false;

function renderUI() {
  totalEl.textContent = peso.format(totalSaved());
  coinEl.textContent = state.coins;
  shopCoinsEl.textContent = state.coins;
  muteButton.setAttribute("aria-pressed", String(state.muted));
  muteButton.setAttribute("aria-label", state.muted ? "Unmute sounds" : "Mute sounds");
  if (!ready) return;
  if (state.stage === "egg") {
    hintEl.textContent = egg.hatching ? "" : "Save anything to hatch Pugo";
  } else if (!tappedOnce) {
    hintEl.textContent = "Tap Pugo to say hi";
  } else {
    hintEl.textContent = "";
  }
}

function announce(message) {
  announcer.textContent = message;
}

function floatText(text, extraClass = "") {
  const el = document.createElement("span");
  el.className = "floater " + extraClass;
  el.textContent = text;
  floatersEl.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function startHatch() {
  egg.hatching = true;
  egg.hatchTime = 0;
  egg.cracks = 0;
  renderUI();
  sfx.tapTap();
}

function finishHatch() {
  egg.hatching = false;
  state.stage = "chick";
  state.coins += STARTER_COINS;
  saveState();
  floatText("+" + STARTER_COINS + " starter coins", "floater-coins");

  chick.x = egg.x;
  chick.y = NEST.y + 20;
  chick.face = 1;
  chick.mode = "react";
  chick.timer = 1.6;
  startHop(0.6, 26);
  setEmotion("excited", 1.6);

  for (let i = 0; i < 10; i++) {
    addParticle("shell", egg.x, egg.y - 30, Math.random() * 160 - 80, -120 - Math.random() * 80, 0.9);
  }
  for (let i = 0; i < 14; i++) {
    addParticle("spark", egg.x + Math.random() * 90 - 45, egg.y - 30 - Math.random() * 60, 0, -20, 1);
  }
  sfx.pop();
  setTimeout(sfx.peep, 250);
  setTimeout(sfx.peep, 450);
  burstHearts(3);
  announce("Pugo hatched! You got " + STARTER_COINS + " starter coins. Tap Pugo to say hi.");
  renderUI();
}

function celebrateSaving() {
  if (chick.mode === "eat") {
    sfx.happyChirp();
    setTimeout(sfx.jingle, 300);
    return;
  }
  chick.mode = "react";
  chick.timer = 1.4;
  startHop(0.8, 34);
  setEmotion("excited", 1.4);
  for (let i = 0; i < 12; i++) {
    addParticle("spark", chick.x + Math.random() * 80 - 40, chick.y - 30 - Math.random() * 60, 0, -30, 0.9);
  }
  sfx.happyChirp();
  setTimeout(sfx.jingle, 300);
}

function addSaving(amount) {
  const earned = coinsFor(amount);
  state.entries.push({ id: Date.now(), amount, date: new Date().toISOString() });
  state.coins += earned;
  saveState();
  renderUI();
  floatText("+" + peso.format(amount));
  if (earned > 0) setTimeout(() => floatText("+" + earned + " coins", "floater-coins"), 250);
  announce("Saved " + peso.format(amount) + ". You earned " + earned + " coins. Total " + peso.format(totalSaved()) + ".");

  if (!ready) return;
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
    x: view.x + ((event.clientX - rect.left) / rect.width) * view.width,
    y: ((event.clientY - rect.top) / rect.height) * H
  };
}

function hitsChick(point) {
  return point.x > chick.x - 52 && point.x < chick.x + 52 && point.y > chick.y - 105 && point.y < chick.y + 14;
}

function hitsEgg(point) {
  return point.x > egg.x - 48 && point.x < egg.x + 48 && point.y > egg.y - 100 && point.y < egg.y + 16;
}

function petChick() {
  if (chick.mode === "eat") return;
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
  startHop(0.3, 16);
  setEmotion("happy", 1.1);
  burstHearts(2);
  sfx.coo();
}

canvas.addEventListener("pointerdown", (event) => {
  if (!ready) return;
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

  // Tap the grass: Pugo runs over to check it out
  if (chick.mode === "react" || chick.mode === "eat") return;
  chick.foodTarget = null;
  chick.mode = "walk";
  chick.speed = 130;
  chick.target = {
    x: Math.max(BOUNDS.left, Math.min(BOUNDS.right, point.x)),
    y: Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, point.y))
  };
  sfx.peep();
  addParticle("star", point.x - FX.star.width / 2, point.y - FX.star.height / 2, 0, -20, 0.4);
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

// Shop
function shopItem(food) {
  const li = document.createElement("li");
  li.className = "shop-item";
  const unlocked = isUnlocked(food);
  if (!unlocked) li.classList.add("locked");

  const icon = document.createElement("img");
  icon.className = "shop-icon";
  icon.alt = "";
  icon.src = art.food[food.id].toDataURL();

  const info = document.createElement("div");
  info.className = "shop-info";
  const name = document.createElement("strong");
  name.textContent = food.name;
  const note = document.createElement("span");
  note.textContent = unlocked ? food.note : food.lockedNote;
  info.append(name, note);

  const buy = document.createElement("button");
  buy.type = "button";
  buy.className = "buy-button";
  buy.innerHTML = '<span class="coin" aria-hidden="true"></span>' + food.price;
  buy.setAttribute("aria-label", unlocked ? "Buy " + food.name + " for " + food.price + " coins" : food.name + " is locked");
  buy.addEventListener("click", () => buyFood(food));

  li.append(icon, info, buy);
  return li;
}

function renderShop() {
  const everyday = document.getElementById("shop-everyday");
  const treats = document.getElementById("shop-treats");
  everyday.replaceChildren(...FOODS.filter((f) => f.kind === "everyday").map(shopItem));
  treats.replaceChildren(...FOODS.filter((f) => f.kind === "treat").map(shopItem));
}

function buyFood(food) {
  if (!isUnlocked(food)) {
    shopMessage.textContent = food.lockedNote + ".";
    sfx.nope();
    return;
  }
  if (state.coins < food.price) {
    shopMessage.textContent = "You need " + (food.price - state.coins) + " more coins. Save money to earn coins!";
    sfx.nope();
    return;
  }
  state.coins -= food.price;
  saveState();
  renderUI();
  sfx.coin();
  shopDialog.close();
  dropFood(food.id);
  announce("Bought " + food.name + ". " + state.coins + " coins left.");
}

shopButton.addEventListener("click", () => {
  if (!ready) return;
  if (state.stage === "egg") {
    hintEl.textContent = "Hatch Pugo first: save anything!";
    sfx.nope();
    return;
  }
  shopMessage.textContent = "";
  renderShop();
  shopDialog.showModal();
});

document.getElementById("close-shop").addEventListener("click", () => shopDialog.close());

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
  foods = [];
  chick.foodTarget = null;
  chick.mode = "idle";
  tappedOnce = false;
  renderUI();
});

// ---------- Start ----------

renderUI();
hintEl.textContent = "Loading…";

loadArt()
  .then(() => {
    ready = true;
    renderUI();
    requestAnimationFrame(loop);
  })
  .catch((error) => {
    console.error(error);
    hintEl.textContent = "Couldn't load the art. Open the game through a local server, not by double-clicking the file.";
  });
