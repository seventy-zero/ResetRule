const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(__dirname));

// Store connected players
const players = new Map();

// Generate random spawn position
function getRandomSpawnPosition() {
    const radius = 2000; // Smaller than the map size to ensure spawning in playable area
    const angle = Math.random() * Math.PI * 2;
    return {
        x: Math.cos(angle) * radius,
        y: 10, // Starting height
        z: Math.sin(angle) * radius
    };
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    let playerId = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'join':
                // Generate unique player ID and initial position
                playerId = Math.random().toString(36).substr(2, 9);
                const spawnPosition = getRandomSpawnPosition();
                
                // Store player data
                players.set(playerId, {
                    id: playerId,
                    username: data.username,
                    position: spawnPosition,
                    rotation: { x: 0, y: 0, z: 0 },
                    ws: ws
                });

                // Send initial state to new player
                ws.send(JSON.stringify({
                    type: 'init',
                    id: playerId,
                    position: spawnPosition,
                    players: Array.from(players.entries())
                        .filter(([id]) => id !== playerId)
                        .map(([_, player]) => ({
                            id: player.id,
                            username: player.username,
                            position: player.position,
                            rotation: player.rotation
                        }))
                }));

                // Broadcast new player to others
                broadcast({
                    type: 'playerJoined',
                    id: playerId,
                    username: data.username,
                    position: spawnPosition
                }, playerId);
                break;

            case 'update':
                if (playerId && players.has(playerId)) {
                    const player = players.get(playerId);
                    player.position = data.position;
                    player.rotation = data.rotation;

                    // Broadcast position update to other players
                    broadcast({
                        type: 'playerMoved',
                        id: playerId,
                        position: data.position,
                        rotation: data.rotation
                    }, playerId);
                }
                break;
        }
    });

    ws.on('close', () => {
        if (playerId) {
            // Remove player and notify others
            players.delete(playerId);
            broadcast({
                type: 'playerLeft',
                id: playerId
            });
        }
    });
});

// Broadcast message to all clients except sender
function broadcast(message, excludeId = null) {
    players.forEach((player, id) => {
        if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 