const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const SESSION_KEY = "alien-artillery-session";
const TEAM_SIZE = 4;
const TURN_TIME = 24;
const GRAVITY = 0.24;
const EXPLOSION_RADIUS = 36;
const POWER_MAX = 100;
const BASE_LOFT = 5.9;
const MIN_WORLD_WIDTH = 960;
const MIN_WORLD_HEIGHT = 540;
const ONLINE_SYNC_INTERVAL = 120;
const FALL_DAMAGE_THRESHOLD = 2.45;

const dom = {
  loginScreen: document.getElementById("loginScreen"),
  setupScreen: document.getElementById("setupScreen"),
  gameScreen: document.getElementById("gameScreen"),
  authFormPanel: document.getElementById("authFormPanel"),
  signedInPanel: document.getElementById("signedInPanel"),
  signedInSummary: document.getElementById("signedInSummary"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  continueSessionBtn: document.getElementById("continueSessionBtn"),
  openGameOptionsBtn: document.getElementById("openGameOptionsBtn"),
  openEditBtn: document.getElementById("openEditBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  backToLoginBtn: document.getElementById("backToLoginBtn"),
  profileStatus: document.getElementById("profileStatus"),
  modeSelect: document.getElementById("modeSelect"),
  scenarioSelect: document.getElementById("scenarioSelect"),
  scenarioTitle: document.getElementById("scenarioTitle"),
  scenarioDescription: document.getElementById("scenarioDescription"),
  playerTeamNameInput: document.getElementById("playerTeamNameInput"),
  enemyTeamNameInput: document.getElementById("enemyTeamNameInput"),
  playerColorInput: document.getElementById("playerColorInput"),
  enemyColorInput: document.getElementById("enemyColorInput"),
  playerNameInputs: [...document.querySelectorAll(".player-name-input")],
  enemyNameInputs: [...document.querySelectorAll(".enemy-name-input")],
  playerSkinInputs: [...document.querySelectorAll(".player-skin-input")],
  newGameBtn: document.getElementById("newGameBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  editProfileBtn: document.getElementById("editProfileBtn"),
  saveBtn: document.getElementById("saveBtn"),
  skipBtn: document.getElementById("skipBtn"),
  setupBtn: document.getElementById("setupBtn"),
  roomNameInput: document.getElementById("roomNameInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  refreshRoomsBtn: document.getElementById("refreshRoomsBtn"),
  onlinePanel: document.getElementById("onlinePanel"),
  onlineStatus: document.getElementById("onlineStatus"),
  roomList: document.getElementById("roomList"),
  hudProfile: document.getElementById("hudProfile"),
  hudTurn: document.getElementById("hudTurn"),
  hudTimer: document.getElementById("hudTimer"),
  hudWind: document.getElementById("hudWind"),
  hudRoom: document.getElementById("hudRoom"),
  powerFill: document.getElementById("powerFill"),
  overlayMessage: document.getElementById("overlayMessage")
};

const scenarios = [
  { id: "forest", name: "Forest Frontier", description: "A glowing woodland ridge with forgiving slopes and soft cover. Craters stay open after every blast, so the field only gets rougher.", skyTop: "#16361a", skyBottom: "#4f9153", soil: "#5a3b25", accent: "#9ff07f", decor: "forest" },
  { id: "city", name: "Neon City Siege", description: "A shattered skyline with long sight lines, thin ledges, and dangerous drops. Fall damage becomes a real threat after the first crater opens.", skyTop: "#0c1631", skyBottom: "#5b5caa", soil: "#4a4d5b", accent: "#ffd166", decor: "city" },
  { id: "lake", name: "Crystal Lake Basin", description: "Wet ground and bowl-shaped cliffs make knockback and sliding more dramatic. Once terrain is gone, nobody can rebuild it.", skyTop: "#09314a", skyBottom: "#2ea8c4", soil: "#4c3b2b", accent: "#8ef1ff", decor: "lake" },
  { id: "space", name: "Orbital Dust Ring", description: "Jagged asteroid shelves leave big gaps and dramatic arcs. One clean hit can turn safe footing into a fatal fall.", skyTop: "#040611", skyBottom: "#1c2458", soil: "#6e6c84", accent: "#f4a6ff", decor: "space" }
];

const skinLibrary = {
  comet: { tint: 0.08, cheek: "#ffc1d7", tuft: "#fff0a8" },
  moss: { tint: -0.04, cheek: "#d1ffd6", tuft: "#baf58a" },
  coral: { tint: 0.14, cheek: "#ffd0a8", tuft: "#ff9f7e" },
  frost: { tint: 0.22, cheek: "#d6ecff", tuft: "#bde8ff" }
};

const defaultTeamConfig = {
  playerTeamName: "Star Puffs",
  enemyTeamName: "Nebula Floofs",
  playerColor: "#7ef3b8",
  enemyColor: "#ff9fb4",
  playerNames: ["Momo", "Bibi", "Lulu", "Nori"],
  enemyNames: ["Fizz", "Puff", "Tiki", "Zuzu"],
  playerSkins: ["comet", "moss", "coral", "frost"]
};

const state = {
  profile: null,
  scenario: scenarios[0],
  mode: "ai",
  terrain: new Uint16Array(MIN_WORLD_WIDTH),
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
  currentMatchId: null,
  lastTimestamp: 0,
  aiThinking: 0,
  worldWidth: MIN_WORLD_WIDTH,
  worldHeight: MIN_WORLD_HEIGHT,
  turnEnding: false,
  pendingTurnMessage: "",
  screen: "login",
  gameStarted: false,
  teamConfig: structuredClone(defaultTeamConfig),
  audioContext: null,
  audioUnlocked: false,
  socket: null,
  rooms: [],
  online: { roomId: null, roomName: "", players: [], roleTeam: "player", countdown: null, dirty: false, lastSyncAt: 0, applyingRemoteState: false }
};

const keys = { a: false, d: false, w: false, s: false, space: false };

setupUI();
resizeCanvas();
requestAnimationFrame(gameLoop);
restoreSession();

function setupUI() {
  scenarios.forEach((scenario) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    dom.scenarioSelect.appendChild(option);
  });
  dom.scenarioSelect.value = scenarios[0].id;
  applyTeamConfigToForm(state.teamConfig);
  updateScenarioCard();
  updateModeUI();
  updateSignedInUI();
  updateHUD();
  showScreen("login");

  dom.loginBtn.addEventListener("click", () => { unlockAudio(); loginProfile(); });
  dom.continueSessionBtn.addEventListener("click", () => { unlockAudio(); restoreSession(true); });
  dom.openGameOptionsBtn.addEventListener("click", () => openSetup("game"));
  dom.openEditBtn.addEventListener("click", () => openSetup("edit"));
  dom.logoutBtn.addEventListener("click", logoutProfile);
  dom.backToLoginBtn.addEventListener("click", () => showScreen("login"));
  dom.editProfileBtn.addEventListener("click", () => openSetup("edit"));
  dom.newGameBtn.addEventListener("click", () => { unlockAudio(); startNewGame(); });
  dom.resumeBtn.addEventListener("click", () => { unlockAudio(); resumeSavedMatch(); });
  dom.saveBtn.addEventListener("click", () => saveMatch(true, false));
  dom.skipBtn.addEventListener("click", () => { if (canControlCurrentAlien()) requestTurnAdvance("Turn skipped."); });
  dom.setupBtn.addEventListener("click", () => { if (state.profile) openSetup("game"); });
  dom.scenarioSelect.addEventListener("change", updateScenarioCard);
  dom.modeSelect.addEventListener("change", updateModeUI);
  dom.createRoomBtn.addEventListener("click", createRoom);
  dom.refreshRoomsBtn.addEventListener("click", refreshRooms);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
}

async function restoreSession(showErrors = false) {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return;
  try {
    const { profile } = await apiFetch(`/api/profile/${encodeURIComponent(username)}`);
    state.profile = profile;
    state.teamConfig = normalizeTeamConfig(profile.preferences);
    applyTeamConfigToForm(state.teamConfig);
    dom.hudProfile.textContent = profile.username;
    dom.profileStatus.textContent = `Session restored for ${profile.username}.`;
    updateSignedInUI();
    ensureSocket();
    refreshRooms();
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    if (showErrors) setOverlay(error.message || "Could not restore session.");
  }
}

function updateSignedInUI() {
  const signedIn = Boolean(state.profile);
  dom.authFormPanel.classList.toggle("hidden", signedIn);
  dom.signedInPanel.classList.toggle("hidden", !signedIn);
  if (signedIn) dom.signedInSummary.textContent = `${state.profile.username} is signed in. Open the game options or edit your squad.`;
}

function showScreen(screen) {
  state.screen = screen;
  dom.loginScreen.classList.toggle("screen-active", screen === "login");
  dom.setupScreen.classList.toggle("screen-active", screen === "setup");
  dom.gameScreen.classList.toggle("screen-active", screen === "game");
}

function openSetup(reason) {
  if (!state.profile) {
    setOverlay("Sign in before opening game options.");
    return;
  }
  populateFormFromCurrentState();
  showScreen("setup");
  setOverlay(reason === "edit" ? "Edit names, colors, and skins here. Changes save to your commander profile." : "Adjust names, colors, skins, mode, or scenario, then start or resume a match.");
}

function updateScenarioCard() {
  const selected = scenarios.find((scenario) => scenario.id === dom.scenarioSelect.value) || scenarios[0];
  state.scenario = selected;
  dom.scenarioTitle.textContent = selected.name;
  dom.scenarioDescription.textContent = selected.description;
}

function updateModeUI() {
  const onlineMode = dom.modeSelect.value === "online";
  dom.onlinePanel.classList.toggle("hidden", !onlineMode);
  if (onlineMode) dom.onlineStatus.textContent = state.profile ? "Create a room or join one below. The match starts 10 seconds after the second player joins." : "Sign in to create or join an online room.";
}

async function loginProfile() {
  const username = dom.usernameInput.value.trim();
  const password = dom.passwordInput.value.trim();
  if (!username || !password) {
    setOverlay("Enter both a profile name and password.");
    return;
  }
  try {
    const { profile } = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    state.profile = profile;
    state.teamConfig = normalizeTeamConfig(profile.preferences);
    applyTeamConfigToForm(state.teamConfig);
    dom.profileStatus.textContent = `Profile ready: ${profile.username}`;
    dom.hudProfile.textContent = profile.username;
    dom.passwordInput.value = "";
    localStorage.setItem(SESSION_KEY, profile.username);
    updateSignedInUI();
    ensureSocket();
    refreshRooms();
    showScreen("login");
    setOverlay(`Profile ${profile.username} loaded. Open Game Options to start playing.`);
  } catch (error) {
    setOverlay(error.message || "Could not sign in.");
  }
}

function logoutProfile() {
  leaveCurrentRoom();
  state.profile = null;
  state.teamConfig = structuredClone(defaultTeamConfig);
  applyTeamConfigToForm(state.teamConfig);
  localStorage.removeItem(SESSION_KEY);
  updateSignedInUI();
  dom.profileStatus.textContent = "No profile loaded.";
  dom.hudProfile.textContent = "Guest";
  dom.passwordInput.value = "";
  dom.hudRoom.textContent = "Offline";
  setOverlay("Signed out.");
}

function ensureSocket() {
  if (state.socket || typeof io === "undefined" || !state.profile) return;
  state.socket = io();
  state.socket.emit("player:register", { username: state.profile.username });

  state.socket.on("room:list", (rooms) => { state.rooms = rooms; renderRooms(); });
  state.socket.on("room:update", (room) => {
    if (!state.online.roomId && state.profile && room.owner === state.profile.username && room.roomName === state.online.roomName) {
      state.online.roomId = room.roomId;
    }
    const i = state.rooms.findIndex((entry) => entry.roomId === room.roomId);
    if (i === -1) state.rooms.unshift(room); else state.rooms[i] = room;
    if (state.online.roomId === room.roomId) {
      state.online.players = room.players || [];
      state.online.roomName = room.roomName;
      state.online.roleTeam = getTeamForUsername(state.profile.username, room.players);
      dom.onlineStatus.textContent = `Room ${room.roomName} has ${room.players.length}/2 players.`;
    }
    renderRooms();
  });
  state.socket.on("room:countdown", ({ roomId, secondsLeft }) => {
    if (state.online.roomId !== roomId) return;
    state.online.countdown = secondsLeft;
    playSound("beep");
    setOverlay(secondsLeft > 0 ? `Room ready. Match starts in ${secondsLeft} seconds.` : "Match starting now.");
  });
  state.socket.on("room:start", ({ roomId, players }) => {
    if (state.online.roomId !== roomId) return;
    state.online.players = players;
    state.online.roleTeam = getTeamForUsername(state.profile.username, players);
    initializeOnlineMatch(players);
  });
  state.socket.on("game:state", (snapshot) => {
    if (!snapshot || state.online.applyingRemoteState) return;
    state.online.applyingRemoteState = true;
    applySnapshot(snapshot, true);
    state.online.applyingRemoteState = false;
  });
  state.socket.on("room:error", ({ message }) => setOverlay(message || "Room action failed."));
}

async function refreshRooms() {
  try {
    const { rooms } = await apiFetch("/api/rooms");
    state.rooms = rooms;
    renderRooms();
  } catch (error) {
    dom.onlineStatus.textContent = error.message || "Could not load rooms.";
  }
}

async function createRoom() {
  if (!state.profile) {
    setOverlay("Sign in first.");
    return;
  }
  syncTeamConfigFromForm();
  await persistProfile();
  ensureSocket();
  const roomName = dom.roomNameInput.value.trim() || `${state.profile.username}'s Room`;
  state.online.roomName = roomName;
  state.online.roleTeam = "player";
  state.socket.emit("room:create", { roomName, owner: state.profile.username, scenarioId: dom.scenarioSelect.value });
  dom.onlineStatus.textContent = `Room ${roomName} created. Waiting for another player.`;
  setOverlay("Online room created. Share it with a second player.");
}

function renderRooms() {
  dom.roomList.innerHTML = "";
  if (!state.rooms.length) {
    dom.roomList.innerHTML = '<div class="room-card"><p>No open rooms yet. Create one to start online multiplayer.</p></div>';
    return;
  }
  state.rooms.forEach((room) => {
    const joined = state.online.roomId === room.roomId;
    const card = document.createElement("article");
    card.className = "room-card";
    card.innerHTML = `
      <h4>${escapeHtml(room.roomName)}</h4>
      <p>Owner: ${escapeHtml(room.owner)}</p>
      <p>Players: ${room.players.length}/2</p>
      <p>Status: ${escapeHtml(room.status)}</p>
      <div class="actions">
        <button class="primary" data-room-join="${room.roomId}" ${room.players.length >= 2 || joined ? "disabled" : ""}>Join Room</button>
        ${joined ? `<button data-room-leave="${room.roomId}">Leave Room</button>` : ""}
      </div>`;
    dom.roomList.appendChild(card);
  });
  dom.roomList.querySelectorAll("[data-room-join]").forEach((button) => button.addEventListener("click", () => joinRoom(button.dataset.roomJoin)));
  dom.roomList.querySelectorAll("[data-room-leave]").forEach((button) => button.addEventListener("click", () => leaveCurrentRoom(button.dataset.roomLeave)));
}

function joinRoom(roomId) {
  if (!state.profile) {
    setOverlay("Sign in first.");
    return;
  }
  ensureSocket();
  state.online.roomId = roomId;
  state.socket.emit("room:join", { roomId, username: state.profile.username });
  dom.onlineStatus.textContent = "Joined room. Waiting for the countdown.";
}

function leaveCurrentRoom(roomId = state.online.roomId) {
  if (!state.socket || !roomId || !state.profile) return;
  state.socket.emit("room:leave", { roomId, username: state.profile.username });
  state.online.roomId = null;
  state.online.roomName = "";
  state.online.players = [];
  state.online.countdown = null;
  dom.onlineStatus.textContent = "Left the room.";
  renderRooms();
}
async function startNewGame() {
  if (!state.profile) {
    setOverlay("Login with a profile before starting a match.");
    return;
  }
  syncTeamConfigFromForm();
  await persistProfile();
  state.mode = dom.modeSelect.value;
  state.scenario = scenarios.find((scenario) => scenario.id === dom.scenarioSelect.value) || scenarios[0];
  if (state.mode === "online") {
    if (!state.online.roomId) {
      setOverlay("Create or join an online room first.");
      return;
    }
    setOverlay("Online room ready. The match begins automatically after both players join and the countdown finishes.");
    return;
  }
  initializeMatch(false);
}

function initializeOnlineMatch(players) {
  syncTeamConfigFromForm();
  state.mode = "online";
  state.online.players = players;
  state.online.roleTeam = getTeamForUsername(state.profile.username, players);
  initializeMatch(true);
  setOverlay(`Online match live. You control the ${state.online.roleTeam} squad.`);
  syncOnlineState();
}

function initializeMatch(online) {
  state.currentMatchId = `${online ? state.online.roomId : state.profile.username.toLowerCase()}-${Date.now()}`;
  state.terrain = generateTerrain(state.scenario, state.worldWidth, state.worldHeight);
  state.players = spawnTeams();
  state.projectiles = [];
  state.particles = [];
  state.activeTeam = "player";
  state.activeIndex = firstLivingIndex("player");
  state.turnTimeLeft = TURN_TIME;
  state.wind = randomRange(-0.05, 0.05);
  state.charging = false;
  state.chargePower = 0;
  state.matchOver = false;
  state.aiThinking = 0;
  state.turnEnding = false;
  state.pendingTurnMessage = "";
  state.gameStarted = true;
  settlePlayers();
  showScreen("game");
  setOverlay(state.overlay.includes("Online") ? state.overlay : `${state.scenario.name} ready. ${getCurrentAlien()?.name || "Pilot"} begins.`);
  markStateDirty();
  saveMatch(false, true);
}

async function resumeSavedMatch() {
  if (!state.profile) {
    setOverlay("Login with a profile before resuming a match.");
    return;
  }
  try {
    const { gameState } = await apiFetch(`/api/gamestate/${encodeURIComponent(state.profile.username)}`);
    applySnapshot(gameState);
    showScreen("game");
    setOverlay(`Resumed saved match for ${state.profile.username}.`);
    updateHUD();
  } catch (error) {
    setOverlay(error.message || "No saved match found for this profile.");
  }
}

async function saveMatch(manual = false, silent = false) {
  if (!state.profile || !state.players.length) {
    if (!silent) setOverlay("There is no active match to save yet.");
    return;
  }
  const payload = buildSnapshot();
  if (manual) state.profile.stats.savedMatches += 1;
  try {
    await Promise.all([
      apiFetch(`/api/gamestate/${encodeURIComponent(state.profile.username)}`, { method: "PUT", body: JSON.stringify({ gameState: payload }) }),
      persistProfile()
    ]);
    if (state.mode === "online" && state.online.roomId) syncOnlineState();
    if (!silent) setOverlay("Match saved to MongoDB.");
  } catch (error) {
    if (!silent) setOverlay(error.message || "Failed to save match.");
  }
}

async function persistProfile() {
  if (!state.profile) return;
  state.profile.preferences = structuredClone(state.teamConfig);
  const { profile } = await apiFetch(`/api/profile/${encodeURIComponent(state.profile.username)}/preferences`, {
    method: "PUT",
    body: JSON.stringify({ preferences: state.profile.preferences, stats: state.profile.stats })
  });
  state.profile = profile;
}

function buildSnapshot() {
  return {
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
    teamConfig: state.teamConfig,
    worldWidth: state.worldWidth,
    worldHeight: state.worldHeight,
    roomId: state.online.roomId,
    roomName: state.online.roomName,
    onlinePlayers: state.online.players,
    savedAt: new Date().toISOString()
  };
}

function applySnapshot(match, fromRemote = false) {
  state.mode = match.mode || "ai";
  state.scenario = scenarios.find((scenario) => scenario.id === match.scenarioId) || scenarios[0];
  state.currentMatchId = match.matchId;
  state.turnTimeLeft = match.turnTimeLeft ?? TURN_TIME;
  state.wind = match.wind ?? 0;
  state.matchOver = Boolean(match.matchOver);
  state.activeIndex = match.activeIndex ?? 0;
  state.activeTeam = match.activeTeam || "player";
  state.chargePower = 0;
  state.charging = false;
  state.aiThinking = 0;
  state.turnEnding = false;
  state.pendingTurnMessage = "";
  state.teamConfig = normalizeTeamConfig(match.teamConfig || state.profile?.preferences || {});
  applyTeamConfigToForm(state.teamConfig);
  dom.modeSelect.value = state.mode;
  dom.scenarioSelect.value = state.scenario.id;
  updateScenarioCard();
  updateModeUI();
  state.terrain = restoreTerrain(match.terrain);
  state.players = (match.players || []).map((alien) => restoreAlien(alien));
  state.projectiles = (match.projectiles || []).map((projectile) => ({ ...projectile }));
  adaptWorldToCanvas(match.worldWidth || state.worldWidth, match.worldHeight || state.worldHeight);
  state.gameStarted = true;
  if (state.mode === "online") {
    state.online.roomId = match.roomId || state.online.roomId;
    state.online.roomName = match.roomName || state.online.roomName;
    state.online.players = match.onlinePlayers || state.online.players;
    state.online.roleTeam = getTeamForUsername(state.profile?.username, state.online.players);
  }
  if (!fromRemote) markStateDirty();
}

function getTeamForUsername(username, players = state.online.players) {
  const index = (players || []).findIndex((player) => player.username === username);
  return index <= 0 ? "player" : "enemy";
}

function gameLoop(timestamp) {
  const dt = Math.min(32, timestamp - (state.lastTimestamp || timestamp));
  state.lastTimestamp = timestamp;
  update(dt / 16.6667);
  render();
  requestAnimationFrame(gameLoop);
}

function update(step) {
  if (!state.players.length) {
    renderIdleBackground();
    return;
  }
  if (!state.matchOver && !state.turnEnding && !state.projectiles.length) {
    state.turnTimeLeft -= step / 60;
    if (state.turnTimeLeft <= 0) requestTurnAdvance("Turn timer expired.");
  }
  if (state.charging) state.chargePower = Math.min(POWER_MAX, state.chargePower + 1.35);
  updateCurrentActor(step);
  updateProjectiles(step);
  updateParticles(step);
  settlePlayers();
  checkWinCondition();
  if (!state.matchOver && state.turnEnding && !state.projectiles.length && everyoneStable()) advanceTurn();
  syncOnlineStateIfNeeded();
  updateHUD();
}

function spawnTeams() {
  const lineup = [];
  const playerSlots = laneSlots("player");
  const enemySlots = laneSlots("enemy");
  const playerPalette = buildPalette(state.teamConfig.playerColor);
  const enemyPalette = buildPalette(state.teamConfig.enemyColor);
  for (let i = 0; i < TEAM_SIZE; i += 1) {
    lineup.push(makeAlien("player", i, playerSlots[i], playerPalette[i], state.teamConfig.playerNames[i], state.teamConfig.playerSkins[i]));
  }
  for (let i = 0; i < TEAM_SIZE; i += 1) {
    lineup.push(makeAlien("enemy", i, enemySlots[i], enemyPalette[i], state.teamConfig.enemyNames[i], defaultTeamConfig.playerSkins[i]));
  }
  return lineup;
}

function laneSlots(team) {
  const ratios = team === "player" ? [0.12, 0.2, 0.28, 0.36] : [0.64, 0.72, 0.8, 0.88];
  return ratios.map((ratio) => Math.round(state.worldWidth * ratio));
}

function makeAlien(team, index, x, color, name, skinId) {
  const randomFaces = ["smile", "frown", "crazy", "wink"];
  const accessories = ["tie", "ribbon", "hat"];
  return {
    id: `${team}-${index}`,
    name: name?.trim() || `${team === "player" ? "Pilot" : "Raider"} ${index + 1}`,
    team,
    teamName: team === "player" ? state.teamConfig.playerTeamName : state.teamConfig.enemyTeamName,
    x,
    y: getGroundY(x) - 16,
    vy: 0,
    radius: 16,
    health: 100,
    alive: true,
    color,
    baseColor: team === "player" ? state.teamConfig.playerColor : state.teamConfig.enemyColor,
    skinId: skinId || defaultTeamConfig.playerSkins[index],
    faceStyle: index === 0 ? "angry" : index === 1 ? "happy" : index === 2 ? "crazy" : randomFaces[Math.floor(Math.random() * randomFaces.length)],
    accessory: index === 3 ? accessories[Math.floor(Math.random() * accessories.length)] : null,
    facing: team === "player" ? 1 : -1,
    jumpReady: true,
    aiPlan: null,
    airborne: false,
    fallStartY: 0,
    walkCycle: 0,
    slotIndex: index
  };
}

function restoreAlien(alien) {
  return {
    ...alien,
    jumpReady: alien.jumpReady ?? true,
    aiPlan: null,
    airborne: false,
    fallStartY: alien.fallStartY ?? alien.y,
    walkCycle: alien.walkCycle ?? 0,
    skinId: alien.skinId || defaultTeamConfig.playerSkins[alien.slotIndex || 0],
    faceStyle: alien.faceStyle || "happy",
    accessory: alien.accessory ?? null
  };
}

function updateCurrentActor(step) {
  const actor = getCurrentAlien();
  if (!actor || !actor.alive || state.matchOver || state.projectiles.length || state.turnEnding) return;
  if (state.mode === "ai" && actor.team === "enemy") {
    handleAI(actor, step);
    markStateDirty();
    return;
  }
  if (!canControlCurrentAlien()) return;
  const moveSpeed = 1.9 * step;
  let moved = false;
  if (keys.a) { actor.x -= moveSpeed; actor.facing = -1; moved = true; }
  if (keys.d) { actor.x += moveSpeed; actor.facing = 1; moved = true; }
  actor.x = clamp(actor.x, actor.radius, state.worldWidth - actor.radius);
  if (moved && isGrounded(actor)) { actor.walkCycle += 0.2 * step; markStateDirty(); }
  if (keys.w && actor.jumpReady && isGrounded(actor)) {
    actor.vy = -6.2;
    actor.jumpReady = false;
    actor.airborne = true;
    actor.fallStartY = actor.y;
    markStateDirty();
  }
  if (!keys.w && isGrounded(actor)) actor.jumpReady = true;
  if (keys.s && !isGrounded(actor)) { actor.vy += 0.2 * step; markStateDirty(); }
}

function handleAI(actor, step) {
  state.aiThinking += step;
  if (state.aiThinking < 34) return;
  if (!actor.aiPlan) {
    const target = pickNearestTarget(actor);
    if (!target) return;
    const dx = target.x - actor.x;
    actor.facing = dx >= 0 ? 1 : -1;
    actor.aiPlan = { moveFrames: Math.min(55, Math.floor(Math.abs(dx) * 0.08)), power: clamp(Math.abs(dx) * 0.13 + Math.random() * 10 + 36, 28, 98), loft: clamp(4.9 + Math.abs(dx) * 0.004, 4.9, 7.2) };
  }
  if (actor.aiPlan.moveFrames > 0) {
    actor.x += actor.facing * 1.2 * step;
    actor.x = clamp(actor.x, actor.radius, state.worldWidth - actor.radius);
    actor.walkCycle += 0.16 * step;
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
    markStateDirty();
    if (projectile.x < 0 || projectile.x >= state.worldWidth || projectile.y > state.worldHeight + 50) {
      state.projectiles.splice(i, 1);
      requestTurnAdvance("Shot lost beyond the battlefield.");
      continue;
    }
    if (isTerrainAt(projectile.x, projectile.y)) {
      explode(projectile.x, projectile.y, "land");
      state.projectiles.splice(i, 1);
      requestTurnAdvance("Impact! The terrain stays damaged.");
      continue;
    }
    let hitAlien = false;
    for (const alien of state.players) {
      if (!alien.alive || alien.id === projectile.ownerId) continue;
      const distance = Math.hypot(projectile.x - alien.x, projectile.y - alien.y);
      if (distance <= alien.radius + projectile.radius) {
        explode(projectile.x, projectile.y, "alien");
        state.projectiles.splice(i, 1);
        requestTurnAdvance(`Direct hit on ${alien.name}!`);
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
    if (particle.life <= 0) state.particles.splice(i, 1);
  }
}

function settlePlayers() {
  for (const alien of state.players) {
    if (!alien.alive) continue;
    const wasGrounded = isGrounded(alien);
    if (!wasGrounded && !alien.airborne) {
      alien.airborne = true;
      alien.fallStartY = alien.y;
    }
    alien.vy += GRAVITY;
    alien.y += alien.vy;
    const desiredY = getGroundY(alien.x) - alien.radius;
    if (alien.y >= desiredY) {
      const landingSpeed = alien.vy;
      alien.y = desiredY;
      alien.vy = 0;
      if (alien.airborne) {
        const fallDistance = Math.max(0, desiredY - alien.fallStartY);
        const safeDistance = alien.radius * FALL_DAMAGE_THRESHOLD;
        alien.airborne = false;
        if (fallDistance > safeDistance) {
          const damage = clamp(Math.round((fallDistance - safeDistance) * 0.22), 6, 40);
          applyDamage(alien, damage);
          playSound("fall");
          requestTurnAdvance(`${alien.name} took ${damage} fall damage.`);
          markStateDirty();
        } else if (landingSpeed > 0) {
          alien.jumpReady = true;
        }
      } else {
        alien.jumpReady = true;
      }
    }
    if (alien.y > state.worldHeight + 100) {
      alien.alive = false;
      alien.health = 0;
      markStateDirty();
    }
  }
}

function explode(x, y, impactType) {
  carveTerrain(x, y, EXPLOSION_RADIUS);
  playSound(impactType === "alien" ? "hitAlien" : "hitLand");
  for (const alien of state.players) {
    if (!alien.alive) continue;
    const distance = Math.hypot(alien.x - x, alien.y - y);
    if (distance > EXPLOSION_RADIUS + 40) continue;
    applyDamage(alien, Math.max(10, Math.round(78 - distance * 1.15)));
    const push = Math.max(0.5, (EXPLOSION_RADIUS + 42 - distance) / 16);
    const angle = Math.atan2(alien.y - y, alien.x - x);
    alien.x = clamp(alien.x + Math.cos(angle) * push * 12, alien.radius, state.worldWidth - alien.radius);
    alien.vy = Math.min(alien.vy, -Math.sin(angle) * push * 3.2 - 1.4);
    alien.airborne = true;
    alien.fallStartY = Math.min(alien.fallStartY || alien.y, alien.y);
  }
  for (let i = 0; i < 30; i += 1) {
    state.particles.push({ x, y, vx: randomRange(-3.2, 3.2), vy: randomRange(-4.4, -0.8), life: randomRange(14, 30), color: i % 2 === 0 ? "#ffd68a" : impactType === "alien" ? "#ff7b7b" : "#ff9a5e" });
  }
  markStateDirty();
}

function applyDamage(alien, damage) { alien.health = Math.max(0, alien.health - damage); if (alien.health <= 0) alien.alive = false; }

function carveTerrain(cx, cy, radius) {
  for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(state.worldWidth, Math.ceil(cx + radius)); x += 1) {
    const dx = x - cx;
    const inside = radius * radius - dx * dx;
    if (inside <= 0) continue;
    const newHeight = Math.ceil(cy + Math.sqrt(inside));
    state.terrain[x] = clamp(Math.max(state.terrain[x], newHeight), 0, state.worldHeight);
  }
}

function requestTurnAdvance(message) {
  if (state.matchOver) return;
  state.turnEnding = true;
  state.pendingTurnMessage = message || state.pendingTurnMessage || "Turn complete.";
  state.charging = false;
  keys.space = false;
  state.chargePower = 0;
  markStateDirty();
}

function advanceTurn() {
  if (state.matchOver) return;
  state.turnEnding = false;
  state.projectiles = [];
  state.wind = randomRange(-0.05, 0.05);
  state.turnTimeLeft = TURN_TIME;
  state.aiThinking = 0;
  let nextTeam = state.activeTeam === "player" ? "enemy" : "player";
  let nextIndex = nextLivingIndex(nextTeam);
  if (nextIndex === -1) { nextTeam = state.activeTeam; nextIndex = nextLivingIndex(nextTeam); }
  state.activeTeam = nextTeam;
  state.activeIndex = nextIndex;
  const nextAlien = getCurrentAlien();
  if (nextAlien) nextAlien.aiPlan = null;
  const message = state.pendingTurnMessage || "Turn complete.";
  state.pendingTurnMessage = "";
  setOverlay(nextAlien ? `${message} ${nextAlien.name} is up.` : message);
  markStateDirty();
  saveMatch(false, true);
}

function nextLivingIndex(team) {
  const indices = state.players.map((alien, index) => ({ alien, index })).filter((entry) => entry.alien.team === team && entry.alien.alive).map((entry) => entry.index);
  if (!indices.length) return -1;
  const current = getCurrentAlien();
  if (!current || current.team !== team) return indices[0];
  const position = indices.indexOf(state.activeIndex);
  return indices[position === -1 ? 0 : (position + 1) % indices.length];
}

function firstLivingIndex(team) { return state.players.findIndex((alien) => alien.team === team && alien.alive); }
function getCurrentAlien() { return state.players[state.activeIndex]; }

function canControlCurrentAlien() {
  const actor = getCurrentAlien();
  if (!actor || !actor.alive || state.matchOver || state.projectiles.length || state.turnEnding) return false;
  if (state.mode === "ai" && actor.team === "enemy") return false;
  if (state.mode === "online" && actor.team !== state.online.roleTeam) return false;
  return state.screen === "game";
}

function pickNearestTarget(actor) {
  const enemies = state.players.filter((alien) => alien.team !== actor.team && alien.alive);
  return enemies.reduce((best, alien) => !best || Math.abs(alien.x - actor.x) < Math.abs(best.x - actor.x) ? alien : best, null);
}

function fireProjectile(actor, powerPercent, loftBias = BASE_LOFT) {
  state.projectiles.push({ ownerId: actor.id, x: actor.x + actor.facing * (actor.radius + 8), y: actor.y - actor.radius * 0.4, vx: actor.facing * (2.5 + (powerPercent / POWER_MAX) * 7.2), vy: -loftBias, radius: 5 });
  playSound("shoot");
  setOverlay(`${actor.name} fired with ${Math.round(powerPercent)}% power.`);
  markStateDirty();
}

function checkWinCondition() {
  if (state.matchOver || !state.players.length) return;
  const playerAlive = state.players.some((alien) => alien.team === "player" && alien.alive);
  const enemyAlive = state.players.some((alien) => alien.team === "enemy" && alien.alive);
  if (playerAlive && enemyAlive) return;
  state.matchOver = true;
  state.turnEnding = false;
  const winner = playerAlive ? "player" : "enemy";
  if (state.profile) {
    if (winner === (state.mode === "online" ? state.online.roleTeam : "player")) state.profile.stats.wins += 1; else state.profile.stats.losses += 1;
    persistProfile().catch(() => {});
  }
  saveMatch(false, true);
  setOverlay(winner === "player" ? "Victory! Your fluffy squad won the battle." : "Defeat. The opposing squad held the field.");
  markStateDirty();
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (["a", "d", "w", "s", " "].includes(key)) event.preventDefault();
  unlockAudio();
  if (key === "a") keys.a = true;
  if (key === "d") keys.d = true;
  if (key === "w") keys.w = true;
  if (key === "s") keys.s = true;
  if (key === " " && canControlCurrentAlien() && !state.charging) { keys.space = true; state.charging = true; state.chargePower = 0; }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key === "a") keys.a = false;
  if (key === "d") keys.d = false;
  if (key === "w") keys.w = false;
  if (key === "s") keys.s = false;
  if (key === " " && state.charging && canControlCurrentAlien()) {
    keys.space = false;
    fireProjectile(getCurrentAlien(), Math.max(18, state.chargePower), BASE_LOFT);
    state.charging = false;
    state.chargePower = 0;
  }
}

function syncOnlineStateIfNeeded() {
  if (state.mode !== "online" || !state.online.roomId || !state.socket || state.online.applyingRemoteState) return;
  const now = performance.now();
  if (!state.online.dirty || now - state.online.lastSyncAt < ONLINE_SYNC_INTERVAL) return;
  syncOnlineState();
}

function syncOnlineState() {
  if (state.mode !== "online" || !state.online.roomId || !state.socket) return;
  state.online.lastSyncAt = performance.now();
  state.online.dirty = false;
  state.socket.emit("game:sync", { roomId: state.online.roomId, snapshot: buildSnapshot() });
}

function markStateDirty() { if (state.mode === "online") state.online.dirty = true; }
function render() {
  drawScenarioBackdrop();
  if (state.players.length) {
    drawDecor();
    drawTerrain();
    drawTrajectory();
    drawAliens();
    drawProjectiles();
    drawParticles();
  }
  dom.overlayMessage.textContent = state.overlay;
}

function renderIdleBackground() { drawScenarioBackdrop(); dom.overlayMessage.textContent = state.overlay; }

function drawScenarioBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.worldHeight);
  gradient.addColorStop(0, state.scenario.skyTop);
  gradient.addColorStop(1, state.scenario.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.worldWidth, state.worldHeight);
  if (state.scenario.decor === "space") {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let i = 0; i < 120; i += 1) ctx.fillRect((i * 149) % state.worldWidth, (i * 71) % Math.floor(state.worldHeight * 0.62), 2, 2);
  }
}

function drawTerrain() {
  ctx.fillStyle = state.scenario.soil;
  ctx.beginPath();
  ctx.moveTo(0, state.worldHeight);
  for (let x = 0; x < state.worldWidth; x += 1) ctx.lineTo(x, state.terrain[x] || state.worldHeight);
  ctx.lineTo(state.worldWidth, state.worldHeight);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = state.scenario.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x < state.worldWidth; x += 8) {
    const y = state.terrain[x] || state.worldHeight;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawDecor() {
  if (state.scenario.decor === "forest") drawForestDecor();
  if (state.scenario.decor === "city") drawCityDecor();
  if (state.scenario.decor === "lake") drawLakeDecor();
  if (state.scenario.decor === "space") drawSpaceDecor();
}

function drawForestDecor() {
  const spacing = state.worldWidth / 6.5;
  for (let i = 0; i < 6; i += 1) {
    const x = Math.round(spacing * (i + 0.7));
    const y = state.terrain[x];
    ctx.fillStyle = "#4b2f1f";
    ctx.fillRect(x - 8, y - 56, 16, 56);
    ctx.fillStyle = "rgba(139, 244, 116, 0.72)";
    ctx.beginPath();
    ctx.arc(x, y - 64, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCityDecor() {
  const spacing = state.worldWidth / 7.5;
  for (let i = 0; i < 7; i += 1) {
    const x = 30 + i * spacing;
    const base = state.worldHeight - 150 - (i % 3) * 34;
    ctx.fillStyle = "rgba(10, 16, 35, 0.44)";
    ctx.fillRect(x, base, 60, 190);
    ctx.fillStyle = "rgba(255, 209, 102, 0.44)";
    for (let y = base + 18; y < state.worldHeight - 20; y += 28) {
      ctx.fillRect(x + 12, y, 9, 10);
      ctx.fillRect(x + 36, y, 9, 10);
    }
  }
}

function drawLakeDecor() {
  ctx.fillStyle = "rgba(120, 230, 255, 0.3)";
  ctx.fillRect(0, state.worldHeight - 94, state.worldWidth, 94);
  for (let i = 0; i < 5; i += 1) {
    const x = Math.round(state.worldWidth * (0.12 + i * 0.18));
    const y = state.terrain[x];
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.moveTo(x, y - 36);
    ctx.lineTo(x - 18, y);
    ctx.lineTo(x + 18, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSpaceDecor() {
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(state.worldWidth * 0.84, state.worldHeight * 0.18, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(state.worldWidth * 0.84, state.worldHeight * 0.18, 86, 0.3, Math.PI * 1.7);
  ctx.stroke();
}

function drawTrajectory() {
  if (!state.charging || state.projectiles.length || state.turnEnding || state.matchOver) return;
  const actor = getCurrentAlien();
  if (!actor || !actor.alive) return;
  let x = actor.x + actor.facing * (actor.radius + 8);
  let y = actor.y - actor.radius * 0.4;
  let vx = actor.facing * (2.5 + (Math.max(18, state.chargePower) / POWER_MAX) * 7.2);
  let vy = -BASE_LOFT;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.setLineDash([8, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < 55; i += 1) {
    vx += state.wind;
    vy += GRAVITY;
    x += vx;
    y += vy;
    if (x < 0 || x > state.worldWidth || y > state.worldHeight) break;
    ctx.lineTo(x, y);
    if (isTerrainAt(x, y)) break;
  }
  ctx.stroke();
  ctx.restore();
}

function drawAliens() {
  const activeAlien = getCurrentAlien();
  for (const alien of state.players) {
    if (!alien.alive) continue;
    drawAlien(alien, activeAlien && alien.id === activeAlien.id && !state.matchOver);
    drawHealthBar(alien);
  }
}

function drawAlien(alien, active) {
  const bounce = isGrounded(alien) ? Math.sin(alien.walkCycle) * 1.2 : 0;
  const legSwing = Math.sin(alien.walkCycle * 1.8) * 4;
  const earTilt = alien.facing * 2;
  const skin = skinLibrary[alien.skinId] || skinLibrary.comet;
  const fur = tintColor(alien.baseColor || alien.color, skin.tint);
  const shadow = tintColor(alien.baseColor || alien.color, -0.18);
  const fluff = tintColor(alien.baseColor || alien.color, 0.28);
  ctx.save();
  ctx.translate(alien.x, alien.y + bounce);
  if (active) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, alien.radius + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(18, 32, 51, 0.7)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, alien.radius - 1); ctx.lineTo(-8 - legSwing * 0.25, alien.radius + 10);
  ctx.moveTo(8, alien.radius - 1); ctx.lineTo(8 + legSwing * 0.25, alien.radius + 10);
  ctx.stroke();
  ctx.fillStyle = fluff;
  [[-12, -2, 8], [12, -1, 8], [0, -9, 9], [-4, 8, 8], [6, 9, 8]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.arc(0, 0, alien.radius + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.arc(-8, 5, 7, 0, Math.PI * 2); ctx.arc(8, 5, 7, 0, Math.PI * 2); ctx.arc(0, 11, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = fur;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-9, -alien.radius + 5); ctx.lineTo(-13, -alien.radius - 9);
  ctx.moveTo(9, -alien.radius + 5); ctx.lineTo(13 + earTilt, -alien.radius - 11);
  ctx.stroke();
  ctx.fillStyle = skin.tuft;
  ctx.beginPath(); ctx.arc(0, -alien.radius - 2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin.cheek;
  ctx.beginPath(); ctx.arc(-8, 4, 3.2, 0, Math.PI * 2); ctx.arc(8, 4, 3.2, 0, Math.PI * 2); ctx.fill();
  drawAlienFace(alien);
  drawAlienAccessory(alien, shadow);
  ctx.restore();
}

function drawAlienFace(alien) {
  ctx.fillStyle = "#112034";
  ctx.strokeStyle = "#112034";
  ctx.lineWidth = 2;
  if (alien.faceStyle === "angry") {
    ctx.beginPath(); ctx.moveTo(-8, -7); ctx.lineTo(-2, -5); ctx.moveTo(8, -7); ctx.lineTo(2, -5); ctx.stroke();
    ctx.beginPath(); ctx.arc(-5, -2, 2.4, 0, Math.PI * 2); ctx.arc(5, -2, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 5, 4.2, Math.PI + 0.2, Math.PI * 2 - 0.2); ctx.stroke();
    return;
  }
  if (alien.faceStyle === "happy") {
    ctx.beginPath(); ctx.arc(-5, -2, 2.2, 0, Math.PI * 2); ctx.arc(5, -2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 3, 5.2, 0.15, Math.PI - 0.15); ctx.stroke();
    return;
  }
  if (alien.faceStyle === "crazy") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(-6, -2, 3.8, 0, Math.PI * 2); ctx.arc(5, -1, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#112034";
    ctx.beginPath(); ctx.arc(-5.5, -1.5, 1.7, 0, Math.PI * 2); ctx.arc(6, -0.5, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 5); ctx.quadraticCurveTo(0, 10, 5, 4); ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.arc(-5, -2, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(7, -1); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 4, 4.5, 0.2, Math.PI - 0.4); ctx.stroke();
}

function drawAlienAccessory(alien, color) {
  if (!alien.accessory) return;
  ctx.fillStyle = color;
  if (alien.accessory === "tie") {
    ctx.fillRect(-2, 11, 4, 5);
    ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(-4, 24); ctx.lineTo(0, 27); ctx.lineTo(4, 24); ctx.closePath(); ctx.fill();
    return;
  }
  if (alien.accessory === "ribbon") {
    ctx.beginPath(); ctx.arc(-10, -11, 2.8, 0, Math.PI * 2); ctx.arc(-4, -11, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-8, -11, 3, 7);
    return;
  }
  ctx.beginPath(); ctx.ellipse(0, -16, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-7, -27, 14, 12);
}

function drawHealthBar(alien) {
  const x = alien.x - 21;
  const y = alien.y - 34;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x, y, 42, 7);
  ctx.fillStyle = alien.health > 50 ? "#71f59a" : alien.health > 20 ? "#ffd166" : "#ff6b6b";
  ctx.fillRect(x, y, 42 * (alien.health / 100), 7);
}

function drawProjectiles() { state.projectiles.forEach((projectile) => { ctx.fillStyle = "#fff1a1"; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2); ctx.fill(); }); }
function drawParticles() { state.particles.forEach((particle) => { ctx.globalAlpha = Math.max(0, particle.life / 30); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 4, 4); ctx.globalAlpha = 1; }); }

function updateHUD() {
  const actor = getCurrentAlien();
  dom.hudTurn.textContent = actor ? `${actor.name} - ${actor.teamName || actor.team}` : "Waiting";
  dom.hudTimer.textContent = Math.max(0, Math.ceil(state.turnTimeLeft)).toString();
  dom.hudWind.textContent = state.wind.toFixed(2);
  dom.hudProfile.textContent = state.profile?.username || "Guest";
  dom.hudRoom.textContent = state.online.roomName || (state.mode === "online" ? "Online" : "Offline");
  dom.powerFill.style.width = `${Math.round(state.chargePower)}%`;
}

function generateTerrain(scenario, width, height) {
  const terrain = new Uint16Array(width);
  for (let x = 0; x < width; x += 1) {
    let base = height * 0.7;
    if (scenario.id === "forest") base = height * 0.66 + Math.sin(x * 0.015) * 42 + Math.sin(x * 0.043) * 18;
    if (scenario.id === "city") { base = height * 0.7 + Math.sin(x * 0.01) * 24; if ((x > width * 0.2 && x < width * 0.32) || (x > width * 0.67 && x < width * 0.76)) base -= 78; if (x > width * 0.46 && x < width * 0.56) base -= 52; }
    if (scenario.id === "lake") { base = height * 0.68 + Math.sin(x * 0.02) * 38; if (x > width * 0.38 && x < width * 0.6) base += 58; }
    if (scenario.id === "space") { base = height * 0.63 + Math.sin(x * 0.019) * 34 + Math.sin(x * 0.061) * 26; if (x > width * 0.28 && x < width * 0.37) base += 120; if (x > width * 0.72 && x < width * 0.81) base += 96; }
    terrain[x] = clamp(Math.round(base), Math.round(height * 0.36), height - 62);
  }
  return terrain;
}

function getGroundY(x) { return state.terrain[Math.round(clamp(x, 0, state.worldWidth - 1))] || state.worldHeight; }
function isTerrainAt(x, y) { return y >= (state.terrain[Math.round(clamp(x, 0, state.worldWidth - 1))] || state.worldHeight); }
function isGrounded(alien) { return alien.y >= getGroundY(alien.x) - alien.radius - 0.5; }
function everyoneStable() { return state.players.every((alien) => !alien.alive || (isGrounded(alien) && Math.abs(alien.vy) < 0.05)); }
function setOverlay(message) { state.overlay = message; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomRange(min, max) { return min + Math.random() * (max - min); }

function normalizeTeamConfig(config = {}) {
  return {
    playerTeamName: config.playerTeamName || defaultTeamConfig.playerTeamName,
    enemyTeamName: config.enemyTeamName || defaultTeamConfig.enemyTeamName,
    playerColor: config.playerColor || defaultTeamConfig.playerColor,
    enemyColor: config.enemyColor || defaultTeamConfig.enemyColor,
    playerNames: ensureTeamArray(config.playerNames, defaultTeamConfig.playerNames),
    enemyNames: ensureTeamArray(config.enemyNames, defaultTeamConfig.enemyNames),
    playerSkins: ensureTeamArray(config.playerSkins, defaultTeamConfig.playerSkins)
  };
}

function syncTeamConfigFromForm() {
  state.teamConfig = {
    playerTeamName: dom.playerTeamNameInput.value.trim() || defaultTeamConfig.playerTeamName,
    enemyTeamName: dom.enemyTeamNameInput.value.trim() || defaultTeamConfig.enemyTeamName,
    playerColor: dom.playerColorInput.value,
    enemyColor: dom.enemyColorInput.value,
    playerNames: dom.playerNameInputs.map((input, index) => input.value.trim() || defaultTeamConfig.playerNames[index]),
    enemyNames: dom.enemyNameInputs.map((input, index) => input.value.trim() || defaultTeamConfig.enemyNames[index]),
    playerSkins: dom.playerSkinInputs.map((input, index) => input.value || defaultTeamConfig.playerSkins[index])
  };
}

function applyTeamConfigToForm(config) {
  const normalized = normalizeTeamConfig(config);
  dom.playerTeamNameInput.value = normalized.playerTeamName;
  dom.enemyTeamNameInput.value = normalized.enemyTeamName;
  dom.playerColorInput.value = normalized.playerColor;
  dom.enemyColorInput.value = normalized.enemyColor;
  dom.playerNameInputs.forEach((input, index) => { input.value = normalized.playerNames[index]; });
  dom.enemyNameInputs.forEach((input, index) => { input.value = normalized.enemyNames[index]; });
  dom.playerSkinInputs.forEach((input, index) => { input.value = normalized.playerSkins[index]; });
}

function populateFormFromCurrentState() {
  if (state.players.length) {
    const playerTeam = state.players.filter((alien) => alien.team === "player");
    const enemyTeam = state.players.filter((alien) => alien.team === "enemy");
    state.teamConfig = {
      playerTeamName: playerTeam[0]?.teamName || state.teamConfig.playerTeamName,
      enemyTeamName: enemyTeam[0]?.teamName || state.teamConfig.enemyTeamName,
      playerColor: state.teamConfig.playerColor,
      enemyColor: state.teamConfig.enemyColor,
      playerNames: ensureTeamArray(playerTeam.map((alien) => alien.name), defaultTeamConfig.playerNames),
      enemyNames: ensureTeamArray(enemyTeam.map((alien) => alien.name), defaultTeamConfig.enemyNames),
      playerSkins: ensureTeamArray(playerTeam.map((alien) => alien.skinId), defaultTeamConfig.playerSkins)
    };
  }
  applyTeamConfigToForm(state.teamConfig);
}

function ensureTeamArray(values, fallback) { return Array.from({ length: TEAM_SIZE }, (_, index) => values?.[index] || fallback[index]); }
function buildPalette(baseColor) { return [-0.12, -0.02, 0.12, 0.22].map((amount) => tintColor(baseColor, amount)); }
function tintColor(hex, amount) {
  const clean = String(hex).replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const parts = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  const adjusted = parts.map((channel) => Math.round(channel + ((amount >= 0 ? 255 : 0) - channel) * Math.abs(amount)));
  return `rgb(${adjusted[0]}, ${adjusted[1]}, ${adjusted[2]})`;
}

function resizeCanvas() {
  const previousWidth = state.worldWidth;
  const previousHeight = state.worldHeight;
  state.worldWidth = Math.max(MIN_WORLD_WIDTH, window.innerWidth);
  state.worldHeight = Math.max(MIN_WORLD_HEIGHT, window.innerHeight);
  canvas.width = state.worldWidth;
  canvas.height = state.worldHeight;
  if (state.players.length && (previousWidth !== state.worldWidth || previousHeight !== state.worldHeight)) adaptWorldToCanvas(previousWidth, previousHeight);
}

function adaptWorldToCanvas(fromWidth, fromHeight) {
  if (!fromWidth || !fromHeight || !state.players.length) return;
  const xScale = state.worldWidth / fromWidth;
  const yScale = state.worldHeight / fromHeight;
  state.terrain = scaleTerrain(state.terrain, fromWidth, state.worldWidth, yScale);
  state.players = state.players.map((alien) => ({ ...restoreAlien(alien), x: clamp(alien.x * xScale, alien.radius, state.worldWidth - alien.radius), y: alien.y * yScale, fallStartY: alien.fallStartY * yScale }));
  state.projectiles = state.projectiles.map((projectile) => ({ ...projectile, x: projectile.x * xScale, y: projectile.y * yScale, vx: projectile.vx * xScale, vy: projectile.vy * yScale }));
  markStateDirty();
}

function scaleTerrain(sourceTerrain, sourceWidth, targetWidth, yScale) {
  const scaled = new Uint16Array(targetWidth);
  for (let x = 0; x < targetWidth; x += 1) {
    const sample = Math.round((x / Math.max(1, targetWidth - 1)) * Math.max(1, sourceWidth - 1));
    scaled[x] = Math.round((sourceTerrain[sample] || state.worldHeight) * yScale);
  }
  return scaled;
}

function restoreTerrain(terrainArray) { return Uint16Array.from(Array.isArray(terrainArray) ? terrainArray : []); }

function unlockAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (!state.audioContext) state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
  state.audioUnlocked = true;
}

function playSound(type) {
  if (!state.audioUnlocked || !state.audioContext) return;
  const audio = state.audioContext;
  const now = audio.currentTime;
  const specs = { shoot: ["triangle", 300, 150, 0.05, 0.16], hitLand: ["sawtooth", 110, 55, 0.06, 0.22], hitAlien: ["square", 420, 180, 0.05, 0.18], fall: ["sine", 180, 90, 0.045, 0.12], beep: ["sine", 880, 760, 0.03, 0.09] };
  const spec = specs[type];
  if (!spec) return;
  const [oscType, start, end, gain, duration] = spec;
  const oscillator = audio.createOscillator();
  const gainNode = audio.createGain();
  oscillator.type = oscType;
  oscillator.frequency.setValueAtTime(start, now);
  oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gainNode);
  gainNode.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
