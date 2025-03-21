const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    clientTracking: true,
    // Add error handling for connections
    handleProtocols: (protocols, req) => {
        return protocols[0];
    }
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Add a health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Store connected players with last activity timestamp
const players = new Map();
const MAX_PLAYERS = 20;
const INACTIVE_TIMEOUT = 10000; // 10 seconds in milliseconds

// Cleanup inactive players periodically
function cleanupInactivePlayers() {
    const now = Date.now();
    let cleanedCount = 0;
    
    players.forEach((player, username) => {
        if (now - player.lastActivity > INACTIVE_TIMEOUT) {
            // Player hasn't moved in 5 seconds, remove them
            players.delete(username);
            cleanedCount++;
            
            // Notify all clients about the removed player
            broadcast({
                type: 'playerLeft',
                username: username
            });
            
            console.log(`Removed inactive player: ${username}`);
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} inactive players. Active players: ${players.size}`);
    }
}

// Run cleanup every 5 seconds
setInterval(cleanupInactivePlayers, 5000);

// Handle WebSocket errors
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

wss.on('connection', (ws, req) => {
    console.log('New connection from:', req.socket.remoteAddress);
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

                    // Add new player with initial activity timestamp
                    players.set(playerUsername, {
                        ws,
                        position: [0, 10, 0],
                        rotation: [0, 0, 0],
                        username: playerUsername,
                        lastActivity: Date.now()
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
                        player.lastActivity = Date.now(); // Update last activity time

                        // Broadcast position update to other players
                        broadcast({
                            type: 'playerMoved',
                            username: playerUsername,
                            position: data.position,
                            rotation: data.rotation
                        }, ws);
                    }
                    break;

                case 'playerLeft':
                    if (playerUsername && players.has(playerUsername)) {
                        players.delete(playerUsername);
                        
                        // Broadcast to ALL clients, including the sender
                        broadcast({
                            type: 'playerLeft',
                            username: playerUsername
                        });

                        console.log(`Player left: ${playerUsername} (${players.size} players online)`);
                        playerUsername = ''; // Clear the username
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('error', (error) => {
        console.error(`WebSocket Error for ${playerUsername}:`, error);
    });

    ws.on('close', () => {
        if (playerUsername && players.has(playerUsername)) {
            players.delete(playerUsername);
            
            // Broadcast to ALL clients that the player has left
            broadcast({
                type: 'playerLeft',
                username: playerUsername
            });

            console.log(`Player disconnected: ${playerUsername} (${players.size} players online)`);
        }
    });
});

// Broadcast message to all clients except sender
function broadcast(message, exclude = null) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && (exclude === null || client !== exclude)) {
            client.send(messageStr);
        }
    });
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}); 