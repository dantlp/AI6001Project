const { MongoClient } = require("mongodb");

async function connectToDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "alien_artillery_arena");

  const collections = {
    client,
    db,
    users: db.collection("users"),
    gameStates: db.collection("gameStates"),
    rooms: db.collection("rooms")
  };

  await Promise.all([
    collections.users.createIndex({ usernameLower: 1 }, { unique: true }),
    collections.gameStates.createIndex({ usernameLower: 1 }, { unique: true }),
    collections.rooms.createIndex({ roomId: 1 }, { unique: true })
  ]);

  return collections;
}

module.exports = { connectToDatabase };
