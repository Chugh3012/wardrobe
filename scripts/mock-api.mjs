#!/usr/bin/env node

/**
 * Lightweight mock API server for frontend-only development.
 *
 * Returns realistic fake responses for all backend endpoints so you
 * can iterate on UI without running Azure Functions or connecting to
 * Azure services. No real data, no credentials needed.
 *
 * Usage:
 *   npm run dev:mock              — start mock API on :7071
 *   npm run dev:frontend-mock     — start frontend + mock API together
 *
 * The mock injects x-ms-client-principal-id for every request automatically.
 * Auth is entirely bypassed — this is ONLY for local UI development.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 7071;
const MOCK_USER_ID = 'mock-local-user-00000000';

// ── Sample images ───────────────────────────────────────────────────────────
// Real garment photos stored in scripts/fixtures/ (downloaded from Unsplash).
// Served at /mock-images/g1.jpg etc. so the UI shows actual clothing photos.

const FIXTURES_DIR = resolve(__dirname, 'fixtures');

const IMAGE_BUFFERS = {};
for (const id of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']) {
  const path = resolve(FIXTURES_DIR, `${id}.jpg`);
  if (existsSync(path)) {
    IMAGE_BUFFERS[id] = readFileSync(path);
  }
}

// ── Sample data ─────────────────────────────────────────────────────────────

const MOCK_GARMENTS = [
  { id: 'g1', name: 'Blue Denim Jacket', category: 'outerwear', wearCount: 12, thumbnailUrl: `http://localhost:${PORT}/mock-images/g1.jpg` },
  { id: 'g2', name: 'White T-Shirt', category: 'top', wearCount: 25, thumbnailUrl: `http://localhost:${PORT}/mock-images/g2.jpg` },
  { id: 'g3', name: 'Black Jeans', category: 'bottom', wearCount: 18, thumbnailUrl: `http://localhost:${PORT}/mock-images/g3.jpg` },
  { id: 'g4', name: 'Running Shoes', category: 'shoes', wearCount: 30, thumbnailUrl: `http://localhost:${PORT}/mock-images/g4.jpg` },
  { id: 'g5', name: 'Red Dress', category: 'dress', wearCount: 5, thumbnailUrl: `http://localhost:${PORT}/mock-images/g5.jpg` },
  { id: 'g6', name: 'Wool Scarf', category: 'accessory', wearCount: 8, thumbnailUrl: `http://localhost:${PORT}/mock-images/g6.jpg` },
];

const MOCK_STATS = {
  totalGarments: MOCK_GARMENTS.length,
  totalWearEvents: MOCK_GARMENTS.reduce((s, g) => s + g.wearCount, 0),
  garments: MOCK_GARMENTS.map(g => ({
    garmentId: g.id, name: g.name, category: g.category,
    wearCount: g.wearCount, lastWornDate: '2026-03-01T10:00:00Z',
  })),
  mostWorn: [
    { garmentId: 'g4', name: 'Running Shoes', wearCount: 30 },
    { garmentId: 'g2', name: 'White T-Shirt', wearCount: 25 },
  ],
  leastWorn: [
    { garmentId: 'g5', name: 'Red Dress', wearCount: 5 },
    { garmentId: 'g6', name: 'Wool Scarf', wearCount: 8 },
  ],
  forgotten: [
    { garmentId: 'g5', name: 'Red Dress', category: 'dress', lastWornDate: '2025-12-01T10:00:00Z', daysSinceWorn: 93 },
  ],
  streaks: { current: 3, longest: 14 },
  calendar: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-02-${String(i + 1).padStart(2, '0')}`,
    count: Math.floor(Math.random() * 3),
  })),
};

const MOCK_WEAR_EVENTS = [
  { id: 'we1', garmentId: 'g2', garmentName: 'White T-Shirt', category: 'top', outfitImageUrl: `http://localhost:${PORT}/mock-images/g2.jpg`, confidence: 0.92, createdAt: '2026-03-03T08:00:00Z' },
  { id: 'we2', garmentId: 'g3', garmentName: 'Black Jeans', category: 'bottom', outfitImageUrl: `http://localhost:${PORT}/mock-images/g3.jpg`, confidence: 0.88, createdAt: '2026-03-02T09:30:00Z' },
  { id: 'we3', garmentId: 'g1', garmentName: 'Blue Denim Jacket', category: 'outerwear', outfitImageUrl: `http://localhost:${PORT}/mock-images/g1.jpg`, confidence: 0.75, createdAt: '2026-03-01T07:15:00Z' },
];

let garmentCounter = MOCK_GARMENTS.length;

// ── Route handlers ──────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve(null); }
    });
  });
}

const ALLOWED_ORIGIN = 'http://localhost:5173';

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ms-client-principal-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

const routes = {
  'GET /api/health': (_req, res) => json(res, 200, { status: 'ok' }),

  'GET /api/garments': (_req, res) => json(res, 200, { garments: MOCK_GARMENTS }),

  'POST /api/garments': async (req, res) => {
    const body = await parseBody(req);
    if (!body?.name || !body?.category) return json(res, 400, { error: 'name and category required' });
    garmentCounter++;
    const garment = {
      id: `g${garmentCounter}`, userId: MOCK_USER_ID, name: body.name,
      category: body.category, catalogImageUrls: body.catalogImageUrls || [],
      wearCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    MOCK_GARMENTS.push({ id: garment.id, name: garment.name, category: garment.category, wearCount: 0, thumbnailUrl: `http://localhost:${PORT}/mock-images/g1.jpg` });
    json(res, 201, garment);
  },

  'POST /api/images/sas-url': async (req, res) => {
    const body = await parseBody(req);
    const blobName = body?.blobName || `mock-${Date.now()}.jpg`;
    json(res, 200, {
      blobName,
      uploadUrl: `http://localhost:${PORT}/mock-blob-upload/${blobName}`,
      readUrl: `http://localhost:${PORT}/mock-blob-read/${blobName}`,
    });
  },

  'POST /api/wear/predict': async (req, res) => {
    const body = await parseBody(req);
    if (!body?.outfitImageUrl) return json(res, 400, { error: 'outfitImageUrl required' });
    json(res, 200, {
      predictionAuditId: `pa-${Date.now()}`,
      source: 'embedding_fallback',
      confidenceLevel: 'medium',
      predictions: MOCK_GARMENTS.slice(0, 3).map((g, i) => ({
        garmentId: g.id, garmentName: g.name, confidence: 0.9 - i * 0.15,
      })),
    });
  },

  'POST /api/wear/confirm': async (req, res) => {
    const body = await parseBody(req);
    if (!body?.predictionAuditId || !body?.confirmedGarmentId) {
      return json(res, 400, { error: 'predictionAuditId and confirmedGarmentId required' });
    }
    json(res, 200, {
      id: `we-${Date.now()}`, userId: MOCK_USER_ID,
      garmentId: body.confirmedGarmentId, outfitImageUrl: '',
      predictedGarmentId: body.confirmedGarmentId,
      confidence: 0.85, confirmed: body.confirmed ?? true,
      createdAt: new Date().toISOString(),
    });
  },

  'GET /api/stats/summary': (_req, res) => json(res, 200, MOCK_STATS),

  'GET /api/wear/history': (_req, res) => json(res, 200, { events: MOCK_WEAR_EVENTS }),

  // Mock blob upload endpoint (accepts PUT silently)
  'PUT /mock-blob-upload': (_req, res) => { res.writeHead(201); res.end(); },
};

// ── Server ──────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ms-client-principal-id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Serve mock garment images (real photos from scripts/fixtures/)
  const imageMatch = path.match(/^\/mock-images\/(g\d+)\.(jpg|png)$/);
  if (imageMatch && req.method === 'GET') {
    const imgId = imageMatch[1];
    const buf = IMAGE_BUFFERS[imgId] || IMAGE_BUFFERS['g1'];
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': buf.length,
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Cache-Control': 'public, max-age=86400',
    });
    return res.end(buf);
  }

  // Also serve any /mock-blob-read/* as a garment image (for outfit preview)
  if (path.startsWith('/mock-blob-read/') && req.method === 'GET') {
    const buf = IMAGE_BUFFERS['g5']; // red dress photo for outfit preview
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': buf.length,
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    });
    return res.end(buf);
  }

  // Handle DELETE /api/wear/events/:id
  if (req.method === 'DELETE' && path.startsWith('/api/wear/events/')) {
    return json(res, 200, { deleted: true });
  }

  // Match route
  const routeKey = `${req.method} ${path}`;
  const handler = routes[routeKey];

  // Try prefix match for blob uploads
  if (!handler && req.method === 'PUT' && path.startsWith('/mock-blob-upload')) {
    res.writeHead(201); return res.end();
  }

  if (handler) {
    await handler(req, res);
  } else {
    json(res, 404, { error: `Mock API: no handler for ${req.method} ${path}` });
  }
});

server.listen(PORT, () => {
  console.log(`\n🎭 Mock API server running on http://localhost:${PORT}`);
  console.log(`   User ID: ${MOCK_USER_ID}`);
  console.log(`   Endpoints:`);
  Object.keys(routes).forEach(r => console.log(`     ${r}`));
  console.log(`\n   Tip: Use "npm run dev:frontend-mock" to start frontend + mock together.\n`);
});
