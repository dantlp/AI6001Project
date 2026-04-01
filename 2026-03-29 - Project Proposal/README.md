# Project Proposal

Our proposed project will be a turn based strategy war game, similar to the game worms, where the purpose of the game is defeat the enemy’s team moving in the map, shooting at them projectiles that destroy the environment that it gets into contact and inflict damage to the enemy nearby. This game will consist in building a map where 2 teams of 4 are fighting against each other where each character can move from left and right, can jump, the shoot distance depends on the time the player presses the shooting key.  The first team to get rid of the opponent’s alien team wins.
The game will consist in a User registration, where they will be able to name each of their alien team, there will be 5 different environments/maps where the battle will be located and the ability to select if the player wants to play against an AI, play locally vs another player or play remotely vs a player. 
If selecting play remotely, there will be a button to generate a connection code so the other player can connect vs the opponent to play with them.
To play locally, the use of Node is required to generate a local server. MongoDB is to be used to register and save the information from the user, mainly storing the username, password and the alien’s names. MongoDB is also to be used if playing locally as it can store a state of when the characters were last located, so the user can continue the game where they left last time, with the use of a save button as well as a load button.
We are planning to store the game using mun’s server to run the server for the game (https://www.cs.mun.ca/~dlozanoperez/Game (Testing is currently on development)) and also planning to use AWS in case we are not successful.
Desired Structure
Client
	Index
	Game
	
CSS
	Style
	plays
	
JS
	main
	play
	history
	UI
Assets
	/Images
	/Sounds
Network
	api
	Auth
	Matchmaking
	Sync
Docker
	dockerfile
	docker-compose
.gitignore
README
