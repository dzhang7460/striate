/* ============================================================
   Striate — server.js
   Node.js HTTP Server for Striate v0.2.
   - Serves static app files (HTML/CSS/JS).
   - Serves backend route /api/coach that calls Gemini API
     server-side and validates responses.
   - Logs all requests, payloads, responses, and validation status
     for debugging.
============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { callGemini, getApiKey, getModel } = require('./server/gemini');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2000000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Set CORS / security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API Routes ---
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'Striate AI Backend',
      aiConfigured: !!getApiKey(),
      model: getModel(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  if (pathname === '/api/coach' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const { profile, checkin, prevEntry, entryCount, context } = payload;

      console.log('\n[Striate Server Debug] Incoming request to /api/coach');
      console.log(' - Profile Goal:', profile?.goal);
      console.log(' - Checkin:', checkin);
      console.log(' - EntryCount:', entryCount);
      console.log(' - Dedicated Workout Time:', checkin?.dedicatedWorkoutTime || profile?.dedicatedWorkoutTime);

      if (!getApiKey()) {
        console.warn('[Striate Server Debug] GEMINI_API_KEY not set. Returning fallback signal.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          source: 'fallback',
          error: 'GEMINI_API_KEY is not configured on the server.',
        }));
        return;
      }

      console.log(`[Striate Server Debug] Calling Gemini API (model: ${getModel()})...`);
      const recommendation = await callGemini(profile, checkin, prevEntry, entryCount, context);

      console.log('[Striate Server Debug] Gemini API success & validation PASSED.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        source: 'gemini',
        recommendation,
      }));
      return;
    } catch (err) {
      console.error('[Striate Server Debug] Gemini call or validation FAILED. Signal fallback to client:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        source: 'fallback',
        error: err.message,
      }));
      return;
    }
  }

  // --- Static File Serving ---
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`============================================================`);
    console.log(` Striate v0.2 Server running at http://localhost:${PORT}`);
    console.log(` AI Provider: Google AI Studio / Gemini (${getModel()})`);
    console.log(` API Key Status: ${getApiKey() ? 'CONFIGURED' : 'NOT CONFIGURED (Will use Local Fallback Engine)'}`);
    console.log(`============================================================`);
  });
}

module.exports = server;
