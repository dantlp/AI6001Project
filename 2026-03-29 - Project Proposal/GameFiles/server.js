const path = require("path");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

const PORT = Number(process.env.PORT || 3000);
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.MONGODB_DB || "alien_artillery_arena";
const TEAM_SIZE = 4;

const defaultTeamConfig = {
  playerTeamName: "Star Puffs",
  enemyTeamName: "Nebula Floofs",
  playerColor: "#7ef3b8",
  enemyColor: "#ff9fb4",
  playerNames: ["Momo", "Bibi", "Lulu", "Nori"],
  enemyNames: ["Fizz", "Puff", "Tiki", "Zuzu"],
  playerSkins: ["comet", "moss", "coral", "frost"]
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let mongoClient;
let db;
let usersCollection;
let gameStatesCollection;
let roomsCollection;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

function sanitizeUsername(username = "") {
  return username.trim().slice(0, 20);
}

function normalizeTeamConfig(config = {}) {
  return {
    playerTeamName: config.playerTeamName || defaultTeamConfig.playerTeamName,
    enemyTeamName: config.enemyTeamName || defaultTeamConfig.enemyTeamName,
    playerColor: config.playerColor || defaultTeamConfig.playerColor,
    enemyColor: config.enemyColor || defaultTeamConfig.enemyColor,
    playerNames: Array.from({ length: TEAM_SIZE }, (_, index) => config.playerNames?.[index] || defaultTeamConfig.playerNames[index]),
    enemyNames: Array.from({ length: TEAM_SIZE }, (_, index) => config.enemyNames?.[index] || defaultTeamConfig.enemyNames[index]),
    playerSkins: Array.from({ length: TEAM_SIZE }, (_, index) => config.playerSkins?.[index] || defaultTeamConfig.playerSkins[index])
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user?.passwordSalt || !user?.passwordHash) return false;
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function toPublicProfile(user) {
  return {
    username: user.username,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    stats: user.stats || { wins: 0, losses: 0, savedMatches: 0 },
    preferences: normalizeTeamConfig(user.preferences)
  };
}

async function saveRoom(room) {
  await roomsCollection.updateOne(
    { roomId: room.roomId },
    {
      $set: {
        ...room,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );
}

function sanitizeRoom(room) {
  return {
    roomId: room.roomId,
    roomName: room.roomName,
    owner: room.owner,
    players: room.players || [],
    status: room.status || "waiting",
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    scenarioId: room.scenarioId || "forest",
    countdown: room.countdown || null
  };
}

async function broadcastRooms() {
  const rooms = await roomsCollection.find({ status: { $ne: "closed" } }).sort({ createdAt: -1 }).toArray();
  io.emit("room:list", rooms.map(sanitizeRoom));
}

function buildRoomPlayer(username) {
  return {
    username,
    joinedAt: new Date().toISOString()
  };
}

async function startRoomCountdown(roomId) {
  const room = await roomsCollection.findOne({ roomId });
  if (!room || room.status === "starting" || room.players.length < 2) return;

  const countdownStartedAt = new Date().toISOString();
  await roomsCollection.updateOne(
    { roomId },
    {
      $set: {
        status: "starting",
        countdown: {
          startedAt: countdownStartedAt,
          secondsLeft: 10
        }
      }
    }
  );

  for (let secondsLeft = 10; secondsLeft >= 0; secondsLeft -= 1) {
    io.to(roomId).emit("room:countdown", { roomId, secondsLeft });
    await roomsCollection.updateOne(
      { roomId },
      {
        $set: {
          "countdown.secondsLeft": secondsLeft,
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (secondsLeft > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const latestRoom = await roomsCollection.findOne({ roomId });
  if (!latestRoom || latestRoom.players.length < 2) {
    await roomsCollection.updateOne(
      { roomId },
      {
        $set: {
          status: "waiting",
          countdown: null,
          updatedAt: new Date().toISOString()
        }
      }
    );
    await broadcastRooms();
    return;
  }

  await roomsCollection.updateOne(
    { roomId },
    {
      $set: {
        status: "active",
        countdown: null,
        updatedAt: new Date().toISOString()
      }
    }
  );

  io.to(roomId).emit("room:start", {
    roomId,
    players: latestRoom.players
  });
  await broadcastRooms();
}

app.post("/api/auth/login", async (req, res) => {
  const username = sanitizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  let user = await usersCollection.findOne({ usernameLower: username.toLowerCase() });
  if (!user) {
    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();
    user = {
      username,
      usernameLower: username.toLowerCase(),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
      stats: { wins: 0, losses: 0, savedMatches: 0 },
      preferences: normalizeTeamConfig()
    };
    await usersCollection.insertOne(user);
  } else if (!verifyPassword(password, user)) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  await usersCollection.updateOne(
    { usernameLower: username.toLowerCase() },
    { $set: { updatedAt: new Date().toISOString() } }
  );

  const freshUser = await usersCollection.findOne({ usernameLower: username.toLowerCase() });
  res.json({ profile: toPublicProfile(freshUser) });
});

app.get("/api/profile/:username", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  const user = await usersCollection.findOne({ usernameLower: username.toLowerCase() });
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json({ profile: toPublicProfile(user) });
});

app.put("/api/profile/:username/preferences", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  const preferences = normalizeTeamConfig(req.body?.preferences);
  const stats = req.body?.stats;

  await usersCollection.updateOne(
    { usernameLower: username.toLowerCase() },
    {
      $set: {
        preferences,
        ...(stats ? { stats } : {}),
        updatedAt: new Date().toISOString()
      }
    }
  );

  const user = await usersCollection.findOne({ usernameLower: username.toLowerCase() });
  res.json({ profile: toPublicProfile(user) });
});

app.get("/api/gamestate/:username", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  const gameState = await gameStatesCollection.findOne({ usernameLower: username.toLowerCase() });
  if (!gameState) {
    res.status(404).json({ error: "No saved game found." });
    return;
  }
  res.json({ gameState });
});

app.put("/api/gamestate/:username", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  const payload = req.body?.gameState;
  if (!payload) {
    res.status(400).json({ error: "Game state is required." });
    return;
  }

  await gameStatesCollection.updateOne(
    { usernameLower: username.toLowerCase() },
    {
      $set: {
        username,
        usernameLower: username.toLowerCase(),
        ...payload,
        savedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );

  res.json({ ok: true });
});

app.get("/api/rooms", async (_req, res) => {
  const rooms = await roomsCollection.find({ status: { $ne: "closed" } }).sort({ createdAt: -1 }).toArray();
  res.json({ rooms: rooms.map(sanitizeRoom) });
});

io.on("connection", (socket) => {
  socket.on("player:register", ({ username }) => {
    socket.data.username = sanitizeUsername(username);
  });

  socket.on("room:create", async ({ roomName, owner, scenarioId }) => {
    const username = sanitizeUsername(owner || socket.data.username);
    if (!username) return;

    const roomId = crypto.randomUUID();
    const room = {
      roomId,
      roomName: String(roomName || `${username}'s Room`).slice(0, 28),
      owner: username,
      scenarioId: scenarioId || "forest",
      players: [buildRoomPlayer(username)],
      status: "waiting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      countdown: null
    };

    socket.join(roomId);
    await saveRoom(room);
    io.to(roomId).emit("room:update", sanitizeRoom(room));
    await broadcastRooms();
  });

  socket.on("room:join", async ({ roomId, username }) => {
    const cleanUsername = sanitizeUsername(username || socket.data.username);
    if (!roomId || !cleanUsername) return;

    const room = await roomsCollection.findOne({ roomId });
    if (!room || room.players.length >= 2 || room.status === "active") {
      socket.emit("room:error", { message: "That room is not available anymore." });
      return;
    }

    const players = room.players.some((player) => player.username === cleanUsername)
      ? room.players
      : [...room.players, buildRoomPlayer(cleanUsername)];

    await roomsCollection.updateOne(
      { roomId },
      {
        $set: {
          players,
          updatedAt: new Date().toISOString()
        }
      }
    );

    socket.join(roomId);
    const updatedRoom = await roomsCollection.findOne({ roomId });
    io.to(roomId).emit("room:update", sanitizeRoom(updatedRoom));
    await broadcastRooms();

    if (updatedRoom.players.length === 2) {
      startRoomCountdown(roomId).catch((error) => {
        console.error("Countdown failed", error);
      });
    }
  });

  socket.on("room:leave", async ({ roomId, username }) => {
    const cleanUsername = sanitizeUsername(username || socket.data.username);
    if (!roomId || !cleanUsername) return;

    const room = await roomsCollection.findOne({ roomId });
    if (!room) return;

    const players = (room.players || []).filter((player) => player.username !== cleanUsername);
    const status = players.length ? "waiting" : "closed";

    await roomsCollection.updateOne(
      { roomId },
      {
        $set: {
          players,
          status,
          countdown: null,
          updatedAt: new Date().toISOString()
        }
      }
    );

    socket.leave(roomId);
    await broadcastRooms();
  });

  socket.on("game:sync", async ({ roomId, snapshot }) => {
    if (!roomId || !snapshot) return;
    await roomsCollection.updateOne(
      { roomId },
      {
        $set: {
          currentState: snapshot,
          updatedAt: new Date().toISOString()
        }
      }
    );
    socket.to(roomId).emit("game:state", snapshot);
  });
});

async function start() {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  usersCollection = db.collection("users");
  gameStatesCollection = db.collection("gameStates");
  roomsCollection = db.collection("rooms");

  await Promise.all([
    usersCollection.createIndex({ usernameLower: 1 }, { unique: true }),
    gameStatesCollection.createIndex({ usernameLower: 1 }, { unique: true }),
    roomsCollection.createIndex({ roomId: 1 }, { unique: true })
  ]);

  server.listen(PORT, () => {
    console.log(`Alien Artillery Arena running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
