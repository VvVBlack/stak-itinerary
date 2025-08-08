# Itinerary Generator

A Cloudflare Worker that generates travel itineraries using Grok API and stores results in Cloudflare KV.

## Features
- Generates travel itineraries for a given destination and duration.
- Uses Grok API for AI-powered itinerary generation.
- Stores results in Cloudflare KV for asynchronous processing.
- Simple HTML UI for user interaction.
- Deployed on Cloudflare Workers.

## Prerequisites
- Node.js 18+
- Cloudflare account
- Grok API key (from https://x.ai/api)
- Filtrshkn (for Iran)

## Setup
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd itinerary-generator
   
## Install dependencies:
    bash
npm install

## Set up environment variables:

Create .dev.vars with:
envGROK_API_KEY=your-grok-api-key

For production:
bashnpx wrangler secret put GROK_API_KEY



## Create KV Namespace:
bash
npx wrangler kv:namespace create ITINERARIES
Update wrangler.toml with the namespace ID.

## Run locally:
bash
npx wrangler dev

## Deploy to Cloudflare:
bash
npx wrangler deploy


Usage

Access UI: Open https://itinerary-generator.mohsenivandad.workers.dev in a browser.
API:
bashcurl -X POST https://itinerary-generator.mohsenivandad.workers.dev/generate -H "Content-Type: application/json" -d '{"destination": "Tokyo, Japan", "durationDays": 5}'
bashcurl -X GET https://itinerary-generator.mohsenivandad.workers.dev/itinerary/23ce42d7-b3a6-44f7-8c70-91eb8cc84b5e


