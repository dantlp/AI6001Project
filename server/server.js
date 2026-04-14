const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { connectToDatabase } = require("./db");
const { createAuthRouter } = require("./api/auth");
const { createMatchesRouter } = require("./api/matches");
const { createMatchmakingRouter } = require("./api/matchmaking");
const { createReplayRouter } = require("./api/replay");
const { createSocketServer } = require("./network/socket");

async function start() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const db = await connectToDatabase();

  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(path.resolve(__dirname, "../client")));

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api", createMatchesRouter(db));
  app.use("/api", createMatchmakingRouter(db));
  app.use("/api", createReplayRouter(db));

  createSocketServer(io, db);

  app.get("/", (_req, res) => {
    res.sendFile(path.resolve(__dirname, "../client/index.html"));
  });

  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`Alien Artillery Arena running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
