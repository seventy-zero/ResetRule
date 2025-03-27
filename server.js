const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// World generation constants
const NUM_TOWERS = 3000;
const MAX_RADIUS = 4800;
const BRIDGE_CHANCE = 0.06;
const NUM_ORBS = 120;

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

// World generation functions
function createTower(type, x, z) {
    const height = Math.random() < 0.08 ? // 8% chance for tall towers
        Math.random() * 600 + 400 : // 400-1000 units for tall towers
        Math.random() * 400 + 200; // 200-600 units for normal towers
    
    const isFloating = Math.random() < 0.18; // Slightly increased from 0.15
    const baseHeight = isFloating ? Math.random() * 40 + 20 : 0; // Increased floating height range
    
    return {
        type,
        x,
        z,
        height,
        baseHeight,
        isFloating
    };
}

function createBridge(startPos, endPos) {
    return {
        startX: startPos.x,
        startZ: startPos.z,
        endX: endPos.x,
        endZ: endPos.z,
        height: startPos.y
    };
}

function generateWorld() {
    const towers = [];
    const bridges = [];
    const orbs = [];
    const towerPositions = [];
    
    console.log('Starting world generation...');
    
    // Create a grid of towers with balanced spacing
    const gridSize = Math.sqrt(NUM_TOWERS);
    const baseSpacing = (MAX_RADIUS * 2) / gridSize;
    
    // Place towers with balanced clustering
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            // Balanced spacing variation
            const spacing = baseSpacing * (Math.random() < 0.25 ? 0.6 : 1.0); // 25% chance for moderate clusters
            
            const x = -MAX_RADIUS + i * baseSpacing + (Math.random() * spacing * 0.6);
            const z = -MAX_RADIUS + j * baseSpacing + (Math.random() * spacing * 0.6);
            
            // Moderate random offset
            const offsetX = (Math.random() - 0.5) * spacing * 0.6;
            const offsetZ = (Math.random() - 0.5) * spacing * 0.6;
            
            const finalX = x + offsetX;
            const finalZ = z + offsetZ;
            
            // Balanced tower type distribution
            let towerType;
            const rand = Math.random();
            if (rand < 0.08) { // 8% chance for special towers
                towerType = Math.floor(Math.random() * 3) + 9;
            } else if (rand < 0.25) { // 17% chance for medium towers
                towerType = Math.floor(Math.random() * 3) + 6;
            } else { // 75% chance for basic towers
                towerType = Math.floor(Math.random() * 6);
            }
            
            const tower = createTower(towerType, finalX, finalZ);
            towers.push(tower);
            
            towerPositions.push({
                position: { x: finalX, y: tower.height/2, z: finalZ },
                height: tower.height
            });
        }
    }
    
    console.log(`Generated ${towers.length} towers`);
    
    // Generate bridges with reduced frequency
    const maxBridgeDistance = baseSpacing * 1.8; // Reduced from 2.2
    
    for (let i = 0; i < towerPositions.length; i++) {
        for (let j = i + 1; j < towerPositions.length; j++) {
            const tower1 = towerPositions[i];
            const tower2 = towerPositions[j];
            
            const distance = Math.sqrt(
                Math.pow(tower1.position.x - tower2.position.x, 2) +
                Math.pow(tower1.position.z - tower2.position.z, 2)
            );
            
            // Only generate bridges between towers of similar heights
            const heightDiff = Math.abs(tower1.height - tower2.height);
            const maxHeightDiff = Math.min(tower1.height, tower2.height) * 0.3; // 30% height difference max
            
            if (distance <= maxBridgeDistance && 
                heightDiff <= maxHeightDiff && 
                Math.random() < BRIDGE_CHANCE) {
                const minHeight = Math.min(tower1.height, tower2.height);
                const bridgeHeight = minHeight * (0.3 + Math.random() * 0.4); // More consistent bridge heights
                
                const startPos = {
                    x: tower1.position.x,
                    y: bridgeHeight,
                    z: tower1.position.z
                };
                const endPos = {
                    x: tower2.position.x,
                    y: bridgeHeight,
                    z: tower2.position.z
                };
                
                bridges.push(createBridge(startPos, endPos));
            }
        }
    }
    
    console.log(`Generated ${bridges.length} bridges`);

    // Generate orbs
    console.log(`Starting orb generation (${NUM_ORBS} orbs)...`);
    let successfulOrbs = 0;
    
    for (let i = 0; i < NUM_ORBS; i++) {
        let validPosition = false;
        let attempts = 0;
        const maxAttempts = 100; // Increased max attempts
        
        while (!validPosition && attempts < maxAttempts) {
            const x = (Math.random() - 0.5) * MAX_RADIUS * 2;
            const z = (Math.random() - 0.5) * MAX_RADIUS * 2;
            
            // Simple height distribution
            const y = Math.random() * 200 + 50; // Height between 50 and 250
            
            // Check if we're inside a tower with more lenient distance
            let insideTower = false;
            for (const tower of towers) {
                const distance = Math.sqrt(
                    Math.pow(x - tower.x, 2) + 
                    Math.pow(z - tower.z, 2)
                );
                if (distance < 2) { // Increased from 0.5 to 2 to be more lenient
                    insideTower = true;
                    break;
                }
            }
            
            if (!insideTower) {
                validPosition = true;
                const color = Math.floor(Math.random() * 0xFFFFFF); // Random color
                const size = Math.random() * 0.5 + 0.5; // Size between 0.5 and 1

                const orb = {
                    id: i,
                    position: { x, y, z },
                    color,
                    size
                };
                
                orbs.push(orb);
                successfulOrbs++;
                
                if (i % 5 === 0) { // Log more frequently
                    console.log(`Generated orb ${successfulOrbs}/${NUM_ORBS}:`, orb);
                }
            }
            
            attempts++;
        }
        
        if (!validPosition) {
            // If we couldn't find a valid position after max attempts,
            // force place the orb at a random position
            const x = (Math.random() - 0.5) * MAX_RADIUS * 2;
            const z = (Math.random() - 0.5) * MAX_RADIUS * 2;
            const y = Math.random() * 200 + 50;
            const color = Math.floor(Math.random() * 0xFFFFFF);
            const size = Math.random() * 0.5 + 0.5;

            const orb = {
                id: i,
                position: { x, y, z },
                color,
                size
            };
            
            orbs.push(orb);
            successfulOrbs++;
            console.log(`Force placed orb ${successfulOrbs}/${NUM_ORBS} after failed attempts:`, orb);
        }
    }
    
    console.log(`Successfully generated ${successfulOrbs} out of ${NUM_ORBS} orbs`);
    console.log('World generation complete');
    
    return { towers, bridges, orbs };
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
        this.world = generateWorld(); // Generate world when room is created
        console.log(`Room ${this.name} created with ${this.world.orbs.length} orbs`);
    }

    addPlayer(ws, username) {
        this.players.set(ws, {
            username: username,
            position: { x: 0, y: 10, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            lastActivity: Date.now()
        });
        this.lastActivity = Date.now();
        
        // Log world data before sending
        console.log(`Sending world data to ${username}:`, {
            towers: this.world.towers.length,
            bridges: this.world.bridges.length,
            orbs: this.world.orbs.length
        });
        
        // Send world data to the new player
        ws.send(JSON.stringify({
            type: 'world_data',
            towers: this.world.towers,
            bridges: this.world.bridges,
            orbs: this.world.orbs
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

                case 'request_world_data':
                    if (currentRoom) {
                        // Send world data to the requesting player
                        ws.send(JSON.stringify({
                            type: 'world_data',
                            towers: currentRoom.world.towers,
                            bridges: currentRoom.world.bridges,
                            orbs: currentRoom.world.orbs
                        }));
                    }
                    break;

                case 'collect_orb':
                    if (currentRoom) {
                        const player = currentRoom.players.get(ws);
                        if (player) {
                            // Find the orb in the room's world
                            const orbIndex = currentRoom.world.orbs.findIndex(orb => orb.id === data.orbId);
                            if (orbIndex !== -1) {
                                // Remove the orb from the world
                                currentRoom.world.orbs.splice(orbIndex, 1);
                                
                                // Broadcast orb collection to all players in the room
                                currentRoom.broadcast(JSON.stringify({
                                    type: 'orb_collected',
                                    orbId: data.orbId,
                                    username: player.username
                                }));
                            }
                        }
                    }
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

                case 'shotgun_shot':
                    if (currentRoom) {
                        const shooter = currentRoom.players.get(ws);
                        if (shooter) {
                            // Broadcast shot to all players in the room
                            currentRoom.broadcast(JSON.stringify({
                                type: 'shotgun_shot',
                                username: shooter.username,
                                position: data.position,
                                directions: data.directions
                            }), ws);

                            // Check for hits on other players
                            currentRoom.players.forEach((player, playerWs) => {
                                if (playerWs === ws) return; // Skip shooter

                                const playerPos = new THREE.Vector3(
                                    player.position[0],
                                    player.position[1],
                                    player.position[2]
                                );
                                const shooterPos = new THREE.Vector3(
                                    data.position[0],
                                    data.position[1],
                                    data.position[2]
                                );
                                
                                const distance = playerPos.distanceTo(shooterPos);
                                
                                // Check if player is within range (10 units)
                                if (distance <= 10) {
                                    // Check each pellet direction
                                    data.directions.forEach(pelletDir => {
                                        const direction = new THREE.Vector3(
                                            pelletDir[0],
                                            pelletDir[1],
                                            pelletDir[2]
                                        ).normalize();
                                        
                                        const toPlayer = playerPos.clone()
                                            .sub(shooterPos)
                                            .normalize();
                                        
                                        // Calculate angle between shot and player
                                        const angle = direction.angleTo(toPlayer);
                                        
                                        // If player is within the cone (45 degrees = 0.785 radians)
                                        if (angle <= 0.785) {
                                            // Send damage message to hit player
                                            playerWs.send(JSON.stringify({
                                                type: 'player_damaged',
                                                username: player.username,
                                                damage: 20 // Damage per pellet
                                            }));
                                        }
                                    });
                                }
                            });
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

// Create an object pool for frequently created/destroyed objects
const objectPool = {
    pool: [],
    get: function() {
        return this.pool.pop() || this.createNew();
    },
    release: function(obj) {
        this.pool.push(obj);
    }
};

// Add to renderer setup
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // Limit pixel ratio
renderer.shadowMap.enabled = false; // Disable shadows if not needed

// Vector math helper functions
function Vector3(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
}

Vector3.prototype.clone = function() {
    return new Vector3(this.x, this.y, this.z);
};

Vector3.prototype.sub = function(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
};

Vector3.prototype.length = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
};

Vector3.prototype.normalize = function() {
    const len = this.length();
    if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
    }
    return this;
};

function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function angleBetween(v1, v2) {
    const dot = dotProduct(v1, v2);
    return Math.acos(Math.min(Math.max(dot, -1), 1));
}

// Handle shotgun shot
socket.on('shotgunShot', (data) => {
    const shooter = players.get(socket.id);
    if (!shooter) return;

    const shotData = {
        position: data.position,
        direction: data.direction,
        shooterId: socket.id,
        pellets: data.pellets
    };

    // Broadcast to all players
    io.emit('shotgunShot', shotData);

    // Check for hits on other players
    players.forEach((player, playerId) => {
        if (playerId === socket.id) return; // Skip shooter

        // Check if player is within the cone of effect
        const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
        const shooterPos = new Vector3(data.position.x, data.position.y, data.position.z);
        const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
        
        // Calculate vector from shooter to player
        const toPlayer = playerPos.clone().sub(shooterPos);
        const distance = toPlayer.length();
        
        // Check if player is within the cone's range (10 units)
        if (distance <= 10) {
            // Calculate angle between shot direction and player
            toPlayer.normalize();
            const angle = angleBetween(direction, toPlayer);
            
            // Cone angle is about 45 degrees (0.785 radians)
            if (angle <= 0.785) {
                // Player is hit, apply damage
                player.health -= 20; // Shotgun damage per pellet
                if (player.health <= 0) {
                    // Player died, drop their orbs
                    const dropOrbs = player.orbs; // Drop 100% of orbs
                    if (dropOrbs > 0) {
                        // Drop orbs in a spread pattern around death location
                        for (let i = 0; i < dropOrbs; i++) {
                            const spread = 10; // Spread radius
                            const angle = (Math.PI * 2 * i) / dropOrbs; // Evenly distribute in a circle
                            const x = player.position.x + Math.cos(angle) * spread;
                            const z = player.position.z + Math.sin(angle) * spread;
                            const y = Math.random() * 100 + 50; // Random height between 50 and 150

                            const color = Math.floor(Math.random() * 0xFFFFFF);
                            const size = Math.random() * 0.5 + 0.5;

                            const orb = {
                                id: orbs.length,
                                position: { x, y, z },
                                color,
                                size
                            };
                            orbs.push(orb);
                        }
                        player.orbs = 0; // Set to 0 since all orbs were dropped
                    }
                    player.health = 100;
                    player.position = getRandomSpawnPoint();
                }
                io.emit('playerHealthUpdate', { id: playerId, health: player.health });
            }
        }
    });
}); 