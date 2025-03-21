const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Word lists for room names
const adjectives = [
    'Cosmic', 'Stellar', 'Lunar', 'Solar', 'Astral',
    'Nebula', 'Quantum', 'Galactic', 'Celestial', 'Orbital',
    'Crystal', 'Aurora', 'Nova', 'Plasma', 'Photon',
    'Meteor', 'Comet', 'Star', 'Void', 'Zenith',
    'Echo', 'Pulse', 'Wave', 'Flux', 'Prism',
    'Azure', 'Crimson', 'Emerald', 'Golden', 'Silver'
];

const nouns = [
    'Horizon', 'Nexus', 'Portal', 'Gateway', 'Station',
    'Outpost', 'Haven', 'Sanctuary', 'Beacon', 'Core',
    'Matrix', 'Vertex', 'Domain', 'Realm', 'Zone',
    'Sector', 'Field', 'Grid', 'Sphere', 'Chamber',
    'Circuit', 'Network', 'System', 'Array', 'Node',
    'Orbit', 'Path', 'Stream', 'Channel', 'Link'
];

// Function to generate a random room name
function generateRoomName() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective}-${noun}`;
}

// Serve static files
app.use(express.static(path.join(__dirname)));

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

// Room management
class GameRoom {
    constructor(id) {
        this.id = id;
        this.name = generateRoomName();
        this.players = new Map();
        this.isActive = true;
        this.lastActivity = Date.now();
    }

    addPlayer(ws, username) {
        this.players.set(ws, {
            username: username,
            position: { x: 0, y: 10, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            health: 10,
            lastActivity: Date.now()
        });
        this.lastActivity = Date.now();
        
        // Broadcast updated player count to all players in the room
        this.broadcastRoomInfo();
    }

    removePlayer(ws) {
        const player = this.players.get(ws);
        if (player) {
            // Broadcast that the player left
            this.broadcast(JSON.stringify({
                type: 'player_left',
                username: player.username
            }));
            
            // Remove the player
            this.players.delete(ws);
            
            // Broadcast updated player count
            this.broadcastRoomInfo();
            
            // Mark room as inactive if empty
            if (this.players.size === 0) {
                this.isActive = false;
            }
        }
    }

    broadcastRoomInfo() {
        const info = {
            type: 'room_info',
            id: this.id,
            name: this.name,
            playerCount: this.players.size
        };
        this.broadcast(JSON.stringify(info));
    }

    isFull() {
        return this.players.size >= 20;
    }

    broadcast(message, excludeWs = null) {
        this.players.forEach((playerData, ws) => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    cleanup() {
        // Remove disconnected players
        this.players.forEach((playerData, ws) => {
            if (ws.readyState !== WebSocket.OPEN) {
                this.removePlayer(ws);
            }
        });
    }
}

// Rooms management
let rooms = [];
let nextRoomId = 1;

function createNewRoom() {
    const room = new GameRoom(nextRoomId++);
    rooms.push(room);
    console.log(`Created new room: ${room.name} (ID: ${room.id})`);
    return room;
}

function findAvailableRoom() {
    // First, try to find an existing room that's not full
    let room = rooms.find(r => r.isActive && !r.isFull());
    
    // If no available room found, create a new one
    if (!room) {
        room = createNewRoom();
    }
    
    return room;
}

// Clean up inactive rooms and disconnected players more frequently
setInterval(() => {
    // Clean up each room
    rooms.forEach(room => {
        room.cleanup();
    });
    
    // Remove inactive rooms
    rooms = rooms.filter(room => room.isActive);
}, 10000); // Check every 10 seconds

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    currentRoom = findAvailableRoom();
                    currentRoom.addPlayer(ws, data.username);
                    
                    // Send initial room information to the new player
                    ws.send(JSON.stringify({
                        type: 'room_info',
                        id: currentRoom.id,
                        name: currentRoom.name,
                        playerCount: currentRoom.players.size
                    }));

                    // Send existing players to the new player
                    currentRoom.players.forEach((playerData, playerWs) => {
                        if (playerWs !== ws) {
                            ws.send(JSON.stringify({
                                type: 'player_joined',
                                username: playerData.username,
                                position: playerData.position,
                                rotation: playerData.rotation
                            }));
                        }
                    });

                    // Broadcast new player to all other players in the room
                    currentRoom.broadcast(JSON.stringify({
                        type: 'player_joined',
                        username: data.username,
                        position: { x: 0, y: 10, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 }
                    }), ws);
                    break;

                case 'position':
                    if (currentRoom) {
                        const player = currentRoom.players.get(ws);
                        if (player) {
                            player.position = data.position;
                            player.rotation = data.rotation;
                            if (data.health !== undefined) {
                                player.health = data.health;
                            }
                            
                            currentRoom.broadcast(JSON.stringify({
                                type: 'position',
                                username: player.username,
                                position: data.position,
                                rotation: data.rotation,
                                health: player.health
                            }), ws);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (currentRoom) {
            currentRoom.removePlayer(ws);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        if (currentRoom) {
            currentRoom.removePlayer(ws);
        }
    });
});

// Handle errors
wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
}); 