const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// World generation constants
const NUM_TOWERS = 3000;
const MAX_RADIUS = 4800;
const BRIDGE_CHANCE = 0.12;
const NUM_ORBS = 120;

// Tower dimensions
const TOWER_RADIUS = 60; // Reduced from 75
const TOWER_WIDTH = 120; // Reduced from 150
const TOWER_DEPTH = 120; // Reduced from 150

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
    // Increased height ranges for more dramatic towers
    const height = Math.random() < 0.08 ? // 8% chance for tall towers
        Math.random() * 800 + 600 : // 600-1400 units for tall towers
        Math.random() * 500 + 300; // 300-800 units for normal towers
    
    const isFloating = Math.random() < 0.18;
    const baseHeight = isFloating ? Math.random() * 40 + 20 : 0;
    
    return {
        type,
        x,
        z,
        height,
        baseHeight,
        isFloating,
        radius: TOWER_RADIUS,
        width: TOWER_WIDTH,
        depth: TOWER_DEPTH
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
    
    // Generate bridges with improved connectivity
    const maxBridgeDistance = baseSpacing * 3.0;
    
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
            const maxHeightDiff = Math.min(tower1.height, tower2.height) * 0.3;
            
            // Check if towers are close enough and similar in height
            if (distance <= maxBridgeDistance && heightDiff <= maxHeightDiff) {
                // Increase bridge chance for closer towers
                const distanceFactor = 1 - (distance / maxBridgeDistance);
                const adjustedBridgeChance = BRIDGE_CHANCE * (1 + distanceFactor * 0.5);
                
                // Check for nearby bridges to avoid overcrowding
                let nearbyBridges = 0;
                for (const bridge of bridges) {
                    const distToTower1 = Math.sqrt(
                        Math.pow(bridge.startX - tower1.position.x, 2) +
                        Math.pow(bridge.startZ - tower1.position.z, 2)
                    );
                    const distToTower2 = Math.sqrt(
                        Math.pow(bridge.endX - tower2.position.x, 2) +
                        Math.pow(bridge.endZ - tower2.position.z, 2)
                    );
                    
                    if (distToTower1 < maxBridgeDistance * 0.5 || distToTower2 < maxBridgeDistance * 0.5) {
                        nearbyBridges++;
                    }
                }
                
                // Reduce chance if there are too many nearby bridges
                const crowdingFactor = Math.max(0, 1 - (nearbyBridges * 0.2));
                const finalBridgeChance = adjustedBridgeChance * crowdingFactor;
                
                if (Math.random() < finalBridgeChance) {
                    const minHeight = Math.min(tower1.height, tower2.height);
                    const bridgeHeight = minHeight * (0.35 + Math.random() * 0.3);
                    
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
            
            // Increase vertical range for orbs
            const y = Math.random() * 800 + 50; // Height between 30 and 1030 (was 50-250)
            
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
            const y = Math.random() * 1000 + 30;
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
        this.currentRuler = null; // Track the current ruler
        this.playerOrbs = new Map(); // <-- Track orb counts per player (ws -> count)
        this.lastOrbId = this.world.orbs.reduce((maxId, orb) => Math.max(maxId, orb.id), 0); // <-- Initialize max orb ID
        console.log(`Room ${this.name} created with ${this.world.orbs.length} orbs. Max initial Orb ID: ${this.lastOrbId}`);
    }

    addPlayer(ws, username) {
        this.players.set(ws, {
            username: username,
            position: { x: 0, y: 10, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            lastActivity: Date.now()
        });
        this.playerOrbs.set(ws, 0); // <-- Initialize player orb count
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

    // --- NEW HELPER FUNCTION to drop orbs ---
    dropPlayerOrbs(ws, deathPosition = null) {
        const player = this.players.get(ws);
        if (!player) {
            console.warn("[DropOrbs Debug] Attempted to drop orbs for a player no longer in the room or not found."); // Added detail
            return;
        }

        const orbCount = this.playerOrbs.get(ws) || 0;
        console.log(`[DropOrbs Debug] Called for user: ${player.username}. Orb count: ${orbCount}. Death Pos: ${deathPosition}`); // Added log

        // --- Add early exit and log if no orbs ---
        if (orbCount <= 0) {
            console.log(`[DropOrbs Debug] Player ${player.username} had 0 orbs. Nothing to drop.`);
            return; // Exit early if no orbs
        }
        // -----------------------------------------

        if (orbCount > 0) { // This check is slightly redundant now but safe
            const droppedOrbsData = [];
            // Use provided death position or player's last known position
            const position = deathPosition ? deathPosition : [player.position.x, player.position.y, player.position.z];
            const dropRadius = 5;
            console.log(`[DropOrbs Debug] Using position ${position} for ${player.username}`); // Log position used

            for (let i = 0; i < orbCount; i++) {
                this.lastOrbId++;
                const neonColors = [
                    0x39FF14, 0x1B03A3, 0xBC13FE, 0xFF10F0
                ];
                const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
                const orbRadius = 6;
                const randomAngle = Math.random() * Math.PI * 2;
                const randomDist = Math.random() * dropRadius;
                const orbX = position[0] + Math.cos(randomAngle) * randomDist;
                const orbY = position[1] + 1;
                const orbZ = position[2] + Math.sin(randomAngle) * randomDist;

                const newOrbData = {
                    id: this.lastOrbId,
                    position: { x: orbX, y: orbY, z: orbZ },
                    color: randomColor,
                    size: orbRadius
                };

                this.world.orbs.push(newOrbData);
                droppedOrbsData.push(newOrbData);
                console.log(`[DropOrbs Debug] Generated orb ${this.lastOrbId}:`, newOrbData); // Added log
            }

            // Reset player's orb count (important!)
            this.playerOrbs.set(ws, 0);
            console.log(`[DropOrbs Debug] Reset orb count for ${player.username} to 0.`); // Added log

            if (droppedOrbsData.length > 0) {
                // --- Log before broadcast ---
                console.log(`[DropOrbs Debug] Broadcasting ${droppedOrbsData.length} orbs. Data:`, JSON.stringify(droppedOrbsData));
                // --------------------------
                this.broadcast(JSON.stringify({
                    type: 'orbs_dropped',
                    orbs: droppedOrbsData
                }));
            }
        }
    }
    // --- END HELPER FUNCTION ---

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
            this.playerOrbs.delete(ws); // <-- Remove from orb tracking
            
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

    handleMessage(ws, data) {
        switch (data.type) {
            case 'join':
                this.addPlayer(ws, data.username);
                
                // Send initial room information to the new player
                ws.send(JSON.stringify({
                    type: 'room_info',
                    id: this.id,
                    name: this.name,
                    playerCount: this.players.size
                }));

                // Send existing players to the new player
                this.players.forEach((playerData, playerWs) => {
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
                this.broadcast(JSON.stringify({
                    type: 'player_joined',
                    username: data.username,
                    position: { x: 0, y: 10, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 }
                }), ws);
                break;

            case 'request_world_data':
                // Send world data to the requesting player
                ws.send(JSON.stringify({
                    type: 'world_data',
                    towers: this.world.towers,
                    bridges: this.world.bridges,
                    orbs: this.world.orbs
                }));
                break;

            case 'collect_orb':
                const player = this.players.get(ws);
                if (player) {
                    // --- ADD CHECK FOR SERVER-SIDE ORB COUNT ---
                    const currentServerOrbCount = this.playerOrbs.get(ws) || 0;
                    if (currentServerOrbCount >= 30) {
                        console.log(`[Orb Cap Debug] Player ${player.username} tried to collect orb ${data.orbId} but already has ${currentServerOrbCount}. Ignoring.`);
                        break; // Ignore the request
                    }
                    // ------------------------------------------

                    // Find the orb in the room's world
                    const orbIndex = this.world.orbs.findIndex(orb => orb.id === data.orbId);
                    if (orbIndex !== -1) {
                        // Remove the orb from the world
                        this.world.orbs.splice(orbIndex, 1);

                        // --- Update player's orb count (Use the checked count) ---
                        this.playerOrbs.set(ws, currentServerOrbCount + 1);
                        console.log(`Player ${player.username} collected orb ${data.orbId}. New count: ${currentServerOrbCount + 1}`);
                        // --------------------------------

                        // Broadcast orb collection to all players in the room
                        this.broadcast(JSON.stringify({
                            type: 'orb_collected',
                            orbId: data.orbId,
                            username: player.username
                        }));
                    }
                }
                break;

            case 'position':
                const playerData = this.players.get(ws);
                if (playerData) {
                    playerData.position = data.position;
                    playerData.rotation = data.rotation;
                    
                    this.broadcast(JSON.stringify({
                        type: 'position',
                        username: playerData.username,
                        position: data.position,
                        rotation: data.rotation
                    }), ws);
                }
                break;

            case 'shotgun_shot':
                const shooter = this.players.get(ws);
                if (shooter) {
                    // Broadcast shot to all players in the room
                    this.broadcast(JSON.stringify({
                        type: 'shotgun_shot',
                        username: shooter.username,
                        position: data.position,
                        directions: data.directions
                    }), ws);
                }
                break;

            case 'new_ruler':
                if (!this.currentRuler) {
                    this.currentRuler = data.username;
                    this.broadcast(JSON.stringify({
                        type: 'new_ruler',
                        username: data.username
                    }));
                }
                break;

            case 'reset_game':
                // Reset the world
                this.world = generateWorld();
                this.lastOrbId = this.world.orbs.reduce((maxId, orb) => Math.max(maxId, orb.id), 0); // Re-init max orb ID
                this.currentRuler = null;
                
                // Reset all players
                this.players.forEach((player, playerWs) => {
                    player.position = { x: 0, y: 10, z: 0 };
                    player.rotation = { x: 0, y: 0, z: 0 };
                    // NOTE: Health is client-side, no need to reset here
                    // NOTE: Resetting orb count server-side:
                    this.playerOrbs.set(playerWs, 0);
                    
                    // Send reset message to each player
                    playerWs.send(JSON.stringify({
                        type: 'reset_game'
                    }));
                });

                // Broadcast new world data to all players
                this.broadcast(JSON.stringify({
                    type: 'world_data',
                    towers: this.world.towers,
                    bridges: this.world.bridges,
                    orbs: this.world.orbs
                }));
                break;

            case 'player_damaged':
                const victimUsername = data.victimUsername;
                let victimWs = null;

                // Find the victim's WebSocket connection
                this.players.forEach((playerData, ws) => {
                    if (playerData.username === victimUsername) {
                        victimWs = ws;
                    }
                });

                // If victim found and connection is open, send them the damage message
                if (victimWs && victimWs.readyState === WebSocket.OPEN) {
                    console.log(`[Server Debug] Relaying player_damaged message to ${victimUsername}`); // Log relay
                    victimWs.send(JSON.stringify({
                        type: 'player_damaged',
                        victimUsername: victimUsername,
                        attackerUsername: data.attackerUsername, // Pass attacker info
                        damage: data.damage             // Pass damage amount
                    }));
                } else {
                    console.log(`[Server Debug] Could not find or send player_damaged message to ${victimUsername}`);
                }
                break;

            case 'player_died': // <-- NEW CASE
                const deadPlayerWs = [...this.players.entries()].find(([socket, playerData]) => playerData.username === data.username)?.[0];
                
                if (deadPlayerWs) {
                    // --- Call helper function to drop orbs --- 
                    this.dropPlayerOrbs(deadPlayerWs, data.position);
                    // ---------------------------------------
                } else {
                    console.warn(`Received player_died message for unknown player: ${data.username}`);
                }
                break;
        }
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
    let playerUsernameForLog = 'unknown'; // Store username for logging on close

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Assign player to a room on first message (e.g., join)
            if (!currentRoom) {
                currentRoom = findAvailableRoom();
                console.log(`[Connection] Assigning new connection to room: ${currentRoom.name}`);
            }

            // Store username if it's a join message for logging
            if (data.type === 'join' && data.username) {
                 playerUsernameForLog = data.username;
                 console.log(`[Connection] WebSocket associated with username: ${playerUsernameForLog}`);
            }

            currentRoom.handleMessage(ws, data);

        } catch (error) {
            console.error('Error processing message:', error);
            // Attempt removal if error occurs after room assignment
             if (currentRoom) {
                 console.error(`Removing player ${playerUsernameForLog} due to message processing error.`);
                 currentRoom.dropPlayerOrbs(ws); // Try dropping orbs first
                 currentRoom.removePlayer(ws);
             }
        }
    });

    ws.on('close', () => {
        console.log(`[Connection] WebSocket closed for player: ${playerUsernameForLog}.`);
        if (currentRoom) {
            console.log(`[Connection] Attempting orb drop for ${playerUsernameForLog} in room ${currentRoom.name} before removal.`);
            currentRoom.dropPlayerOrbs(ws); // <<< Drop orbs here
            console.log(`[Connection] Proceeding to remove player ${playerUsernameForLog} from room ${currentRoom.name}.`);
            currentRoom.removePlayer(ws); // Now remove player data
        } else {
             console.log(`[Connection] Player ${playerUsernameForLog} closed connection but wasn't assigned to a room.`);
        }
    });

    ws.on('error', (error) => {
        console.error(`[Connection] WebSocket client error for ${playerUsernameForLog}:`, error);
         if (currentRoom) {
             console.error(`Removing player ${playerUsernameForLog} from room ${currentRoom.name} due to WebSocket error.`);
             currentRoom.dropPlayerOrbs(ws); // Try dropping orbs first
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