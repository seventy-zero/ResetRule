import { WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

// Redis client setup
const redis = createClient();
redis.connect().catch(console.error);

// WebSocket server setup
const wss = new WebSocketServer({ port: 8080 });

// Store active game instances and their players
const gameInstances = new Map();
const MAX_PLAYERS_PER_INSTANCE = 20;

// Message types
const MESSAGE_TYPES = {
    JOIN: 'join',
    LEAVE: 'leave',
    POSITION: 'position',
    FLING: 'fling',
    CREATE_GAME: 'create_game',
    JOIN_GAME: 'join_game',
    GAME_LIST: 'game_list',
    GAME_FULL: 'game_full',
    GAME_JOINED: 'game_joined'
};

function createGameInstance(gameId) {
    return {
        id: gameId,
        players: new Map(),
        createdAt: Date.now()
    };
}

function findAvailableGame() {
    for (const [gameId, game] of gameInstances) {
        if (game.players.size < MAX_PLAYERS_PER_INSTANCE) {
            return gameId;
        }
    }
    return null;
}

wss.on('connection', async function connection(ws) {
    const playerId = uuidv4();
    let currentGameId = null;
    
    ws.on('error', console.error);

    ws.on('message', async function message(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case MESSAGE_TYPES.CREATE_GAME:
                    const newGameId = uuidv4();
                    gameInstances.set(newGameId, createGameInstance(newGameId));
                    ws.send(JSON.stringify({
                        type: MESSAGE_TYPES.GAME_CREATED,
                        gameId: newGameId
                    }));
                    break;

                case MESSAGE_TYPES.JOIN_GAME:
                    let targetGameId = message.gameId;
                    
                    // If no specific game requested, find an available one or create new
                    if (!targetGameId) {
                        targetGameId = findAvailableGame();
                        if (!targetGameId) {
                            targetGameId = uuidv4();
                            gameInstances.set(targetGameId, createGameInstance(targetGameId));
                        }
                    }

                    const game = gameInstances.get(targetGameId);
                    if (!game) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Game not found'
                        }));
                        return;
                    }

                    if (game.players.size >= MAX_PLAYERS_PER_INSTANCE) {
                        ws.send(JSON.stringify({
                            type: MESSAGE_TYPES.GAME_FULL
                        }));
                        return;
                    }

                    // Add player to game instance
                    currentGameId = targetGameId;
                    game.players.set(playerId, {
                        username: message.username,
                        position: message.position,
                        ws: ws
                    });

                    // Send success message to player
                    ws.send(JSON.stringify({
                        type: MESSAGE_TYPES.GAME_JOINED,
                        gameId: targetGameId
                    }));

                    // Broadcast new player to others in same game
                    broadcastToGame(targetGameId, {
                        type: MESSAGE_TYPES.JOIN,
                        playerId: playerId,
                        username: message.username,
                        position: message.position
                    }, ws);

                    // Send existing players to new player
                    const players = [];
                    game.players.forEach((player, id) => {
                        if (id !== playerId) {
                            players.push({
                                playerId: id,
                                username: player.username,
                                position: player.position
                            });
                        }
                    });
                    ws.send(JSON.stringify({
                        type: 'init',
                        players: players
                    }));
                    break;

                case MESSAGE_TYPES.POSITION:
                    if (currentGameId && gameInstances.has(currentGameId)) {
                        const game = gameInstances.get(currentGameId);
                        if (game.players.has(playerId)) {
                            game.players.get(playerId).position = message.position;
                            broadcastToGame(currentGameId, {
                                type: MESSAGE_TYPES.POSITION,
                                playerId: playerId,
                                position: message.position
                            }, ws);
                        }
                    }
                    break;

                case MESSAGE_TYPES.FLING:
                    if (currentGameId) {
                        broadcastToGame(currentGameId, {
                            type: MESSAGE_TYPES.FLING,
                            playerId: playerId,
                            startPosition: message.startPosition,
                            endPosition: message.endPosition
                        }, ws);
                    }
                    break;

                case MESSAGE_TYPES.GAME_LIST:
                    // Send list of available games
                    const gameList = Array.from(gameInstances.entries())
                        .filter(([_, game]) => game.players.size < MAX_PLAYERS_PER_INSTANCE)
                        .map(([id, game]) => ({
                            id,
                            playerCount: game.players.size,
                            maxPlayers: MAX_PLAYERS_PER_INSTANCE
                        }));
                    ws.send(JSON.stringify({
                        type: MESSAGE_TYPES.GAME_LIST,
                        games: gameList
                    }));
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', function close() {
        // Remove player from their game instance
        if (currentGameId && gameInstances.has(currentGameId)) {
            const game = gameInstances.get(currentGameId);
            game.players.delete(playerId);
            
            // Broadcast departure to others in same game
            broadcastToGame(currentGameId, {
                type: MESSAGE_TYPES.LEAVE,
                playerId: playerId
            });

            // Clean up empty game instances
            if (game.players.size === 0) {
                gameInstances.delete(currentGameId);
            }
        }
    });
});

function broadcastToGame(gameId, message, excludeWs = null) {
    const game = gameInstances.get(gameId);
    if (!game) return;

    game.players.forEach(player => {
        if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// Clean up stale game instances periodically
setInterval(() => {
    const now = Date.now();
    for (const [gameId, game] of gameInstances) {
        // Remove games that are empty and older than 5 minutes
        if (game.players.size === 0 && now - game.createdAt > 5 * 60 * 1000) {
            gameInstances.delete(gameId);
        }
    }
}, 60000); // Run every minute

console.log('Multiplayer server running on port 8080'); 