const crypto = require("crypto");

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

module.exports = {
  defaultTeamConfig,
  normalizeTeamConfig,
  sanitizeUsername,
  hashPassword,
  verifyPassword,
  toPublicProfile
};
