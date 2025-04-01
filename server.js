const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
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

// WebSocket Server Setup
const wss = new WebSocket.Server({ server });

// Room management
const rooms = new Map(); // Stores GameRoom instances

// Player ID to WebSocket mapping (needed for signaling)
const players = new Map(); // peerId -> ws

// Generate unique ID for peers
function generatePeerId() {
    return 'peer-' + Math.random().toString(36).substring(2, 15);
}

class GameRoom {
    constructor(id) {
        this.id = id;
        this.name = generateRoomName();
        this.players = new Map(); // Use peerId as key
        this.worldData = generateWorld(); // Generate world once per room
        console.log(`Room ${this.name} (${this.id}) created.`);
    }

    addPlayer(ws, username, peerId) {
        if (this.isFull()) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            ws.close();
            return false;
        }

        // Check if username is already taken in this room
        for (const [existingPeerId, playerData] of this.players.entries()) {
            if (playerData.username === username) {
                ws.send(JSON.stringify({ type: 'error', message: 'Username already taken in this room' }));
                ws.close();
                return false;
            }
        }

        const playerData = {
            username: username,
            peerId: peerId, // Store peerId
            ws: ws, // Keep reference to ws for signaling
            orbs: 0,
            position: { x: 0, y: 10, z: 0 }, // Initial position
            rotation: { x: 0, y: 0, z: 0 }
        };
        this.players.set(peerId, playerData);
        players.set(peerId, ws); // Update global map
        ws.roomId = this.id; // Associate ws with room
        ws.peerId = peerId; // Associate ws with peerId

        console.log(`${username} (${peerId}) joined room ${this.name} (${this.id})`);

        // Send world data and current players to the new player
        const currentPlayersData = Array.from(this.players.values()).map(p => ({
            username: p.username,
            peerId: p.peerId, // Send peerId
            position: [p.position.x, p.position.y, p.position.z],
            rotation: [p.rotation.x, p.rotation.y, p.rotation.z],
            orbs: p.orbs
        }));

        ws.send(JSON.stringify({
            type: 'world_data',
            towers: this.worldData.towers,
            bridges: this.worldData.bridges,
            orbs: this.worldData.orbs,
            players: currentPlayersData,
            yourPeerId: peerId // Send the assigned peerId to the client
        }));

        // Notify other players in the room about the new player
        this.broadcast(JSON.stringify({
            type: 'player_joined',
            username: username,
            peerId: peerId, // Include peerId
            position: [0, 10, 0], // Initial position
            rotation: [0, 0, 0]
        }), peerId); // Exclude the new player

        this.broadcastRoomInfo();
        return true;
    }

    dropPlayerOrbs(peerId, deathPosition = null) {
        const playerData = this.players.get(peerId);
        if (!playerData || playerData.orbs <= 0) return; // No orbs to drop

        const droppedOrbs = [];
        const basePosition = deathPosition || playerData.position || { x: 0, y: 10, z: 0 }; // Use player's last known position or default
        const numOrbsToDrop = playerData.orbs;

        console.log(`[Orb Drop Server Debug] Player ${playerData.username} dropping ${numOrbsToDrop} orbs near`, basePosition);

        for (let i = 0; i < numOrbsToDrop; i++) {
            // Generate a unique ID for the dropped orb
            const orbId = `dropped-${peerId}-${Date.now()}-${i}`;

            // Slightly randomized position around the base
            const dropX = basePosition.x + (Math.random() - 0.5) * 10;
            const dropY = basePosition.y + 5 + Math.random() * 5; // Drop slightly above and spread vertically
            const dropZ = basePosition.z + (Math.random() - 0.5) * 10;

            const droppedOrbData = {
                id: orbId,
                position: { x: dropX, y: dropY, z: dropZ },
                color: Math.floor(Math.random() * 0xFFFFFF), // Random color for dropped orbs
                size: 1.0, // Standard size for dropped orbs
                isDropped: true // Flag as dropped
            };
            droppedOrbs.push(droppedOrbData);

            // Add dropped orb to the room's world data so new players see it
            this.worldData.orbs.push(droppedOrbData);
        }

        console.log(`[Orb Drop Server Debug] Broadcasting ${droppedOrbs.length} dropped orbs.`);

        // Broadcast the dropped orbs to everyone in the room
        this.broadcast(JSON.stringify({
            type: 'orbs_dropped',
            orbs: droppedOrbs
        }));

        // Reset the player's orb count
        playerData.orbs = 0;
    }

    removePlayer(peerId) {
        const playerData = this.players.get(peerId);
        if (playerData) {
            console.log(`${playerData.username} (${peerId}) left room ${this.name} (${this.id})`);

            // Drop orbs before removing player data
            this.dropPlayerOrbs(peerId, playerData.position);

            this.players.delete(peerId);
            players.delete(peerId); // Remove from global map

            // Notify remaining players
            this.broadcast(JSON.stringify({
                type: 'player_left',
                peerId: peerId,
                username: playerData.username // Keep username for display
            }), null); // Send to everyone

            this.broadcastRoomInfo();
        } else {
             console.log(`Attempted to remove non-existent player with peerId ${peerId} from room ${this.name}`);
        }

        // If room becomes empty, potentially clean it up
        if (this.players.size === 0) {
            this.cleanup();
        }
    }

    broadcastRoomInfo() {
        const playerCount = this.players.size;
        this.broadcast(JSON.stringify({
            type: 'room_info',
            name: this.name,
            playerCount: playerCount
        }));
    }

    isFull() {
        return this.players.size >= 20;
    }

    broadcast(message, excludePeerId = null) {
        this.players.forEach((playerData, peerId) => {
            if (peerId !== excludePeerId && playerData.ws && playerData.ws.readyState === WebSocket.OPEN) {
                try {
                    playerData.ws.send(message);
                } catch (error) {
                    console.error(`Error sending message to ${playerData.username} (${peerId}):`, error);
                    // Consider removing player if WebSocket is broken
                    this.removePlayer(peerId);
                }
            }
        });
    }

    cleanup() {
        console.log(`Room ${this.name} (${this.id}) is empty, removing.`);
        rooms.delete(this.id);
    }

    handleMessage(ws, peerId, data) {
        const senderData = this.players.get(peerId);
        if (!senderData) {
             console.warn(`Received message from unknown peerId ${peerId} in room ${this.name}`);
             return; // Ignore messages from unknown peers
        }

        // --- Update player state (position, etc.) based on WebSocket messages if needed --- 
        // --- (Could keep some reliable messages like chat, score updates via WS) --- 
        if (data.type === 'position' && data.position) {
             senderData.position = { x: data.position[0], y: data.position[1], z: data.position[2] };
             senderData.rotation = data.rotation ? { x: data.rotation[0], y: data.rotation[1], z: data.rotation[2] } : senderData.rotation;
             // OPTIONAL: Broadcast position via WS for fallback or debugging, but primary is WebRTC
             // this.broadcast(JSON.stringify({...data, peerId: peerId }), peerId);
        } else if (data.type === 'collect_orb') {
             // Handle orb collection logic (remove from world, update player count, broadcast)
             const orbId = data.orbId;
             const orbIndex = this.worldData.orbs.findIndex(orb => orb.id === orbId);
             if (orbIndex !== -1) {
                 this.worldData.orbs.splice(orbIndex, 1); // Remove orb
                 senderData.orbs = (senderData.orbs || 0) + 1;
                 console.log(`${senderData.username} collected orb ${orbId}. Total: ${senderData.orbs}`);
                 // Broadcast orb collection
                 this.broadcast(JSON.stringify({
                     type: 'orb_collected',
                     orbId: orbId,
                     peerId: peerId, // Send collector's peerId
                     username: senderData.username // Send username for display
                 }));
                 // Check for ruler status (optional)
                 if (senderData.orbs >= 30) {
                      // Handle becoming ruler
                 }
             } else {
                  console.log(`Player ${senderData.username} tried to collect non-existent orb ${orbId}`);
             }
        } else if (data.type === 'player_died') {
             console.log(`Player ${senderData.username} died. Dropping orbs.`);
             // Use the position sent by the client in the death message
             const deathPosition = data.position ? { x: data.position[0], y: data.position[1], z: data.position[2] } : senderData.position;
             this.dropPlayerOrbs(peerId, deathPosition);
             // Broadcast death event (optional)
             this.broadcast(JSON.stringify({ type: 'player_died_broadcast', peerId: peerId, username: senderData.username }), peerId);
        }
        // --- Add other reliable message handlers (chat, game reset, ruler status etc.) --- 
        
        // --- Relay WebRTC Signaling Messages --- 
        else if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice'].includes(data.type)) {
            const recipientPeerId = data.toId;
            const recipientWs = players.get(recipientPeerId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                // Add sender's peerId if not present (for context on receiver side)
                data.fromId = peerId;
                try {
                    recipientWs.send(JSON.stringify(data));
                    // console.log(`Relayed ${data.type} from ${peerId} to ${recipientPeerId}`);
                } catch (error) {
                     console.error(`Error relaying ${data.type} to ${recipientPeerId}:`, error);
                }
            } else {
                console.warn(`Cannot relay ${data.type}: Recipient ${recipientPeerId} not found or WebSocket not open.`);
            }
        }
        // --- Handle other specific game logic messages --- 
        else {
             console.log(`Received unhandled message type: ${data.type} from ${peerId}`);
        }
    }
}

// Function to create a new room
function createNewRoom() {
    const roomId = 'room-' + Math.random().toString(36).substring(2, 9);
    const room = new GameRoom(roomId);
    rooms.set(roomId, room);
    return room;
}

// Function to find an available room or create a new one
function findAvailableRoom() {
    for (const [roomId, room] of rooms.entries()) {
        if (!room.isFull()) {
            return room;
        }
    }
    // No available rooms, create a new one
    return createNewRoom();
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');
    ws.peerId = generatePeerId(); // Assign unique ID on initial connection
    ws.roomId = null; // Not in a room initially

    let currentRoom = null;
    let playerUsernameForLog = 'unknown';

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Handle initial join message
            if (data.type === 'join' && data.username) {
                playerUsernameForLog = data.username; // Store for logging
                currentRoom = findAvailableRoom();
                if (currentRoom.addPlayer(ws, data.username, ws.peerId)) {
                    // Successfully added to room
                    console.log(`WebSocket for ${playerUsernameForLog} (${ws.peerId}) associated with room ${currentRoom.name}`);
                } else {
                    // Failed to add (e.g., room full, username taken)
                    currentRoom = null; // Reset currentRoom
                    playerUsernameForLog = 'unknown'; // Reset log name
                }
            } 
            // Handle world data request (should happen before join usually)
            else if (data.type === 'request_world_data') {
                 // This might be handled differently now. World data sent on join.
                 console.log('Received request_world_data (handled on join)');
            }
            // Handle messages within a room context
            else if (currentRoom) {
                currentRoom.handleMessage(ws, ws.peerId, data);
            }
            // Handle messages before joining a room (if any)
            else {
                console.log('Received message before joining a room:', data.type);
            }

        } catch (error) {
            console.error('Failed to parse message or handle client request:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        console.log(`WebSocket closed for player: ${playerUsernameForLog} (${ws.peerId}).`);
        if (ws.roomId && rooms.has(ws.roomId)) {
            const room = rooms.get(ws.roomId);
            room.removePlayer(ws.peerId); // Use peerId to remove
        } else {
             // Also remove from global map if they never joined a room
             players.delete(ws.peerId);
        }
        console.log(`Remaining global players map size: ${players.size}`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket client error for ${playerUsernameForLog} (${ws.peerId}):`, error);
        if (ws.roomId && rooms.has(ws.roomId)) {
             const room = rooms.get(ws.roomId);
             console.error(`Removing player ${playerUsernameForLog} (${ws.peerId}) from room ${room.name} due to WebSocket error.`);
             room.removePlayer(ws.peerId);
        } else {
             players.delete(ws.peerId);
        }
    });
});

wss.on('error', (error) => {
    console.error('WebSocket Server Error:', error);
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// --- Vector Math Utilities (Keep if used elsewhere) --- 
// Define Vector3 class (basic implementation)
function Vector3(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
}

Vector3.prototype.set = function(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    return this;
};

Vector3.prototype.copy = function(v) {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
};

Vector3.prototype.add = function(v) {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
};

Vector3.prototype.sub = function(v) {
    this.x -= v.x; this.y -= v.y; this.z -= v.z;
    return this;
};

Vector3.prototype.multiplyScalar = function(s) {
    this.x *= s; this.y *= s; this.z *= s;
    return this;
};

Vector3.prototype.lengthSq = function() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
};

Vector3.prototype.length = function() {
    return Math.sqrt(this.lengthSq());
};

Vector3.prototype.normalize = function() {
    const len = this.length();
    if (len > 0) {
        this.multiplyScalar(1 / len);
    }
    return this;
};

function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function angleBetween(v1, v2) {
    const dot = dotProduct(v1, v2);
    const len1 = v1.length();
    const len2 = v2.length();
    if (len1 === 0 || len2 === 0) return 0; // Avoid division by zero
    const cosTheta = dot / (len1 * len2);
    return Math.acos(Math.max(-1, Math.min(1, cosTheta))); // Clamp value to [-1, 1]
}

// Quaternion class (basic implementation for rotations)
function Quaternion(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
}

Quaternion.prototype.setFromAxisAngle = function(axis, angle) {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(halfAngle);
    return this;
};

Quaternion.prototype.multiplyQuaternions = function(a, b) {
    const qax = a.x, qay = a.y, qaz = a.z, qaw = a.w;
    const qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w;

    this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

    return this;
};

// Apply quaternion rotation to a vector
Vector3.prototype.applyQuaternion = function(q) {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;

    // calculate quat * vector
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;

    return this;
}; 