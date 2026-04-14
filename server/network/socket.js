const crypto = require("crypto");
const { sanitizeUsername } = require("../utils/auth");
const { sanitizeRoom } = require("../api/matchmaking");

function buildRoomPlayer(username) {
  return { username, joinedAt: new Date().toISOString() };
}

function createSocketServer(io, { rooms }) {
  async function broadcastRooms() {
    const openRooms = await rooms.find({ status: { $ne: "closed" } }).sort({ createdAt: -1 }).toArray();
    io.emit("room:list", openRooms.map(sanitizeRoom));
  }

  async function startRoomCountdown(roomId) {
    const room = await rooms.findOne({ roomId });
    if (!room || room.status === "starting" || room.players.length < 2) return;

    await rooms.updateOne(
      { roomId },
      {
        $set: {
          status: "starting",
          countdown: { startedAt: new Date().toISOString(), secondsLeft: 10 }
        }
      }
    );

    for (let secondsLeft = 10; secondsLeft >= 0; secondsLeft -= 1) {
      io.to(roomId).emit("room:countdown", { roomId, secondsLeft });
      await rooms.updateOne(
        { roomId },
        { $set: { "countdown.secondsLeft": secondsLeft, updatedAt: new Date().toISOString() } }
      );
      if (secondsLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const latestRoom = await rooms.findOne({ roomId });
    if (!latestRoom || latestRoom.players.length < 2) {
      await rooms.updateOne(
        { roomId },
        { $set: { status: "waiting", countdown: null, updatedAt: new Date().toISOString() } }
      );
      await broadcastRooms();
      return;
    }

    await rooms.updateOne(
      { roomId },
      { $set: { status: "active", countdown: null, updatedAt: new Date().toISOString() } }
    );

    io.to(roomId).emit("room:start", { roomId, players: latestRoom.players });
    await broadcastRooms();
  }

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
      await rooms.updateOne({ roomId }, { $set: room }, { upsert: true });
      io.to(roomId).emit("room:update", sanitizeRoom(room));
      await broadcastRooms();
    });

    socket.on("room:join", async ({ roomId, username }) => {
      const cleanUsername = sanitizeUsername(username || socket.data.username);
      if (!roomId || !cleanUsername) return;

      const room = await rooms.findOne({ roomId });
      if (!room || room.players.length >= 2 || room.status === "active") {
        socket.emit("room:error", { message: "That room is not available anymore." });
        return;
      }

      const players = room.players.some((player) => player.username === cleanUsername)
        ? room.players
        : [...room.players, buildRoomPlayer(cleanUsername)];

      await rooms.updateOne(
        { roomId },
        { $set: { players, updatedAt: new Date().toISOString() } }
      );

      socket.join(roomId);
      const updatedRoom = await rooms.findOne({ roomId });
      io.to(roomId).emit("room:update", sanitizeRoom(updatedRoom));
      await broadcastRooms();

      if (updatedRoom.players.length === 2) {
        startRoomCountdown(roomId).catch((error) => console.error("Countdown failed", error));
      }
    });

    socket.on("room:leave", async ({ roomId, username }) => {
      const cleanUsername = sanitizeUsername(username || socket.data.username);
      if (!roomId || !cleanUsername) return;

      const room = await rooms.findOne({ roomId });
      if (!room) return;

      const players = (room.players || []).filter((player) => player.username !== cleanUsername);
      await rooms.updateOne(
        { roomId },
        {
          $set: {
            players,
            status: players.length ? "waiting" : "closed",
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
      await rooms.updateOne(
        { roomId },
        { $set: { currentState: snapshot, updatedAt: new Date().toISOString() } }
      );
      socket.to(roomId).emit("game:state", snapshot);
    });
  });

  return { broadcastRooms };
}

module.exports = { createSocketServer };
