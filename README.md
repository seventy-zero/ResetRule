# ResetRule Multiplayer

A multiplayer first-person game built with Three.js and WebSocket.

## Features
- Real-time multiplayer gameplay
- Dynamic environment with towers and bridges
- Player movement and collision detection
- Grappling hook mechanic
- Username display above players

## Deployment on Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add the following environment variables (if needed):
   - `PORT` (optional, defaults to 3000)

Railway will automatically:
- Detect the Node.js project
- Install dependencies
- Run the start script
- Assign a domain

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open http://localhost:3000 in your browser

## Tech Stack
- Three.js for 3D graphics
- Express.js for the server
- WebSocket for real-time communication
- Node.js for the backend

## Requirements
- Node.js >= 18.0.0
- NPM or Yarn package manager 