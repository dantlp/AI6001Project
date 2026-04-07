# Project Proposal

Our proposed project will be a turn based strategy war game, similar to the game worms, where the purpose of the game is defeat the enemy’s team moving in the map, shooting at them projectiles that destroy the environment that it gets into contact and inflict damage to the enemy nearby. This game will consist in building a map where 2 teams of 4 are fighting against each other where each character can move from left and right, can jump, the shoot distance depends on the time the player presses the shooting key.  The first team to get rid of the opponent’s alien team wins.
The game will consist in a User registration, where they will be able to name each of their alien team, there will be 5 different environments/maps where the battle will be located and the ability to select if the player wants to play against an AI, play locally vs another player or play remotely vs a player. 
If selecting play remotely, there will be a button to generate a connection code so the other player can connect vs the opponent to play with them.
To play locally, the use of Node is required to generate a local server. MongoDB is to be used to register and save the information from the user, mainly storing the username, password and the alien’s names. MongoDB is also to be used if playing locally as it can store a state of when the characters were last located, so the user can continue the game where they left last time, with the use of a save button as well as a load button.
We are planning to store the game using mun’s server to run the server for the game (https://www.cs.mun.ca/~dlozanoperez/Game (Testing is currently on development)) and also planning to use AWS in case we are not successful.
Desired Structure

```text
worms-game/
│
├── client/                                  # frontend (browser game)
│   ├── index.html                           # main menu / landing
│   ├── play.html                            # live match screen
│   ├── history.html                         # match history list
│   ├── replay.html                          # replay viewer
│   │
│   ├── css/
│   │   ├── styles.css                       # global styles
│   │   ├── play.css                         # in-game UI
│   │   ├── history.css                      # history page
│   │   └── replay.css                       # replay UI
│   │
│   ├── js/
│   │   ├── main.js                          # app bootstrap + routing
│   │   │
│   │   ├── play/
│   │   │   ├── play.js                      # main game loop (client-side)
│   │   │   ├── input.js                     # keyboard/mouse handling
│   │   │   ├── physics.js                   # projectile + gravity simulation
│   │   │   ├── terrain.js                   # destructible terrain logic
│   │   │   ├── entities.js                  # worms, weapons, objects
│   │   │   └── camera.js                    # camera movement / tracking
│   │   │
│   │   ├── ui/
│   │   │   ├── ui.js                        # shared UI helpers
│   │   │   ├── hud.js                       # health bars, wind, turn info
│   │   │   ├── menus.js                     # pause / settings menus
│   │   │   └── lobby.js                     # matchmaking UI
│   │   │
│   │   ├── network/
│   │   │   ├── api.js                       # REST API calls
│   │   │   ├── socket.js                    # WebSocket client
│   │   │   └── sync.js                      # state sync + reconciliation
│   │   │
│   │   ├── history.js                       # fetch/display past matches
│   │   ├── replay.js                        # replay playback system
│   │   └── replay-engine.js                 # deterministic replay logic
│   │
│   └── assets/
│       ├── images/
│       │   ├── terrain/                     # ground textures
│       │   ├── worms/                       # worm sprites/animations
│       │   ├── weapons/                     # bazooka, grenade, etc.
│       │   └── ui/                          # icons, buttons
│       │
│       ├── audio/
│       │   ├── weapons/                     # explosions, shots
│       │   ├── ui/                          # clicks, menu sounds
│       │   └── ambient/                     # wind, background
│       │
│       └── maps/
│           └── default.json                 # terrain presets / seeds
│
├── server/                                  # backend (Node.js)
│   ├── server.js                            # express + websocket setup
│   ├── db.js                                # DB connection (Mongo/Postgres)
│   ├── package.json
│   ├── .env
│   │
│   ├── api/
│   │   ├── auth.js                          # login/register
│   │   ├── matches.js                       # match history CRUD
│   │   ├── matchmaking.js                   # queue endpoints
│   │   └── replay.js                        # replay fetch endpoints
│   │
│   ├── matchmaking/
│   │   └── queue.js                         # player queue + pairing logic
│   │
│   ├── game/
│   │   ├── GameRoom.js                      # manages a live match
│   │   ├── GameState.js                     # full authoritative state
│   │   ├── TurnManager.js                   # turn timing + switching
│   │   ├── Physics.js                       # server-side physics validation
│   │   ├── Terrain.js                       # destructible terrain model
│   │   └── Weapons.js                       # weapon behaviors
│   │
│   ├── network/
│   │   ├── socket.js                        # websocket handlers
│   │   └── sync.js                          # state diff / snapshot system
│   │
│   ├── models/
│   │   ├── User.js                          # user schema
│   │   ├── Match.js                         # match + results
│   │   └── Replay.js                        # stored inputs/events
│   │
│   └── utils/
│       ├── auth.js                          # JWT / hashing
│       └── logger.js                        # logging helper
│
├── docker/
│   ├── Dockerfile                           # Node app container
│   └── docker-compose.yml                   # app + DB + optional redis
│
├── .gitignore
└── README.md
```
