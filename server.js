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

// World generation constants
const WORLD_CONSTANTS = {
    numTowers: 3000,
    maxRadius: 4800,
    numNebulas: 12,
    nebulaRadius: 4500,
    numStars: 30000,
    numLargeStars: 1000,
    starRadius: 5400,
    largeStarRadius: 1800,
    gridSize: 6000,
    farGridSize: 12000,
    midGridSize: 9000
};

// World generation functions
function generateWorld() {
    const world = {
        towers: [],
        nebulas: [],
        stars: [],
        largeStars: [],
        grid: {
            size: WORLD_CONSTANTS.gridSize,
            divisions: 300,
            opacity: 0.75
        },
        farGrid: {
            size: WORLD_CONSTANTS.farGridSize,
            divisions: 150,
            opacity: 0.3
        },
        midGrid: {
            size: WORLD_CONSTANTS.midGridSize,
            divisions: 225,
            opacity: 0.5
        }
    };

    // Generate towers
    const gridSize = Math.sqrt(WORLD_CONSTANTS.numTowers);
    const spacing = (WORLD_CONSTANTS.maxRadius * 2) / gridSize;
    const towerPositions = [];

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const x = -WORLD_CONSTANTS.maxRadius + i * spacing + (Math.random() * spacing * 0.5);
            const z = -WORLD_CONSTANTS.maxRadius + j * spacing + (Math.random() * spacing * 0.5);
            
            const offsetX = (Math.random() - 0.5) * spacing * 0.5;
            const offsetZ = (Math.random() - 0.5) * spacing * 0.5;
            
            const finalX = x + offsetX;
            const finalZ = z + offsetZ;
            
            const towerType = Math.floor(Math.random() * 12);
            const height = Math.random() * 300 + 150;
            const isFloating = Math.random() < 0.15;
            const baseHeight = isFloating ? Math.random() * 30 + 15 : 0;

            world.towers.push({
                type: towerType,
                position: { x: finalX, y: height/2 + baseHeight, z: finalZ },
                height: height,
                isFloating: isFloating,
                baseHeight: baseHeight
            });

            towerPositions.push({
                position: { x: finalX, y: height/2, z: finalZ },
                height: height
            });
        }
    }

    // Generate bridges between towers
    const maxBridgeDistance = spacing * 2;
    const bridgeChance = 0.1;
    
    for (let i = 0; i < towerPositions.length; i++) {
        for (let j = i + 1; j < towerPositions.length; j++) {
            const tower1 = towerPositions[i];
            const tower2 = towerPositions[j];
            
            const distance = Math.sqrt(
                Math.pow(tower1.position.x - tower2.position.x, 2) +
                Math.pow(tower1.position.y - tower2.position.y, 2) +
                Math.pow(tower1.position.z - tower2.position.z, 2)
            );
            
            if (distance <= maxBridgeDistance && Math.random() < bridgeChance) {
                const minHeight = Math.min(tower1.height, tower2.height);
                const bridgeHeight = minHeight * (0.3 + Math.random() * 0.5);
                
                world.towers.push({
                    type: 'bridge',
                    startPos: { x: tower1.position.x, y: bridgeHeight, z: tower1.position.z },
                    endPos: { x: tower2.position.x, y: bridgeHeight, z: tower2.position.z }
                });
            }
        }
    }

    // Generate nebulas
    for (let i = 0; i < WORLD_CONSTANTS.numNebulas; i++) {
        const angle = (i / WORLD_CONSTANTS.numNebulas) * Math.PI * 2;
        world.nebulas.push({
            position: {
                x: Math.cos(angle) * WORLD_CONSTANTS.nebulaRadius,
                y: Math.random() * 2400 - 600,
                z: Math.sin(angle) * WORLD_CONSTANTS.nebulaRadius
            },
            scale: 4 + Math.random() * 6,
            rotation: {
                x: Math.random() * Math.PI,
                y: Math.random() * Math.PI,
                z: Math.random() * Math.PI
            }
        });
    }

    // Generate stars
    for (let i = 0; i < WORLD_CONSTANTS.numStars; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        world.stars.push({
            position: {
                x: WORLD_CONSTANTS.starRadius * Math.sin(phi) * Math.cos(theta),
                y: WORLD_CONSTANTS.starRadius * Math.sin(phi) * Math.sin(theta),
                z: WORLD_CONSTANTS.starRadius * Math.cos(phi)
            }
        });
    }

    // Generate large stars
    for (let i = 0; i < WORLD_CONSTANTS.numLargeStars; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        world.largeStars.push({
            position: {
                x: WORLD_CONSTANTS.largeStarRadius * Math.sin(phi) * Math.cos(theta),
                y: WORLD_CONSTANTS.largeStarRadius * Math.sin(phi) * Math.sin(theta),
                z: WORLD_CONSTANTS.largeStarRadius * Math.cos(phi)
            }
        });
    }

    return world;
}

// Room management
class GameRoom {
    constructor(id) {
        this.id = id;
        this.name = generateRoomName();
        this.players = new Map();
        this.isActive = true;
        this.world = null; // Will be generated when first player joins
        this.lastActivity = Date.now();
    }

    addPlayer(ws, username) {
        this.players.set(ws, {
            username: username,
            position: { x: 0, y: 10, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            lastActivity: Date.now()
        });
        this.lastActivity = Date.now();

        // Generate world if this is the first player
        if (!this.world) {
            this.world = generateWorld();
        }
        
        // Send world data to the new player
        ws.send(JSON.stringify({
            type: 'world_data',
            world: this.world
        }));
        
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
                            
                            currentRoom.broadcast(JSON.stringify({
                                type: 'position',
                                username: player.username,
                                position: data.position,
                                rotation: data.rotation
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