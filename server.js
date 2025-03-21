const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
        this.players = new Map();
        this.isActive = true;
    }

    addPlayer(ws, username) {
        this.players.set(ws, {
            username: username,
            position: { x: 0, y: 10, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        });
    }

    removePlayer(ws) {
        this.players.delete(ws);
        if (this.players.size === 0) {
            this.isActive = false;
        }
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
}

// Rooms management
let rooms = [];
let nextRoomId = 1;

function createNewRoom() {
    const room = new GameRoom(nextRoomId++);
    rooms.push(room);
    console.log(`Created new room ${room.id}`);
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

// Clean up inactive rooms periodically
setInterval(() => {
    rooms = rooms.filter(room => room.isActive);
}, 60000); // Clean up every minute

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'join':
                currentRoom = findAvailableRoom();
                currentRoom.addPlayer(ws, data.username);
                
                // Send room information to the new player
                ws.send(JSON.stringify({
                    type: 'room_info',
                    roomId: currentRoom.roomId,
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
    });

    ws.on('close', () => {
        if (currentRoom) {
            const player = currentRoom.players.get(ws);
            if (player) {
                currentRoom.broadcast(JSON.stringify({
                    type: 'player_left',
                    username: player.username
                }));
                currentRoom.removePlayer(ws);
            }
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