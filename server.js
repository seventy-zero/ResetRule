const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the current directory
app.use(express.static(__dirname));

// Store connected players
const players = new Map();
const MAX_PLAYERS = 20;

wss.on('connection', (ws) => {
    let playerUsername = '';

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    // Handle new player joining
                    playerUsername = data.username;
                    
                    // Check if room is full
                    if (players.size >= MAX_PLAYERS) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room is full (20 players maximum)'
                        }));
                        ws.close();
                        return;
                    }

                    // Add new player
                    players.set(playerUsername, {
                        ws,
                        position: [0, 10, 0],
                        rotation: [0, 0, 0],
                        username: playerUsername
                    });

                    // Send current players to new player
                    const existingPlayers = Array.from(players.values())
                        .filter(p => p.username !== playerUsername)
                        .map(p => ({
                            username: p.username,
                            position: p.position,
                            rotation: p.rotation
                        }));

                    ws.send(JSON.stringify({
                        type: 'players',
                        players: existingPlayers
                    }));

                    // Notify others about new player
                    broadcast({
                        type: 'playerJoined',
                        player: {
                            username: playerUsername,
                            position: [0, 10, 0],
                            rotation: [0, 0, 0]
                        }
                    }, ws);

                    console.log(`Player joined: ${playerUsername} (${players.size} players online)`);
                    break;

                case 'position':
                    // Update player position and rotation
                    if (players.has(playerUsername)) {
                        const player = players.get(playerUsername);
                        player.position = data.position;
                        player.rotation = data.rotation;

                        // Broadcast position update to other players
                        broadcast({
                            type: 'playerMoved',
                            username: playerUsername,
                            position: data.position,
                            rotation: data.rotation
                        }, ws);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (playerUsername && players.has(playerUsername)) {
            players.delete(playerUsername);
            
            // Notify others about player leaving
            broadcast({
                type: 'playerLeft',
                username: playerUsername
            });

            console.log(`Player left: ${playerUsername} (${players.size} players online)`);
        }
    });
});

// Broadcast message to all clients except sender
function broadcast(message, exclude) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
} 