export function shouldSync(lastSyncAt, now, delay) {
  return now - lastSyncAt >= delay;
}
