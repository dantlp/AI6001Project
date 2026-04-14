export function terrainColumnAt(terrain, index, fallback) {
  return terrain[index] || fallback;
}
