const express = require("express");

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

function createMatchmakingRouter({ rooms }) {
  const router = express.Router();

  router.get("/rooms", async (_req, res) => {
    const openRooms = await rooms.find({ status: { $ne: "closed" } }).sort({ createdAt: -1 }).toArray();
    res.json({ rooms: openRooms.map(sanitizeRoom) });
  });

  return router;
}

module.exports = { createMatchmakingRouter, sanitizeRoom };
