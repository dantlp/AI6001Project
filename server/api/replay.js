const express = require("express");

function createReplayRouter() {
  const router = express.Router();
  router.get("/replay/:id", (_req, res) => {
    res.status(501).json({ error: "Replay API scaffold not implemented yet." });
  });
  return router;
}

module.exports = { createReplayRouter };
