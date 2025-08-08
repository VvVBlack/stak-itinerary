interface Env {
    GROK_API_KEY: string;
    ITINERARIES: KVNamespace;
  }
  
  interface ItineraryRequest {
    destination: string;
    durationDays: number;
  }
  
  async function generateItinerary(jobId: string, destination: string, durationDays: number, env: Env) {
    try {
      console.log(`Starting itinerary generation for jobId: ${jobId}`);
      const prompt = `
        Generate a travel itinerary for ${destination} for ${durationDays} days. 
        Return the response in JSON format with the following structure:
        {
          "itinerary": [
            {
              "day": 1,
              "theme": "string",
              "activities": [
                {
                  "time": "string",
                  "description": "string",
                  "location": "string"
                }
              ]
            }
          ]
        }
      `;
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
        }),
      });
      const data = await response.json();
      console.log(`Grok API response for jobId ${jobId}: ${JSON.stringify(data)}`);
  
      let itineraryData;
      try {
        itineraryData = JSON.parse(data.choices[0].message.content);
      } catch (e) {
        console.error(`Failed to parse Grok response for jobId ${jobId}: ${(e as Error).message}`);
        throw new Error(`Invalid JSON response from Grok: ${data.choices[0].message.content}`);
      }
  
      await env.ITINERARIES.put(jobId, JSON.stringify({
        status: 'completed',
        destination,
        durationDays,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        itinerary: itineraryData.itinerary,
        error: null,
      }));
      console.log(`Itinerary saved for jobId: ${jobId}`);
    } catch (e) {
      console.error(`Error generating itinerary for jobId ${jobId}: ${(e as Error).message}`);
      await env.ITINERARIES.put(jobId, JSON.stringify({
        status: 'failed',
        destination,
        durationDays,
        createdAt: new Date().toISOString(),
        completedAt: null,
        itinerary: [],
        error: (e as Error).message,
      }));
    }
  }
  
  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
  
      // Serve UI for root path
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Itinerary Generator</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              input, button { margin: 10px; padding: 8px; }
              #result { margin-top: 20px; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h1>Generate Travel Itinerary</h1>
            <input type="text" id="destination" placeholder="Destination">
            <input type="number" id="durationDays" placeholder="Duration (days)">
            <button onclick="generate()">Generate</button>
            <div id="result"></div>
            <script>
              async function generate() {
                const destination = document.getElementById('destination').value;
                const durationDays = parseInt(document.getElementById('durationDays').value);
                const resultDiv = document.getElementById('result');
                resultDiv.innerText = 'Generating...';
                try {
                  const response = await fetch('/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destination, durationDays })
                  });
                  const data = await response.json();
                  const jobId = data.jobId;
                  resultDiv.innerText = \`Job ID: \${jobId}. Fetching itinerary...\`;
                  // Poll for result
                  let attempts = 0;
                  const interval = setInterval(async () => {
                    const itineraryResponse = await fetch(\`/itinerary/\${jobId}\`);
                    const itineraryData = await itineraryResponse.json();
                    if (itineraryData.status === 'completed') {
                      clearInterval(interval);
                      resultDiv.innerText = JSON.stringify(itineraryData, null, 2);
                    } else if (itineraryData.status === 'failed') {
                      clearInterval(interval);
                      resultDiv.innerText = \`Error: \${itineraryData.error}\`;
                    } else if (attempts > 30) {
                      clearInterval(interval);
                      resultDiv.innerText = 'Timeout: Itinerary generation took too long';
                    }
                    attempts++;
                  }, 2000);
                } catch (e) {
                  resultDiv.innerText = \`Error: \${e.message}\`;
                }
              }
            </script>
          </body>
          </html>
          `,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
  
      // POST /generate - Generate new itinerary
      if (request.method === 'POST' && url.pathname === '/generate') {
        try {
          const data: ItineraryRequest = await request.json();
          const { destination, durationDays } = data;
  
          if (!destination || !durationDays) {
            return new Response('Missing destination or durationDays', { status: 400 });
          }
  
          const jobId = crypto.randomUUID();
          await env.ITINERARIES.put(jobId, JSON.stringify({
            status: 'processing',
            destination,
            durationDays,
            createdAt: new Date().toISOString(),
            completedAt: null,
            itinerary: [],
            error: null,
          }));
          console.log(`Saved processing state for jobId: ${jobId}`);
  
          setTimeout(() => generateItinerary(jobId, destination, durationDays, env), 0);
  
          return new Response(JSON.stringify({ jobId }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error(`Error in /generate for jobId: ${(e as Error).message}`);
          return new Response(`Error: ${(e as Error).message}`, { status: 500 });
        }
      }
  
      // GET /itinerary/:jobId - Get itinerary by jobId
      if (request.method === 'GET' && url.pathname.startsWith('/itinerary/')) {
        try {
          const jobId = url.pathname.split('/itinerary/')[1];
          if (!jobId) {
            return new Response('Missing jobId', { status: 400 });
          }
  
          const itinerary = await env.ITINERARIES.get(jobId);
          if (!itinerary) {
            return new Response('Itinerary not found', { status: 404 });
          }
  
          return new Response(itinerary, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error(`Error in /itinerary for jobId: ${(e as Error).message}`);
          return new Response(`Error: ${(e as Error).message}`, { status: 500 });
        }
      }
  
      return new Response('Method not allowed or invalid endpoint', { status: 405 });
    },
  };