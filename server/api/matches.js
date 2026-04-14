const express = require("express");
const { normalizeTeamConfig, sanitizeUsername, toPublicProfile } = require("../utils/auth");

function createMatchesRouter({ users, gameStates }) {
  const router = express.Router();

  router.get("/profile/:username", async (req, res) => {
    const username = sanitizeUsername(req.params.username);
    const user = await users.findOne({ usernameLower: username.toLowerCase() });
    if (!user) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    res.json({ profile: toPublicProfile(user) });
  });

  router.put("/profile/:username/preferences", async (req, res) => {
    const username = sanitizeUsername(req.params.username);
    const preferences = normalizeTeamConfig(req.body?.preferences);
    const stats = req.body?.stats;

    await users.updateOne(
      { usernameLower: username.toLowerCase() },
      { $set: { preferences, ...(stats ? { stats } : {}), updatedAt: new Date().toISOString() } }
    );

    const user = await users.findOne({ usernameLower: username.toLowerCase() });
    res.json({ profile: toPublicProfile(user) });
  });

  router.get("/gamestate/:username", async (req, res) => {
    const username = sanitizeUsername(req.params.username);
    const gameState = await gameStates.findOne({ usernameLower: username.toLowerCase() });
    if (!gameState) {
      res.status(404).json({ error: "No saved game found." });
      return;
    }
    res.json({ gameState });
  });

  router.put("/gamestate/:username", async (req, res) => {
    const username = sanitizeUsername(req.params.username);
    const payload = req.body?.gameState;
    if (!payload) {
      res.status(400).json({ error: "Game state is required." });
      return;
    }

    await gameStates.updateOne(
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

  return router;
}

module.exports = { createMatchesRouter };
