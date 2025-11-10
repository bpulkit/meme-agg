# Meme-Agg Backend

Live Demo: https://meme-agg-production.up.railway.app  
GitHub: https://github.com/bpulkit/meme-agg

## Overview
Meme-Agg is a backend service that collects trending meme tokens from different DEX sources.  
It has both REST API and WebSocket support to show real-time price and volume updates.  
The deployed version runs in mock mode so that it works without using external APIs.

## API Endpoints
Base URL: https://meme-agg-production.up.railway.app

GET /health  
Checks if the service is running.

GET /tokens?limit=10  
Returns a list of meme tokens with basic details.

GET /tokens?protocol=Orca  
Filters tokens by their exchange protocol.

WebSocket Events:
- subscribe : join the token feed
- initial_data : sends first batch of data
- price_update_batch and volume_spike_batch : send live updates

## How to Run Locally
git clone https://github.com/bpulkit/meme-agg.git  
cd meme-agg  
npm install  
MOCK_API=1 npm run build && node dist/index.js

Then open in browser:
http://localhost:3000/health  
http://localhost:3000/tokens?limit=5

## Testing
Tests are written using Jest.  
Run tests with:
npm test  
All REST and WebSocket tests pass successfully.

## Design Notes
Built with Node.js, TypeScript, Express, and Socket.io.  
Mock data is used for demo stability.  
Recent data is cached in memory for faster response.  
Connected clients receive frequent live updates.

## API Testing with Postman

Import the file `postman_collection.json` from the repo root into Postman.

Test requests included:
- GET /health
- GET /tokens?limit=10
- GET /tokens?protocol=Orca
- GET /tokens?minVolume=400
- GET /debug/fetch

## Demo Summary
/health returns ok  
/tokens returns mock token data  
WebSocket connections show live updates  
Multiple API calls respond quickly without lag

