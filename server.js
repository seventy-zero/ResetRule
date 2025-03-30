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

    removePlayer(ws) {
        const username = ws.username;
        if (username && this.players.has(username)) {
            const playerData = this.players.get(username);
            const lastKnownPosition = playerData ? playerData.position : null; // Get position BEFORE deleting
            const orbCount = this.playerOrbs.get(username) || 0;

            // --- Orb Drop Logging ---
            console.log(`[Server RemovePlayer Orb Drop] Player ${username} leaving. Orb count: ${orbCount}. Last known pos:`, lastKnownPosition);
            if (orbCount > 0 && lastKnownPosition) {
                 this.dropPlayerOrbs(username, orbCount, lastKnownPosition);
            } else {
                 console.log(`[Server RemovePlayer Orb Drop] Not dropping orbs for ${username} (Count: ${orbCount}, Pos Valid: ${!!lastKnownPosition})`);
            }
            // -----------------------

            this.players.delete(username);
            this.playerOrbs.delete(username); // Ensure orbs are cleared server-side too

            // Remove player from ruler status if they were the ruler
            if (this.currentRuler === username) {
                this.currentRuler = null;
                console.log(`Ruler ${username} left the room.`);
                // Broadcast new ruler status (null)
                this.broadcast(JSON.stringify({ type: 'new_ruler', username: null }), null);
            }

            console.log(`Player ${username} removed from room ${this.name}`);
            this.broadcastRoomInfo();
            this.broadcast(JSON.stringify({ type: 'player_left', username: username }), ws); // Notify others
        } else if (username) {
             console.log(`[Server RemovePlayer] Attempted to remove ${username}, but they were not found in the players map.`);
        } else {
             console.log('[Server RemovePlayer] Attempted to remove a player with no username (connection likely closed before join).');
        }

        // Ensure the WebSocket connection is properly handled (if applicable)
        // Depending on structure, might need ws.close() or similar here if not handled elsewhere
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

    handleMessage(ws, message) {
        const username = ws.username;
        if (!username) {
            // If player hasn't joined properly yet, handle basic messages like 'join'
            if (message.type === 'join' && message.username) {
                this.addPlayer(ws, message.username);
            }
            return; // Ignore other messages if not joined
        }

        const player = this.players.get(username);
        if (!player) {
            console.warn(`Message received from user ${username} but no player data found.`);
            return;
        }

        switch (message.type) {
            case 'position':
                // Update player position, rotation, speed, etc.
                // Validate message.position and message.rotation structure
                if (message.position && Array.isArray(message.position) && message.position.length === 3) {
                    player.position = { x: message.position[0], y: message.position[1], z: message.position[2] };
                } else {
                    console.warn(`Invalid position data received from ${username}:`, message.position);
                }
                if (message.rotation && Array.isArray(message.rotation) && message.rotation.length === 3) {
                     player.rotation = { x: message.rotation[0], y: message.rotation[1], z: message.rotation[2] };
                } else {
                     console.warn(`Invalid rotation data received from ${username}:`, message.rotation);
                }
                player.speed = message.speed || 0;
                player.heading = message.heading || 0;
                player.verticalSpeed = message.verticalSpeed || 0;
                player.lastUpdateTime = Date.now();

                // Broadcast position to other players in the room
                this.broadcast(JSON.stringify({
                    type: 'position',
                    username: username,
                    position: message.position, // Send validated or raw?
                    rotation: message.rotation,
                    speed: player.speed,
                    heading: player.heading,
                    verticalSpeed: player.verticalSpeed
                }), ws);
                break;

            case 'shotgun_shot':
                 // Validate position and directions exist
                 if (message.position && message.directions) {
                     this.broadcast(JSON.stringify({
                         type: 'shotgun_shot',
                         username: username,
                         position: message.position,
                         directions: message.directions
                     }), ws);
                 } else {
                      console.warn(`Invalid shotgun_shot data from ${username}:`, message);
                 }
                 break;

            case 'player_damaged':
                 const victimUsername = message.victimUsername;
                 const victimWs = this.players.get(victimUsername);
                 if (victimWs) {
                      // Forward the damage message only to the victim
                      this.broadcast(JSON.stringify({
                          type: 'player_damaged',
                          victimUsername: victimUsername,
                          attackerUsername: username, // The sender of this message is the attacker
                          damage: message.damage || 0
                      }), ws);
                      console.log(`[Server Damage] Sent damage message to ${victimUsername} from ${username}`);
                 } else {
                      console.log(`[Server Damage] Victim ${victimUsername} not found for damage message from ${username}.`);
                 }
                 break;

            case 'collect_orb':
                 const orbId = message.orbId;
                 const currentOrbCount = this.playerOrbs.get(username) || 0;
                 
                 console.log(`[Server Collect Orb] ${username} attempting to collect orb ${orbId}. Current count: ${currentOrbCount}`);
                 
                 // Check server-side orb count cap AND if orb exists
                 if (currentOrbCount < 30 && this.world.orbs.has(orbId)) {
                      this.world.orbs.delete(orbId);
                      this.playerOrbs.set(username, currentOrbCount + 1);
                      console.log(`[Server Collect Orb] Orb ${orbId} collected by ${username}. New count: ${currentOrbCount + 1}`);
                      
                      // Broadcast orb collection to all players
                      this.broadcast(JSON.stringify({
                          type: 'orb_collected',
                          orbId: orbId,
                          username: username
                      }), ws);
                 } else if (currentOrbCount >= 30) {
                      console.log(`[Server Collect Orb] Orb collection denied for ${username} (Orb ${orbId}). Reason: Orb cap reached.`);
                 } else if (!this.world.orbs.has(orbId)) {
                      console.log(`[Server Collect Orb] Orb collection denied for ${username} (Orb ${orbId}). Reason: Orb already collected or doesn't exist.`);
                 }
                 break;

            case 'player_died':
                if (username) {
                    const orbCount = this.playerOrbs.get(username) || 0;
                    // Validate and extract position object carefully
                    let deathPosition = null;
                    if (message.position && Array.isArray(message.position) && message.position.length === 3) {
                         deathPosition = { x: message.position[0], y: message.position[1], z: message.position[2] };
                    } else {
                         console.warn(`[Server PlayerDied] Invalid or missing position in player_died message from ${username}:`, message.position);
                         // Attempt to use last known position as a fallback
                         const playerData = this.players.get(username);
                         if (playerData && playerData.position) {
                             deathPosition = playerData.position;
                             console.warn(`[Server PlayerDied] Using last known position for ${username} as fallback.`);
                         } else {
                              console.error(`[Server PlayerDied] CRITICAL: Cannot drop orbs for ${username} - no valid position available.`);
                         }
                    }

                    // --- Orb Drop Logging ---
                    console.log(`[Server PlayerDied Orb Drop] Player ${username} died. Orb count: ${orbCount}. Death pos:`, deathPosition);
                    if (orbCount > 0 && deathPosition) {
                         this.dropPlayerOrbs(username, orbCount, deathPosition);
                    } else {
                         console.log(`[Server PlayerDied Orb Drop] Not dropping orbs for ${username} (Count: ${orbCount}, Pos Valid: ${!!deathPosition})`);
                    }
                    // -----------------------

                    // Clear player's orbs server-side AFTER dropping
                    this.playerOrbs.set(username, 0);
                    // Optionally, broadcast the death event to others if needed for effects/scores
                    // this.broadcast({ type: 'player_death_event', username: username, position: deathPosition }, ws);
                }
                break;
                
            case 'request_world_data':
                 // Send the existing world data to the requesting client
                 this.broadcast(JSON.stringify({
                     type: 'world_data',
                     towers: this.world.towers,
                     bridges: this.world.bridges,
                     orbs: this.world.orbs
                 }), ws);
                 console.log(`Sent world data to ${username || 'new connection'}`);
                 break;

             case 'new_ruler':
                 // Update ruler status and broadcast
                 if (username && this.playerOrbs.get(username) >= 30) {
                     this.currentRuler = username;
                     console.log(`${username} claimed ruler status in room ${this.name}`);
                     this.broadcast(JSON.stringify({ type: 'new_ruler', username: username }));
                 } else {
                      console.warn(`Attempt to claim ruler by ${username} failed (not enough orbs or invalid user).`);
                 }
                 break;

            case 'reset_game':
                 // Handle game reset initiated by a player
                 console.log(`Game reset initiated by ${username} in room ${this.name}`);
                 // Reset orb counts for all players
                 this.playerOrbs.forEach((_, playerName) => {
                     this.playerOrbs.set(playerName, 0);
                 });
                 // Clear ruler status
                 this.currentRuler = null;
                 // Broadcast the reset event so clients can react
                 this.broadcast(JSON.stringify({ type: 'reset_game' }));
                 break;

             // Add default case to handle unknown message types
             default:
                  console.log(`Received unknown message type '${message.type}' from ${username}`);
                  break;
        }
    }

    dropPlayerOrbs(username, count, position) {
        // --- Orb Drop Logging ---
        console.log(`[Server DropPlayerOrbs ENTRY] User: ${username}, Count: ${count}, Position:`, position);
        if (!position || typeof position.x === 'undefined' || typeof position.y === 'undefined' || typeof position.z === 'undefined') {
            console.error(`[Server DropPlayerOrbs] CRITICAL: Invalid position received for ${username}:`, position); // Log as error
            return; // Don't drop if position is invalid
        }
        if (count <= 0) {
            console.log(`[Server DropPlayerOrbs] No orbs to drop for ${username} (count is ${count})`);
            return; // Don't drop if count is zero or less
        }
        // -----------------------

        const droppedOrbs = [];
        const dropRadius = 10; // Spread orbs around the drop point

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radiusOffset = Math.random() * dropRadius;
            const orbX = position.x + Math.cos(angle) * radiusOffset;
            const orbZ = position.z + Math.sin(angle) * radiusOffset;
            // Drop slightly above the reported position, add some vertical spread
            const orbY = position.y + Math.random() * 5 + 1; 

            // Simple check to avoid dropping orbs below a minimum height (e.g., ground level 0)
            const finalOrbY = Math.max(orbY, 2); 

            const newOrb = {
                id: `orb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`, // More robust unique ID
                position: { x: orbX, y: finalOrbY, z: orbZ },
                // Match orb properties from generateWorld
                color: Math.floor(Math.random() * 0xFFFFFF),
                size: Math.random() * 0.5 + 0.5 
            };
            this.world.orbs.push(newOrb);
            droppedOrbs.push(newOrb);
        }

        // --- Orb Drop Logging ---
        console.log(`[Server DropPlayerOrbs] Generated ${droppedOrbs.length} orbs for ${username}.`);
        if (droppedOrbs.length > 0) {
             console.log(`[Server DropPlayerOrbs] Broadcasting 'orbs_dropped' for ${username} with ${droppedOrbs.length} orbs.`);
             this.broadcast(JSON.stringify({ type: 'orbs_dropped', orbs: droppedOrbs }));
        } else {
             console.log(`[Server DropPlayerOrbs] No orbs generated for ${username}, skipping broadcast.`);
        }
        // -----------------------
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