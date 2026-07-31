/* ============================================================
   Striate — server.js
   Node.js HTTP Server for Striate v0.3.
   - Serves static app files (HTML/CSS/JS) & clean URL routing.
   - Serves backend routes for WorkoutX integration (/api/exercises/*)
   - Serves /api/coach with WorkoutX shortlist candidate exercises.
   - Comprehensive debugging logs for params, status, shortlist,
     AI-selected exercises, and fallback activation.
============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { callGemini, getApiKey, getModel } = require('./server/gemini');
const workoutx = require('./server/workoutx');

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

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const searchParams = Object.fromEntries(urlObj.searchParams.entries());

  // Set CORS / security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Health Endpoint ---
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'Striate AI & WorkoutX Backend',
      aiConfigured: !!getApiKey(),
      workoutxConfigured: !!workoutx.getApiKey(),
      model: getModel(),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // --- WorkoutX Backend Exercise Routes ---
  if (pathname.startsWith('/api/exercises')) {
    try {
      console.log(`\n[Striate WorkoutX Route] GET ${pathname}`, searchParams);

      if (pathname === '/api/exercises/bodyPartList') {
        const result = await workoutx.getBodyPartList();
        sendJson(res, 200, result);
        return;
      }
      if (pathname === '/api/exercises/targetList') {
        const result = await workoutx.getTargetList();
        sendJson(res, 200, result);
        return;
      }
      if (pathname === '/api/exercises/search' || pathname === '/api/exercises') {
        const result = await workoutx.searchExercises(searchParams);
        console.log(`[Striate WorkoutX Route] Search returned ${result.count} exercises (total: ${result.total})`);
        sendJson(res, 200, result);
        return;
      }
      if (pathname.startsWith('/api/exercises/name/')) {
        const name = decodeURIComponent(pathname.split('/').pop());
        const result = await workoutx.searchExercises({ ...searchParams, name });
        sendJson(res, 200, result);
        return;
      }
      if (pathname.startsWith('/api/exercises/bodyPart/')) {
        const bodyPart = decodeURIComponent(pathname.split('/').pop());
        const result = await workoutx.searchExercises({ ...searchParams, bodyPart });
        sendJson(res, 200, result);
        return;
      }
      if (pathname.startsWith('/api/exercises/target/')) {
        const target = decodeURIComponent(pathname.split('/').pop());
        const result = await workoutx.searchExercises({ ...searchParams, target });
        sendJson(res, 200, result);
        return;
      }
      if (pathname.startsWith('/api/exercises/equipment/')) {
        const equipment = decodeURIComponent(pathname.split('/').pop());
        const result = await workoutx.searchExercises({ ...searchParams, equipment });
        sendJson(res, 200, result);
        return;
      }
      // Single exercise by ID
      const parts = pathname.split('/');
      const id = decodeURIComponent(parts[parts.length - 1]);
      if (id && id !== 'exercises') {
        const result = await workoutx.getExerciseById(id);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: 'Unknown exercise endpoint' });
      return;
    } catch (err) {
      console.error('[Striate WorkoutX Route] Error:', err.message);
      sendJson(res, 500, { error: err.message });
      return;
    }
  }

  // --- AI Coach Recommendation Endpoint ---
  if (pathname === '/api/coach' && req.method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const { profile, checkin, prevEntry, entryCount, context = {} } = payload;

      console.log('\n[Striate Server Debug] Incoming request to /api/coach');
      console.log(' - Profile Goal:', profile?.goal);
      console.log(' - Checkin Sleep:', checkin?.sleep);
      console.log(' - Dedicated Workout Time:', checkin?.dedicatedWorkoutTime || profile?.dedicatedWorkoutTime);

      // Shortlist exercises from WorkoutX for AI
      const shortlist = await workoutx.shortlistExercises(profile, checkin);
      context.candidateExercises = shortlist;
      console.log(`[Striate Server Debug] Shortlist passed to AI (${shortlist.length} items):`, shortlist.map((e) => e.name));

      if (!getApiKey()) {
        console.warn('[Striate Server Debug] GEMINI_API_KEY not set. Returning fallback signal to client.');
        sendJson(res, 200, {
          ok: false,
          source: 'fallback',
          shortlist,
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      console.log(`[Striate Server Debug] Calling Gemini API (model: ${getModel()})...`);
      const recommendation = await callGemini(profile, checkin, prevEntry, entryCount, context);

      const aiExercises = recommendation?.workout?.exercises || [];
      console.log(`[Striate Server Debug] Gemini API success. AI selected ${aiExercises.length} exercises:`, aiExercises.map((e) => e.name));

      sendJson(res, 200, {
        ok: true,
        source: 'gemini',
        shortlist,
        recommendation,
      });
      return;
    } catch (err) {
      console.error('[Striate Server Debug] Gemini call or validation FAILED. Signaling fallback to client:', err.message);
      sendJson(res, 200, {
        ok: false,
        source: 'fallback',
        error: err.message,
      });
      return;
    }
  }

  // --- Clean URL Routing for Static Files ---
  let filePath = pathname;
  if (pathname === '/') filePath = '/index.html';
  else if (pathname === '/today') filePath = '/today.html';
  else if (pathname === '/check-in') filePath = '/check-in.html';
  else if (pathname === '/history' || pathname === '/calendar') filePath = '/history.html';
  else if (pathname === '/stats') filePath = '/stats.html';
  else if (pathname === '/info') filePath = '/info.html';
  else if (pathname === '/exercise-library' || pathname === '/exercises') filePath = '/exercise-library.html';
  else if (pathname.startsWith('/exercise/')) filePath = '/exercise-library.html';

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
    console.log(` Striate v0.3 Server running at http://localhost:${PORT}`);
    console.log(` AI Provider: Google AI Studio / Gemini (${getModel()})`);
    console.log(` WorkoutX API: ${workoutx.getApiKey() ? 'CONFIGURED' : 'NOT CONFIGURED (Using Local Curated Library)'}`);
    console.log(`============================================================`);
  });
}

module.exports = server;
