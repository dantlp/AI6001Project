export const weaponCatalog = {
  shot: {
    id: "shot",
    label: "Shot",
    radius: 5,
    speedBase: 2.5,
    speedScale: 7.2,
    loft: 5.9,
    blastRadius: 36,
    damageBoost: 0,
    sound: "shoot"
  },
  grenade: {
    id: "grenade",
    label: "Grenade",
    radius: 7,
    speedBase: 1.9,
    speedScale: 4.8,
    loft: 5.2,
    blastRadius: 52,
    damageBoost: 14,
    sound: "grenade"
  }
};

export function nextLivingIndexForTeam(players, team, currentTeamIndex = -1) {
  const indices = players
    .map((alien, index) => ({ alien, index }))
    .filter((entry) => entry.alien.team === team && entry.alien.alive)
    .map((entry) => entry.index);

  if (!indices.length) return -1;
  if (currentTeamIndex === -1) return indices[0];

  const currentPosition = indices.indexOf(currentTeamIndex);
  if (currentPosition === -1) return indices[0];
  return indices[(currentPosition + 1) % indices.length];
}
