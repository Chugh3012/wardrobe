#!/usr/bin/env node

/**
 * Full-stack local development orchestrator.
 *
 * Starts the Vite dev server (frontend) and Azure Functions Core Tools
 * (backend) concurrently. The Vite config proxies /api/* requests to the
 * Functions host, so the frontend talks to the backend through a single
 * origin — no CORS issues, no extra configuration.
 *
 * Prerequisites:
 *   1. Azure Functions Core Tools v4 installed (`npm i -g azure-functions-core-tools@4`)
 *   2. `az login` completed (for DefaultAzureCredential → Cosmos/Blob access)
 *   3. backend/local.settings.json configured (copy from local.settings.json.example)
 *   4. frontend/.env.local configured (copy from .env.local.example)
 *
 * Usage:
 *   npm run dev           — starts both services
 *   npm run dev:frontend  — frontend only (uses mock or Azure backend)
 *   npm run dev:backend   — backend only
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Pre-flight checks ───────────────────────────────────────────────────────

const localSettings = resolve(ROOT, 'backend', 'local.settings.json');
const envLocal = resolve(ROOT, 'frontend', '.env.local');

let warnings = [];

if (!existsSync(localSettings)) {
  warnings.push(
    `⚠  backend/local.settings.json not found.\n` +
    `   Copy from backend/local.settings.json.example and fill in your values.\n` +
    `   The backend will start but Azure service calls will fail.`
  );
}

if (!existsSync(envLocal)) {
  warnings.push(
    `⚠  frontend/.env.local not found.\n` +
    `   Copy from frontend/.env.local.example and fill in your values.\n` +
    `   Using defaults (API proxied to localhost:7071).`
  );
}

if (warnings.length > 0) {
  console.log('\n╭─────────────────────────────────────────────╮');
  console.log('│  Wardrobe Tracker — Local Development Setup  │');
  console.log('╰─────────────────────────────────────────────╯\n');
  warnings.forEach(w => console.log(w + '\n'));
  console.log('─'.repeat(50) + '\n');
}

// ── Launch backend (Azure Functions Core Tools) ─────────────────────────────

console.log('🔧 Starting backend (Azure Functions on :7071)...');
// On Windows, npm/npx are .cmd batch files that require shell: true.
const spawnOpts = { stdio: 'inherit', shell: process.platform === 'win32' };

const backend = spawn('npm', ['run', 'prestart'], {
  ...spawnOpts, cwd: resolve(ROOT, 'backend'),
});

backend.on('close', (code) => {
  if (code !== 0) {
    console.error(`Backend build failed with code ${code}`);
    process.exit(1);
  }

  const funcStart = spawn('npx', ['func', 'start', '--port', '7071'], {
    ...spawnOpts, cwd: resolve(ROOT, 'backend'),
  });

  funcStart.on('error', (err) => {
    console.error('Failed to start Azure Functions:', err.message);
    console.error('Make sure Azure Functions Core Tools v4 is installed:');
    console.error('  npm install -g azure-functions-core-tools@4 --unsafe-perm true');
    process.exit(1);
  });

  // Clean shutdown
  process.on('SIGINT', () => { funcStart.kill('SIGINT'); });
  process.on('SIGTERM', () => { funcStart.kill('SIGTERM'); });
});

// ── Launch frontend (Vite dev server) ───────────────────────────────────────

console.log('⚡ Starting frontend (Vite on :5173)...');
const frontend = spawn('npx', ['vite', '--port', '5173'], {
  ...spawnOpts, cwd: resolve(ROOT, 'frontend'),
});

frontend.on('error', (err) => {
  console.error('Failed to start Vite:', err.message);
  process.exit(1);
});

process.on('SIGINT', () => { frontend.kill('SIGINT'); });
process.on('SIGTERM', () => { frontend.kill('SIGTERM'); });
