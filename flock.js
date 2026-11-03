// Pugo: the flock (Phase 4). Each completed goal lays an egg in the nest;
// tapping it hatches a new quail that lives in the backyard.
// Loaded before script.js. The functions here use the game's shared
// state (state, art, ctx, chick, sfx...) when they run.

const FLOCK_LIMIT = 3; // more room comes with nest boxes later

// Color varieties, made by recoloring the quail art. Dark pixels
// (outlines and eyes) are left alone so the shapes stay crisp.
const VARIETIES = [
  {
    id: "snow",
    name: "Snow white",
    tint: (r, g, b) => {
      const v = Math.min(255, 120 + ((r + g + b) / 3) * 0.6);
      return [v, v, v * 0.96];
    }
  },
  { id: "rosetta", name: "Rosetta", tint: (r, g, b) => [Math.min(255, r * 1.2 + 10), g * 0.8, b * 0.75] },
  { id: "cinnamon", name: "Cinnamon", tint: (r, g, b) => [Math.min(255, r * 1.1 + 35), Math.min(255, g * 0.95 + 20), b * 0.7] },
  { id: "midnight", name: "Midnight", tint: (r, g, b) => [r * 0.5, g * 0.5, b * 0.6] },
  { id: "brown", name: "Brown", tint: null }
];

function findVariety(id) {
  return VARIETIES.find((v) => v.id === id) || VARIETIES[0];
}

const flockArtCache = {};

function flockPoses(varietyId) {
  if (flockArtCache[varietyId]) return flockArtCache[varietyId];
  const variety = findVariety(varietyId);
  const result = {};
  Object.entries(art.forms.young).forEach(([pose, frame]) => {
    const c = document.createElement("canvas");
    c.width = frame.width;
    c.height = frame.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(frame, 0, 0);
    if (variety.tint) {
      const pixels = g.getImageData(0, 0, c.width, c.height);
      const d = pixels.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0 || d[i] + d[i + 1] + d[i + 2] < 150) continue;
        const [r, gr, b] = variety.tint(d[i], d[i + 1], d[i + 2]);
        d[i] = r;
        d[i + 1] = gr;
        d[i + 2] = b;
      }
      g.putImageData(pixels, 0, 0);
    }
    result[pose] = c;
  });
  flockArtCache[varietyId] = result;
  return result;
}

// ---------- Birds ----------

let flockBirds = [];

function makeBird(data, x, y) {
  return {
    data, // the saved record: { id, name, variety, fromGoalId }
    x: x ?? BOUNDS.left + Math.random() * (BOUNDS.right - BOUNDS.left),
    y: y ?? BOUNDS.top + 40 + Math.random() * (BOUNDS.bottom - BOUNDS.top - 40),
    face: Math.random() < 0.5 ? 1 : -1,
    mode: "idle",
    timer: 1 + Math.random() * 2,
    target: null,
    napping: false,
    speed: 55,
    walkFrame: 0,
    frameTime: 0,
    pecking: false,
    pecks: 0,
    hop: 0,
    happyTime: 0,
    nameTime: 0,
    zzzTime: 0
  };
}

function syncFlock() {
  flockBirds = state.flock.map((data) => makeBird(data));
}

function clampToYard(point) {
  return {
    x: Math.max(BOUNDS.left, Math.min(BOUNDS.right, point.x)),
    y: Math.max(BOUNDS.top, Math.min(BOUNDS.bottom, point.y))
  };
}

function pickBirdMode(b) {
  const roll = Math.random();
  b.napping = false;
  if (roll < 0.35) {
    b.mode = "walk";
    b.speed = 55;
    b.target = {
      x: BOUNDS.left + Math.random() * (BOUNDS.right - BOUNDS.left),
      y: BOUNDS.top + Math.random() * (BOUNDS.bottom - BOUNDS.top)
    };
  } else if (roll < 0.6) {
    // Follow Pugo around for a bit
    b.mode = "walk";
    b.speed = 65;
    b.target = clampToYard({ x: chick.x + (Math.random() < 0.5 ? -70 : 70), y: chick.y + Math.random() * 40 - 20 });
  } else if (roll < 0.88) {
    b.mode = "peck";
    b.pecks = 2 + Math.floor(Math.random() * 3);
    b.pecking = false;
    b.timer = 0.3;
  } else {
    // Nap in the nest
    b.mode = "walk";
    b.speed = 40;
    b.napping = true;
    b.target = { x: NEST.x + Math.random() * 80 - 40, y: NEST.y + 18 };
  }
}

function updateBird(b, dt) {
  if (b.hop > 0) b.hop = Math.max(0, b.hop - dt);
  if (b.happyTime > 0) b.happyTime -= dt;
  if (b.nameTime > 0) b.nameTime -= dt;

  if (b.mode === "idle") {
    b.timer -= dt;
    if (b.timer <= 0) pickBirdMode(b);
    return;
  }

  if (b.mode === "walk") {
    const dx = b.target.x - b.x;
    const dy = b.target.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) {
      if (b.napping) {
        b.mode = "nap";
        b.timer = 6 + Math.random() * 5;
        b.zzzTime = 0.6;
      } else {
        b.mode = "idle";
        b.timer = 1 + Math.random() * 2.5;
      }
      return;
    }
    const step = Math.min(dist, b.speed * dt);
    b.x += (dx / dist) * step;
    b.y += (dy / dist) * step;
    if (Math.abs(dx) > 2) b.face = dx > 0 ? 1 : -1;
    b.frameTime += dt;
    if (b.frameTime > 0.17) {
      b.frameTime = 0;
      b.walkFrame = 1 - b.walkFrame;
    }
    return;
  }

  if (b.mode === "peck") {
    b.timer -= dt;
    if (b.timer <= 0) {
      b.pecking = !b.pecking;
      b.timer = 0.3;
      if (!b.pecking) {
        b.pecks -= 1;
        if (b.pecks <= 0) {
          b.mode = "idle";
          b.timer = 1 + Math.random() * 2;
        }
      }
    }
    return;
  }

  if (b.mode === "nap") {
    b.timer -= dt;
    b.zzzTime -= dt;
    if (b.zzzTime <= 0) {
      b.zzzTime = 1.4;
      addParticle("zzz", b.x + 16, b.y - 60, 14, -22, 1.6);
    }
    if (b.timer <= 0) {
      b.mode = "idle";
      b.timer = 0.5;
    }
  }
}

function updateFlock(dt) {
  flockBirds.forEach((b) => updateBird(b, dt));
  updateFlockEgg(dt);
}

function birdFrame(b) {
  const set = flockPoses(b.data.variety);
  if (b.mode === "nap") return set.sleep;
  if (b.happyTime > 0) return set.happy;
  if (b.mode === "walk") return b.walkFrame ? set.walkB : set.walkA;
  if (b.mode === "peck" && b.pecking) return set.peck;
  return set.stand;
}

function drawBird(b) {
  const frame = birdFrame(b);
  let lift = 0;
  let scaleX = 1;
  let scaleY = 1;
  if (b.hop > 0) {
    lift = Math.abs(Math.sin(b.hop * 12)) * 14;
  } else if (b.mode === "walk") {
    lift = b.walkFrame ? 2 : 0;
  } else if (b.mode !== "peck") {
    const breath = Math.sin(time * 2.6 + b.x) * 0.025;
    scaleX = 1 + breath;
    scaleY = 1 - breath;
  }

  drawShadow(b.x, b.y, frame.width * 0.7);
  ctx.save();
  ctx.translate(b.x, b.y - lift);
  ctx.scale(scaleX * b.face, scaleY);
  ctx.drawImage(frame, -frame.width / 2, -frame.height);
  ctx.restore();

  if (b.nameTime > 0) drawNameTag(b.data.name, b.x, b.y - frame.height - 14);
}

function drawNameTag(name, x, y) {
  ctx.font = "bold 18px system-ui, sans-serif";
  const w = ctx.measureText(name).width + 18;
  ctx.fillStyle = "rgba(255, 250, 240, 0.95)";
  ctx.strokeStyle = "#3b2a1a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 26, w, 28, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3b2a1a";
  ctx.textAlign = "center";
  ctx.fillText(name, x, y - 6);
  ctx.textAlign = "start";
}

function hitsBird(point) {
  return flockBirds.find((b) => {
    const frame = flockPoses(b.data.variety).stand;
    const half = frame.width / 2 + 12;
    return point.x > b.x - half && point.x < b.x + half && point.y > b.y - frame.height - 10 && point.y < b.y + 12;
  });
}

function petBird(b) {
  b.happyTime = 1.1;
  b.hop = 0.3;
  b.nameTime = 2.2;
  if (b.mode === "nap") {
    b.mode = "idle";
    b.timer = 1;
  }
  for (let i = 0; i < 2; i++) {
    addParticle("heart", b.x + Math.random() * 30 - 15, b.y - 90, Math.random() * 30 - 15, -50 - Math.random() * 30, 1.1);
  }
  tone(700, 820, 0.1, "triangle", 0.15);
  tone(820, 600, 0.16, "triangle", 0.15, 0.1);
}

// ---------- Flock egg in the nest ----------

const flockEgg = {
  // Sits on the left side of the nest (NEST comes from script.js)
  get x() {
    return NEST.x - 42;
  },
  get y() {
    return NEST.y + 20;
  },
  wobbleTime: 0,
  nextWobble: 1.5,
  hatching: false,
  hatchTime: 0,
  cracks: 0
};

function updateFlockEgg(dt) {
  if (state.eggs.length === 0) return;
  if (flockEgg.hatching) {
    flockEgg.hatchTime += dt;
    const t = flockEgg.hatchTime;
    const cracksDue = t > 1.0 ? 2 : t > 0.5 ? 1 : 0;
    if (cracksDue > flockEgg.cracks) {
      flockEgg.cracks = cracksDue;
      sfx.crack();
    }
    if (t > 1.5) finishFlockHatch();
    return;
  }
  flockEgg.nextWobble -= dt;
  if (flockEgg.nextWobble <= 0) {
    flockEgg.wobbleTime = 0.5;
    flockEgg.nextWobble = 2 + Math.random() * 2;
  }
  if (flockEgg.wobbleTime > 0) flockEgg.wobbleTime -= dt;
}

function drawFlockEgg() {
  if (state.eggs.length === 0) return;
  const frame = art.egg[flockEgg.cracks];
  let angle = 0;
  if (flockEgg.hatching) angle = Math.sin(flockEgg.hatchTime * 30) * (0.08 + flockEgg.hatchTime * 0.1);
  else if (flockEgg.wobbleTime > 0) angle = Math.sin(flockEgg.wobbleTime * 25) * 0.12;
  ctx.save();
  ctx.translate(flockEgg.x, flockEgg.y);
  ctx.rotate(angle);
  ctx.drawImage(frame, -frame.width / 2, -frame.height);
  ctx.restore();
}

function hitsFlockEgg(point) {
  if (state.eggs.length === 0) return false;
  return point.x > flockEgg.x - 44 && point.x < flockEgg.x + 44 && point.y > flockEgg.y - 96 && point.y < flockEgg.y + 14;
}

function tapFlockEgg() {
  if (flockEgg.hatching) return;
  if (state.flock.length >= FLOCK_LIMIT) {
    flockEgg.wobbleTime = 0.5;
    sfx.nope();
    hintEl.textContent = "No room in the nest yet. Nest boxes are coming soon!";
    return;
  }
  flockEgg.hatching = true;
  flockEgg.hatchTime = 0;
  flockEgg.cracks = 0;
  sfx.tapTap();
}

// "MacBook Fund" -> "MacBook"
function suggestName(goalName) {
  const first = (goalName.split(/\s+/)[0] || "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 10);
  return first || "Pip";
}

let namingBird = null;

function finishFlockHatch() {
  flockEgg.hatching = false;
  flockEgg.cracks = 0;
  const eggData = state.eggs.shift();
  const variety = VARIETIES[state.flock.length % VARIETIES.length];
  const data = { id: "q" + Date.now(), name: suggestName(eggData.goalName), variety: variety.id, fromGoalId: eggData.goalId };
  state.flock.push(data);
  saveState();

  const bird = makeBird(data, flockEgg.x, flockEgg.y);
  bird.happyTime = 1.4;
  bird.hop = 0.6;
  flockBirds.push(bird);

  for (let i = 0; i < 10; i++) {
    addParticle("shell", flockEgg.x, flockEgg.y - 30, Math.random() * 160 - 80, -120 - Math.random() * 80, 0.9);
  }
  for (let i = 0; i < 12; i++) {
    addParticle("spark", flockEgg.x + Math.random() * 80 - 40, flockEgg.y - 30 - Math.random() * 60, 0, -20, 1);
  }
  sfx.pop();
  setTimeout(sfx.peep, 250);
  renderUI();
  announce("A " + variety.name.toLowerCase() + " quail hatched from your " + eggData.goalName + " goal!");

  setTimeout(() => openNameDialog(bird, eggData.goalName, variety.name), 900);
}

// ---------- Naming dialog ----------

const nameDialog = document.getElementById("name-dialog");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const nameError = document.getElementById("name-error");

function openNameDialog(bird, goalName, varietyName) {
  namingBird = bird;
  document.getElementById("name-detail").textContent = "A " + varietyName.toLowerCase() + " quail from your " + goalName + " goal.";
  nameInput.value = bird.data.name;
  nameError.textContent = "";
  nameInput.removeAttribute("aria-invalid");
  nameDialog.showModal();
  nameInput.select();
}

nameInput.addEventListener("input", () => {
  nameError.textContent = "";
  nameInput.removeAttribute("aria-invalid");
});

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameError.textContent = "Give your quail a name.";
    nameInput.setAttribute("aria-invalid", "true");
    nameInput.focus();
    return;
  }
  if (namingBird) {
    namingBird.data.name = name;
    namingBird.nameTime = 2.5;
    namingBird.happyTime = 1;
    saveState();
    sfx.happyChirp();
    announce("Say hi to " + name + "!");
  }
  namingBird = null;
  nameDialog.close();
});

// Closing without saving keeps the suggested name, and still shows it
nameDialog.addEventListener("close", () => {
  if (namingBird) namingBird.nameTime = 2.5;
  namingBird = null;
});
