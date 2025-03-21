const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected players
const players = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('New client connected');
    let playerData = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'join':
                    // Store player data
                    playerData = {
                        username: data.username,
                        position: { x: 0, y: 10, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 }
                    };
                    players.set(ws, playerData);
                    
                    // Send current players to new player
                    const existingPlayers = Array.from(players.values());
                    ws.send(JSON.stringify({
                        type: 'players',
                        players: existingPlayers
                    }));
                    
                    // Broadcast new player to others
                    broadcast({
                        type: 'playerJoined',
                        player: playerData
                    }, ws);
                    break;

                case 'position':
                    if (playerData) {
                        playerData.position = data.position;
                        playerData.rotation = data.rotation;
                        
                        // Broadcast position update
                        broadcast({
                            type: 'playerMoved',
                            username: playerData.username,
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
        if (playerData) {
            // Broadcast player left
            broadcast({
                type: 'playerLeft',
                username: playerData.username
            });
            players.delete(ws);
        }
        console.log('Client disconnected');
    });
});

// Broadcast to all clients except sender
function broadcast(message, sender = null) {
    wss.clients.forEach((client) => {
        if (client !== sender && client.readyState === 1) {
            client.send(JSON.stringify(message));
        }
    });
} 