const THREE = require('three');

// Constants for world generation
const WORLD_CONSTANTS = {
    PLAYER_HEIGHT: 10,
    PLAYER_RADIUS: 2,
    NUM_TOWERS: 3000,
    MAX_RADIUS: 4800,
    NUM_NEBULAS: 12,
    NUM_STARS: 30000,
    NUM_LARGE_STARS: 1000,
    STAR_RADIUS: 5400,
    LARGE_STAR_RADIUS: 1800,
    BRIDGE_CHANCE: 0.1
};

// Function to generate tower data
function generateTower(type, x, z) {
    const height = Math.random() * 300 + 150;
    const isFloating = Math.random() < 0.15;
    const baseHeight = isFloating ? Math.random() * 30 + 15 : 0;
    
    return {
        type,
        x,
        z,
        height,
        baseHeight,
        isFloating
    };
}

// Function to generate bridge data
function generateBridge(startPos, endPos, height) {
    const distance = Math.sqrt(
        Math.pow(endPos.x - startPos.x, 2) + 
        Math.pow(endPos.z - startPos.z, 2)
    );
    
    const midPoint = {
        x: (startPos.x + endPos.x) / 2,
        y: height,
        z: (startPos.z + endPos.z) / 2
    };
    
    const angle = Math.atan2(endPos.z - startPos.z, endPos.x - startPos.x);
    
    return {
        startPos,
        endPos,
        midPoint,
        distance,
        angle,
        height
    };
}

// Function to generate nebula data
function generateNebula(index) {
    const angle = (index / WORLD_CONSTANTS.NUM_NEBULAS) * Math.PI * 2;
    const radius = 4500;
    const position = {
        x: Math.cos(angle) * radius,
        y: Math.random() * 2400 - 600,
        z: Math.sin(angle) * radius
    };
    const scale = 4 + Math.random() * 6;
    const rotation = {
        x: Math.random() * Math.PI,
        y: Math.random() * Math.PI,
        z: Math.random() * Math.PI
    };
    
    return {
        position,
        scale,
        rotation
    };
}

// Function to generate star data
function generateStar(isLarge = false) {
    const radius = isLarge ? WORLD_CONSTANTS.LARGE_STAR_RADIUS : WORLD_CONSTANTS.STAR_RADIUS;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        isLarge
    };
}

// Main function to generate the entire world
function generateWorld() {
    // Generate towers
    const gridSize = Math.sqrt(WORLD_CONSTANTS.NUM_TOWERS);
    const spacing = (WORLD_CONSTANTS.MAX_RADIUS * 2) / gridSize;
    const towers = [];
    const towerPositions = [];
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const x = -WORLD_CONSTANTS.MAX_RADIUS + i * spacing + (Math.random() * spacing * 0.5);
            const z = -WORLD_CONSTANTS.MAX_RADIUS + j * spacing + (Math.random() * spacing * 0.5);
            
            const offsetX = (Math.random() - 0.5) * spacing * 0.5;
            const offsetZ = (Math.random() - 0.5) * spacing * 0.5;
            
            const finalX = x + offsetX;
            const finalZ = z + offsetZ;
            
            const towerType = Math.floor(Math.random() * 12);
            const tower = generateTower(towerType, finalX, finalZ);
            towers.push(tower);
            
            towerPositions.push({
                position: { x: finalX, y: tower.height/2, z: finalZ },
                height: tower.height
            });
        }
    }
    
    // Generate bridges
    const bridges = [];
    const maxBridgeDistance = spacing * 2;
    
    for (let i = 0; i < towerPositions.length; i++) {
        for (let j = i + 1; j < towerPositions.length; j++) {
            const tower1 = towerPositions[i];
            const tower2 = towerPositions[j];
            
            const distance = Math.sqrt(
                Math.pow(tower2.position.x - tower1.position.x, 2) + 
                Math.pow(tower2.position.z - tower1.position.z, 2)
            );
            
            if (distance <= maxBridgeDistance && Math.random() < WORLD_CONSTANTS.BRIDGE_CHANCE) {
                const minHeight = Math.min(tower1.height, tower2.height);
                const bridgeHeight = minHeight * (0.3 + Math.random() * 0.5);
                
                const bridge = generateBridge(
                    tower1.position,
                    tower2.position,
                    bridgeHeight
                );
                bridges.push(bridge);
            }
        }
    }
    
    // Generate nebulas
    const nebulas = [];
    for (let i = 0; i < WORLD_CONSTANTS.NUM_NEBULAS; i++) {
        nebulas.push(generateNebula(i));
    }
    
    // Generate stars
    const stars = [];
    for (let i = 0; i < WORLD_CONSTANTS.NUM_STARS; i++) {
        stars.push(generateStar(false));
    }
    for (let i = 0; i < WORLD_CONSTANTS.NUM_LARGE_STARS; i++) {
        stars.push(generateStar(true));
    }
    
    return {
        towers,
        bridges,
        nebulas,
        stars,
        constants: WORLD_CONSTANTS
    };
}

module.exports = {
    generateWorld,
    WORLD_CONSTANTS
}; 