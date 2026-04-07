const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const STORAGE_PREFIX = "alien-artillery-profile:";
const MATCH_PREFIX = "alien-artillery-match:";
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TEAM_SIZE = 4;
const TURN_TIME = 24;
const GRAVITY = 0.22;
const EXPLOSION_RADIUS = 34;
const POWER_MAX = 100;

const dom = {
  usernameInput: document.getElementById("usernameInput"),
  loginBtn: document.getElementById("loginBtn"),
  loadProfileBtn: document.getElementById("loadProfileBtn"),
  profileStatus: document.getElementById("profileStatus"),
  modeSelect: document.getElementById("modeSelect"),
  scenarioSelect: document.getElementById("scenarioSelect"),
  scenarioTitle: document.getElementById("scenarioTitle"),
  scenarioDescription: document.getElementById("scenarioDescription"),
  newGameBtn: document.getElementById("newGameBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  saveBtn: document.getElementById("saveBtn"),
  skipBtn: document.getElementById("skipBtn"),
  hudProfile: document.getElementById("hudProfile"),
  hudTurn: document.getElementById("hudTurn"),
  hudTimer: document.getElementById("hudTimer"),
  hudPower: document.getElementById("hudPower"),
  hudWind: document.getElementById("hudWind"),
  overlayMessage: document.getElementById("overlayMessage")
};

const scenarios = [
  {
    id: "forest",
    name: "Forest Frontier",
    description:
      "A glowing woodland ridge with soft rolling hills, giant fungi, and dense roots. The terrain is forgiving, but trees and slopes create clever cover for ambushes.",
    skyTop: "#16361a",
    skyBottom: "#4f9153",
    soil: "#5a3b25",
    accent: "#9ff07f",
    decor: "forest"
  },
  {
    id: "city",
    name: "Neon City Siege",
    description:
      "A broken futuristic skyline with elevated rubble, cracked platforms, and steel fragments. Sight lines are longer here, but narrow rooftops punish bad footing.",
    skyTop: "#0c1631",
    skyBottom: "#5b5caa",
    soil: "#4a4d5b",
    accent: "#ffd166",
    decor: "city"
  },
  {
    id: "lake",
    name: "Crystal Lake Basin",
    description:
      "A calm alien lake split by wet cliffs and shallow inlets. Water sits in the low ground, so knockbacks and craters can send units sliding toward danger.",
    skyTop: "#09314a",
    skyBottom: "#2ea8c4",
    soil: "#4c3b2b",
    accent: "#8ef1ff",
    decor: "lake"
  },
  {
    id: "space",
    name: "Orbital Dust Ring",
    description:
      "A fragmented moon belt suspended above the stars. Jagged asteroid shelves leave big gaps, strong silhouettes, and the most dramatic artillery arcs of the four arenas.",
    skyTop: "#040611",
    skyBottom: "#1c2458",
    soil: "#6e6c84",
    accent: "#f4a6ff",
    decor: "space"
  }
];

const state = {
  profile: null,
  terrain: new Uint8Array(WIDTH),
  players: [],
  projectiles: [],
  particles: [],
  activeIndex: 0,
  activeTeam: "player",
  turnTimeLeft: TURN_TIME,
  wind: 0,
  charging: false,
  chargePower: 0,
  matchOver: false,
  overlay: "Login and start a match to begin commanding your alien squad.",
  scenario: scenarios[0],
  mode: "ai",
  currentMatchId: null,
  lastTimestamp: 0,
  aiThinking: 0
};

const keys = {
  a: false,
  d: false,
  w: false,
  s: false,
  space: false
};

setupUI();
requestAnimationFrame(gameLoop);

function setupUI() {
  scenarios.forEach((scenario) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    dom.scenarioSelect.appendChild(option);
  });

  updateScenarioCard();
  updateHUD();

  dom.loginBtn.addEventListener("click", loginProfile);
  dom.loadProfileBtn.addEventListener("click", loadProfileOnly);
  dom.newGameBtn.addEventListener("click", startNewGame);
  dom.resumeBtn.addEventListener("click", resumeSavedMatch);
  dom.saveBtn.addEventListener("click", () => saveMatch(true, false));
  dom.skipBtn.addEventListener("click", () => {
    if (canControlCurrentAlien()) {
      endTurn("Turn skipped.");
    }
  });
  dom.scenarioSelect.addEventListener("change", updateScenarioCard);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

function updateScenarioCard() {
  const selected = scenarios.find((scenario) => scenario.id === dom.scenarioSelect.value) || scenarios[0];
  state.scenario = selected;
  dom.scenarioTitle.textContent = selected.name;
  dom.scenarioDescription.textContent = selected.description;
}

function loginProfile() {
  const username = dom.usernameInput.value.trim();
  if (!username) {
    setOverlay("Enter a profile name first.");
    return;
  }

  const existing = safeParse(localStorage.getItem(STORAGE_PREFIX + username.toLowerCase()));
  state.profile = existing || {
    username,
    createdAt: new Date().toISOString(),
    stats: { wins: 0, losses: 0, savedMatches: 0 }
  };
  persistProfile();
  dom.profileStatus.textContent = `Profile ready: ${state.profile.username}`;
  dom.hudProfile.textContent = state.profile.username;
  setOverlay(`Profile ${state.profile.username} loaded. Choose a mode and scenario.`);
}

function loadProfileOnly() {
  const username = dom.usernameInput.value.trim();
  if (!username) {
    setOverlay("Type a profile name to load.");
    return;
  }
  const profile = safeParse(localStorage.getItem(STORAGE_PREFIX + username.toLowerCase()));
  if (!profile) {
    setOverlay("No profile found with that name.");
    return;
  }
  state.profile = profile;
  dom.profileStatus.textContent = `Loaded existing profile: ${profile.username}`;
  dom.hudProfile.textContent = profile.username;
  setOverlay(`Welcome back, ${profile.username}.`);
}

function startNewGame() {
  if (!state.profile) {
    setOverlay("Login with a profile before starting a match.");
    return;
  }

  state.mode = dom.modeSelect.value;
  state.scenario = scenarios.find((scenario) => scenario.id === dom.scenarioSelect.value) || scenarios[0];
  state.currentMatchId = `${state.profile.username.toLowerCase()}-${Date.now()}`;
  state.terrain = generateTerrain(state.scenario);
  state.players = spawnTeams();
  state.projectiles = [];
  state.particles = [];
  state.activeTeam = "player";
  state.activeIndex = firstLivingIndex("player");
  state.turnTimeLeft = TURN_TIME;
  state.wind = randomRange(-0.04, 0.04);
  state.charging = false;
  state.chargePower = 0;
  state.matchOver = false;
  state.aiThinking = 0;
  settlePlayers();
  setOverlay(`${state.scenario.name} ready. ${getCurrentAlien().name} begins.`);
  updateHUD();
  saveMatch(false, true);
}

function resumeSavedMatch() {
  if (!state.profile) {
    setOverlay("Login with a profile before resuming a match.");
    return;
  }

  const match = safeParse(localStorage.getItem(MATCH_PREFIX + state.profile.username.toLowerCase()));
  if (!match) {
    setOverlay("No saved match found for this profile.");
    return;
  }

  state.terrain = Uint8Array.from(match.terrain);
  state.players = match.players;
  state.projectiles = match.projectiles || [];
  state.particles = [];
  state.activeIndex = match.activeIndex;
  state.activeTeam = match.activeTeam;
  state.mode = match.mode;
  state.turnTimeLeft = match.turnTimeLeft;
  state.wind = match.wind;
  state.charging = false;
  state.chargePower = 0;
  state.matchOver = match.matchOver;
  state.scenario = scenarios.find((scenario) => scenario.id === match.scenarioId) || scenarios[0];
  state.currentMatchId = match.matchId;
  state.aiThinking = 0;

  dom.modeSelect.value = state.mode;
  dom.scenarioSelect.value = state.scenario.id;
  updateScenarioCard();
  setOverlay(`Resumed saved match for ${state.profile.username}.`);
  updateHUD();
}

function saveMatch(manual = false, silent = false) {
  if (!state.profile || !state.players.length) {
    if (!silent) {
      setOverlay("There is no active match to save yet.");
    }
    return;
  }

  const payload = {
    matchId: state.currentMatchId,
    scenarioId: state.scenario.id,
    mode: state.mode,
    terrain: Array.from(state.terrain),
    players: state.players,
    projectiles: state.projectiles,
    activeIndex: state.activeIndex,
    activeTeam: state.activeTeam,
    turnTimeLeft: state.turnTimeLeft,
    wind: state.wind,
    matchOver: state.matchOver,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(MATCH_PREFIX + state.profile.username.toLowerCase(), JSON.stringify(payload));
  if (manual) {
    state.profile.stats.savedMatches += 1;
  }
  persistProfile();
  if (!silent) {
    setOverlay("Match saved locally in this browser.");
  }
}

function persistProfile() {
  if (!state.profile) return;
  localStorage.setItem(STORAGE_PREFIX + state.profile.username.toLowerCase(), JSON.stringify(state.profile));
}

function spawnTeams() {
  const lineup = [];
  const colors = {
    player: ["#77f29e", "#5fd9ff", "#d2ff72", "#f8f36c"],
    enemy: ["#ff8da1", "#ffb36a", "#d497ff", "#ffd95e"]
  };
  const leftSlots = [110, 195, 280, 365];
  const rightSlots = [715, 800, 885, 970];

  for (let i = 0; i < TEAM_SIZE; i += 1) {
    lineup.push(makeAlien("player", i, leftSlots[i], colors.player[i]));
  }
  for (let i = 0; i < TEAM_SIZE; i += 1) {
    lineup.push(makeAlien("enemy", i, rightSlots[i], colors.enemy[i]));
  }
  return lineup;
}

function makeAlien(team, index, x, color) {
  return {
    id: `${team}-${index}`,
    name: `${team === "player" ? "Pilot" : "Raider"} ${index + 1}`,
    team,
    x,
    y: 0,
    vy: 0,
    radius: 13,
    health: 100,
    alive: true,
    color,
    facing: team === "player" ? 1 : -1,
    jumpReady: true,
    aiPlan: null
  };
}

function gameLoop(timestamp) {
  const dt = Math.min(32, timestamp - (state.lastTimestamp || timestamp));
  state.lastTimestamp = timestamp;

  update(dt / 16.666);
  render();
  requestAnimationFrame(gameLoop);
}

function update(step) {
  if (!state.players.length) {
    renderIdleBackground();
    return;
  }

  if (!state.matchOver) {
    state.turnTimeLeft -= step / 60;
    if (state.turnTimeLeft <= 0 && !state.projectiles.length) {
      endTurn("Turn timer expired.");
    }
  }

  updateCurrentActor(step);
  updateProjectiles(step);
  updateParticles(step);
  settlePlayers();
  checkWinCondition();
  updateHUD();
}

function updateCurrentActor(step) {
  const actor = getCurrentAlien();
  if (!actor || !actor.alive || state.matchOver || state.projectiles.length) return;

  if (state.mode === "ai" && actor.team === "enemy") {
    handleAI(actor, step);
    return;
  }

  if (!canControlCurrentAlien()) return;

  const moveSpeed = 1.7 * step;
  if (keys.a) {
    actor.x -= moveSpeed;
    actor.facing = -1;
  }
  if (keys.d) {
    actor.x += moveSpeed;
    actor.facing = 1;
  }
  actor.x = clamp(actor.x, actor.radius, WIDTH - actor.radius);

  if (keys.w && actor.jumpReady && isGrounded(actor)) {
    actor.vy = -5.6;
    actor.jumpReady = false;
  }
  if (!keys.w && isGrounded(actor)) {
    actor.jumpReady = true;
  }
  if (keys.s && !isGrounded(actor)) {
    actor.vy += 0.14 * step;
  }
}

function handleAI(actor, step) {
  state.aiThinking += step;
  if (state.aiThinking < 42) return;

  if (!actor.aiPlan) {
    const target = pickNearestTarget(actor);
    if (!target) return;
    const dx = target.x - actor.x;
    actor.facing = dx >= 0 ? 1 : -1;
    actor.aiPlan = {
      moveFrames: Math.min(75, Math.floor(Math.abs(dx) * 0.12)),
      power: clamp(Math.abs(dx) * 0.14 + Math.random() * 12 + 30, 25, 96),
      loft: clamp(3.8 + Math.abs(dx) * 0.006, 3.8, 7.2)
    };
  }

  if (actor.aiPlan.moveFrames > 0) {
    actor.x += actor.facing * 1.05 * step;
    actor.x = clamp(actor.x, actor.radius, WIDTH - actor.radius);
    actor.aiPlan.moveFrames -= 1;
    return;
  }

  fireProjectile(actor, actor.aiPlan.power, actor.aiPlan.loft);
  actor.aiPlan = null;
  state.aiThinking = 0;
}

function updateProjectiles(step) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    projectile.vx += state.wind * step;
    projectile.vy += GRAVITY * step;
    projectile.x += projectile.vx * step;
    projectile.y += projectile.vy * step;

    if (projectile.x < 0 || projectile.x >= WIDTH || projectile.y > HEIGHT + 40) {
      state.projectiles.splice(i, 1);
      endTurn("Shot lost beyond the battlefield.");
      continue;
    }

    if (isTerrainAt(projectile.x, projectile.y)) {
      explode(projectile.x, projectile.y);
      state.projectiles.splice(i, 1);
      endTurn("Impact!");
      continue;
    }

    let hitAlien = false;
    for (const alien of state.players) {
      if (!alien.alive || alien.id === projectile.ownerId) continue;
      const distance = Math.hypot(projectile.x - alien.x, projectile.y - alien.y);
      if (distance <= alien.radius + projectile.radius) {
        explode(projectile.x, projectile.y);
        state.projectiles.splice(i, 1);
        endTurn("Direct hit!");
        hitAlien = true;
        break;
      }
    }
    if (hitAlien) continue;
  }
}

function updateParticles(step) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.life -= step;
    particle.x += particle.vx * step;
    particle.y += particle.vy * step;
    particle.vy += 0.08 * step;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function settlePlayers() {
  for (const alien of state.players) {
    if (!alien.alive) continue;

    alien.vy += GRAVITY;
    alien.y += alien.vy;

    const groundY = getGroundY(alien.x);
    const desiredY = groundY - alien.radius;
    if (alien.y >= desiredY) {
      alien.y = desiredY;
      alien.vy = 0;
    }

    if (alien.y > HEIGHT + 80) {
      alien.alive = false;
      alien.health = 0;
    }
  }
}

function explode(x, y) {
  carveTerrain(x, y, EXPLOSION_RADIUS);

  for (const alien of state.players) {
    if (!alien.alive) continue;
    const distance = Math.hypot(alien.x - x, alien.y - y);
    if (distance > EXPLOSION_RADIUS + 38) continue;

    const damage = Math.max(10, Math.round(75 - distance * 1.2));
    alien.health = Math.max(0, alien.health - damage);
    if (alien.health <= 0) {
      alien.alive = false;
    }

    const push = Math.max(0.5, (EXPLOSION_RADIUS + 40 - distance) / 18);
    const angle = Math.atan2(alien.y - y, alien.x - x);
    alien.x = clamp(alien.x + Math.cos(angle) * push * 10, alien.radius, WIDTH - alien.radius);
    alien.vy = Math.min(alien.vy, -Math.sin(angle) * push * 2.2);
  }

  for (let i = 0; i < 26; i += 1) {
    state.particles.push({
      x,
      y,
      vx: randomRange(-2.8, 2.8),
      vy: randomRange(-3.8, -0.4),
      life: randomRange(14, 28),
      color: i % 2 === 0 ? "#ffd68a" : "#ff845f"
    });
  }
}

function carveTerrain(cx, cy, radius) {
  for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(WIDTH, Math.ceil(cx + radius)); x += 1) {
    const dx = x - cx;
    const inside = radius * radius - dx * dx;
    if (inside <= 0) continue;
    const depth = Math.sqrt(inside);
    const newHeight = Math.ceil(cy + depth);
    state.terrain[x] = Math.max(state.terrain[x], newHeight);
  }
}

function endTurn(message) {
  if (state.matchOver) return;

  state.charging = false;
  state.chargePower = 0;
  state.projectiles = [];
  state.wind = randomRange(-0.04, 0.04);
  state.turnTimeLeft = TURN_TIME;
  state.aiThinking = 0;

  let nextTeam = state.activeTeam === "player" ? "enemy" : "player";
  let nextIndex = nextLivingIndex(nextTeam);
  if (nextIndex === -1) {
    nextTeam = state.activeTeam;
    nextIndex = nextLivingIndex(nextTeam);
  }

  state.activeTeam = nextTeam;
  state.activeIndex = nextIndex;
  const nextAlien = getCurrentAlien();
  if (nextAlien) {
    nextAlien.aiPlan = null;
  }
  setOverlay(message ? `${message} ${nextAlien ? nextAlien.name : ""} is up.` : `${nextAlien.name} is up.`);
  saveMatch(false, true);
}

function nextLivingIndex(team) {
  const members = state.players.filter((alien) => alien.team === team && alien.alive);
  if (!members.length) return -1;

  const current = getCurrentAlien();
  const teamIndices = state.players
    .map((alien, index) => ({ alien, index }))
    .filter((entry) => entry.alien.team === team && entry.alien.alive)
    .map((entry) => entry.index);

  if (!current || current.team !== team) {
    return teamIndices[0];
  }

  const currentPosition = teamIndices.indexOf(state.activeIndex);
  if (currentPosition === -1) {
    return teamIndices[0];
  }
  return teamIndices[(currentPosition + 1) % teamIndices.length];
}

function firstLivingIndex(team) {
  return state.players.findIndex((alien) => alien.team === team && alien.alive);
}

function getCurrentAlien() {
  return state.players[state.activeIndex];
}

function canControlCurrentAlien() {
  const actor = getCurrentAlien();
  if (!actor || !actor.alive || state.matchOver || state.projectiles.length) return false;
  if (state.mode === "ai" && actor.team === "enemy") return false;
  return true;
}

function pickNearestTarget(actor) {
  const enemies = state.players.filter((alien) => alien.team !== actor.team && alien.alive);
  if (!enemies.length) return null;
  return enemies.reduce((best, alien) => {
    if (!best) return alien;
    return Math.abs(alien.x - actor.x) < Math.abs(best.x - actor.x) ? alien : best;
  }, null);
}

function fireProjectile(actor, powerPercent, loftBias = 5.2) {
  const speed = 2.2 + (powerPercent / POWER_MAX) * 6.8;
  state.projectiles.push({
    ownerId: actor.id,
    x: actor.x + actor.facing * 18,
    y: actor.y - 10,
    vx: actor.facing * speed,
    vy: -loftBias,
    radius: 5
  });
  setOverlay(`${actor.name} fired with ${Math.round(powerPercent)}% power.`);
}

function checkWinCondition() {
  if (state.matchOver || !state.players.length) return;

  const playerAlive = state.players.some((alien) => alien.team === "player" && alien.alive);
  const enemyAlive = state.players.some((alien) => alien.team === "enemy" && alien.alive);
  if (playerAlive && enemyAlive) return;

  state.matchOver = true;
  const winner = playerAlive ? "player" : "enemy";
  if (state.profile) {
    if (winner === "player") {
      state.profile.stats.wins += 1;
    } else {
      state.profile.stats.losses += 1;
    }
    persistProfile();
  }
  saveMatch(false, true);
  setOverlay(winner === "player" ? "Victory! Your alien squad won the battle." : "Defeat. The opposing squad held the field.");
}

function render() {
  drawScenarioBackdrop();
  if (state.players.length) {
    drawTerrain();
    drawDecor();
    drawAliens();
    drawProjectiles();
    drawParticles();
  }
  dom.overlayMessage.textContent = state.overlay;
}

function renderIdleBackground() {
  drawScenarioBackdrop();
  dom.overlayMessage.textContent = state.overlay;
}

function drawScenarioBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, state.scenario.skyTop);
  gradient.addColorStop(1, state.scenario.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (state.scenario.decor === "space") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 85; i += 1) {
      const x = (i * 149) % WIDTH;
      const y = (i * 71) % Math.floor(HEIGHT * 0.62);
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function drawTerrain() {
  ctx.fillStyle = state.scenario.soil;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x < WIDTH; x += 1) {
    ctx.lineTo(x, state.terrain[x] || HEIGHT);
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = state.scenario.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x < WIDTH; x += 10) {
    const y = state.terrain[x] || HEIGHT;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawDecor() {
  switch (state.scenario.decor) {
    case "forest":
      drawForestDecor();
      break;
    case "city":
      drawCityDecor();
      break;
    case "lake":
      drawLakeDecor();
      break;
    case "space":
      drawSpaceDecor();
      break;
    default:
      break;
  }
}

function drawForestDecor() {
  for (let i = 0; i < 6; i += 1) {
    const x = 90 + i * 165;
    const y = state.terrain[x];
    ctx.fillStyle = "#4b2f1f";
    ctx.fillRect(x - 7, y - 52, 14, 52);
    ctx.fillStyle = "rgba(139, 244, 116, 0.8)";
    ctx.beginPath();
    ctx.arc(x, y - 62, 28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCityDecor() {
  for (let i = 0; i < 7; i += 1) {
    const x = 50 + i * 145;
    const base = HEIGHT - 130 - (i % 3) * 30;
    ctx.fillStyle = "rgba(10, 16, 35, 0.46)";
    ctx.fillRect(x, base, 60, 170);
    ctx.fillStyle = "rgba(255, 209, 102, 0.5)";
    for (let y = base + 18; y < HEIGHT - 14; y += 28) {
      ctx.fillRect(x + 12, y, 9, 10);
      ctx.fillRect(x + 34, y, 9, 10);
    }
  }
}

function drawLakeDecor() {
  ctx.fillStyle = "rgba(120, 230, 255, 0.38)";
  ctx.fillRect(0, HEIGHT - 88, WIDTH, 88);
  for (let i = 0; i < 5; i += 1) {
    const x = 120 + i * 200;
    const y = state.terrain[x];
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(x, y - 34);
    ctx.lineTo(x - 18, y);
    ctx.lineTo(x + 18, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSpaceDecor() {
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(900, 110, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(900, 110, 86, 0.3, Math.PI * 1.7);
  ctx.stroke();
}

function drawAliens() {
  const activeAlien = getCurrentAlien();
  for (const alien of state.players) {
    if (!alien.alive) continue;
    const active = activeAlien && alien.id === activeAlien.id && !state.matchOver;
    ctx.save();
    ctx.translate(alien.x, alien.y);

    if (active) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, alien.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = alien.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, alien.radius, alien.radius + 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#122033";
    ctx.beginPath();
    ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#122033";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -alien.radius - 2);
    ctx.lineTo(alien.facing * 10, -alien.radius - 12);
    ctx.stroke();

    ctx.restore();
    drawHealthBar(alien);
  }
}

function drawHealthBar(alien) {
  const width = 34;
  const x = alien.x - width / 2;
  const y = alien.y - 28;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x, y, width, 6);
  ctx.fillStyle = alien.health > 50 ? "#71f59a" : alien.health > 20 ? "#ffd166" : "#ff6b6b";
  ctx.fillRect(x, y, width * (alien.health / 100), 6);
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    ctx.fillStyle = "#fff1a1";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 28);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
    ctx.globalAlpha = 1;
  }
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (["a", "d", "w", "s", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === "a") keys.a = true;
  if (key === "d") keys.d = true;
  if (key === "w") keys.w = true;
  if (key === "s") keys.s = true;

  if (key === " " && canControlCurrentAlien() && !state.charging) {
    keys.space = true;
    state.charging = true;
    state.chargePower = 0;
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key === "a") keys.a = false;
  if (key === "d") keys.d = false;
  if (key === "w") keys.w = false;
  if (key === "s") keys.s = false;

  if (key === " " && state.charging && canControlCurrentAlien()) {
    keys.space = false;
    const actor = getCurrentAlien();
    fireProjectile(actor, Math.max(18, state.chargePower), 5.6);
    state.charging = false;
    state.chargePower = 0;
  }
}

function updateHUD() {
  if (state.charging) {
    state.chargePower = Math.min(POWER_MAX, state.chargePower + 1.2);
  }
  const actor = getCurrentAlien();
  dom.hudTurn.textContent = actor ? `${actor.name} (${actor.team})` : "Waiting";
  dom.hudTimer.textContent = Math.max(0, Math.ceil(state.turnTimeLeft)).toString();
  dom.hudPower.textContent = `${Math.round(state.chargePower)}%`;
  dom.hudWind.textContent = state.wind.toFixed(2);
  dom.hudProfile.textContent = state.profile?.username || "Guest";
}

function generateTerrain(scenario) {
  const terrain = new Uint8Array(WIDTH);
  for (let x = 0; x < WIDTH; x += 1) {
    let base = HEIGHT * 0.7;
    if (scenario.id === "forest") {
      base = 400 + Math.sin(x * 0.015) * 42 + Math.sin(x * 0.043) * 18;
    } else if (scenario.id === "city") {
      base = 430 + Math.sin(x * 0.01) * 20;
      if ((x > 220 && x < 340) || (x > 720 && x < 810)) base -= 72;
      if (x > 490 && x < 590) base -= 50;
    } else if (scenario.id === "lake") {
      base = 420 + Math.sin(x * 0.02) * 36;
      if (x > 410 && x < 650) base += 55;
    } else if (scenario.id === "space") {
      base = 390 + Math.sin(x * 0.019) * 30 + Math.sin(x * 0.061) * 26;
      if (x > 300 && x < 390) base += 110;
      if (x > 760 && x < 850) base += 90;
    }
    terrain[x] = clamp(Math.round(base), 220, HEIGHT - 55);
  }
  return terrain;
}

function getGroundY(x) {
  return state.terrain[Math.round(clamp(x, 0, WIDTH - 1))] || HEIGHT;
}

function isTerrainAt(x, y) {
  const column = state.terrain[Math.round(clamp(x, 0, WIDTH - 1))];
  return y >= column;
}

function isGrounded(alien) {
  return alien.y >= getGroundY(alien.x) - alien.radius - 0.5;
}

function setOverlay(message) {
  state.overlay = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
