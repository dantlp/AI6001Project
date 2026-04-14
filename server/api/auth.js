const express = require("express");
const {
  normalizeTeamConfig,
  sanitizeUsername,
  hashPassword,
  verifyPassword,
  toPublicProfile
} = require("../utils/auth");

function createAuthRouter({ users }) {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    const username = sanitizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    let user = await users.findOne({ usernameLower: username.toLowerCase() });
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
      await users.insertOne(user);
    } else if (!verifyPassword(password, user)) {
      res.status(401).json({ error: "Incorrect password." });
      return;
    }

    await users.updateOne(
      { usernameLower: username.toLowerCase() },
      { $set: { updatedAt: new Date().toISOString() } }
    );

    const freshUser = await users.findOne({ usernameLower: username.toLowerCase() });
    res.json({ profile: toPublicProfile(freshUser) });
  });

  return router;
}

module.exports = { createAuthRouter };
