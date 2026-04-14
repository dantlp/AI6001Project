class GameState {
  constructor(snapshot = {}) {
    Object.assign(this, snapshot);
  }
}

module.exports = GameState;
