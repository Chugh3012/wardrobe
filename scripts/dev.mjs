#!/usr/bin/env node

/**
 * Full-stack local development — backend + frontend.
 *
 * 1. Builds the backend (tsc)
 * 2. Starts Azure Functions on :7071
 * 3. Starts Vite dev server on :5173 (after backend is ready)
 *
 * Usage:  npm run dev
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const shell = process.platform === 'win32';

// ── Pre-flight checks ───────────────────────────────────────────────────────
if (!existsSync(resolve(ROOT, 'backend', 'local.settings.json'))) {
  console.log('⚠  backend/local.settings.json not found.');
  console.log('   Copy from backend/local.settings.json.example and fill in your values.\n');
}

// ── Step 1: Build backend (synchronous — block until done) ──────────────────
console.log('🔧 Building backend...');
try {
  execSync('npm run prestart', { cwd: resolve(ROOT, 'backend'), stdio: 'inherit', shell });
} catch {
  console.error('❌ Backend build failed.');
  process.exit(1);
}

// ── Step 2: Start Azure Functions ───────────────────────────────────────────
console.log('\n🔧 Starting Azure Functions on :7071...');
const func = spawn('npx', ['func', 'start', '--port', '7071'], {
  cwd: resolve(ROOT, 'backend'), stdio: 'inherit', shell,
});

func.on('error', (err) => {
  console.error('Failed to start Azure Functions:', err.message);
  process.exit(1);
});

// ── Step 3: Poll for backend health, then start Vite ────────────────────────
async function waitAndStartFrontend() {
  console.log('⏳ Waiting for backend...');
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const res = await fetch('http://localhost:7071/api/health');
      if (res.ok) {
        console.log('✅ Backend ready!\n⚡ Starting frontend on :5173...\n');
        const vite = spawn('npx', ['vite', '--port', '5173'], {
          cwd: resolve(ROOT, 'frontend'), stdio: 'inherit', shell,
        });
        process.on('SIGINT', () => { func.kill(); vite.kill(); process.exit(0); });
        process.on('SIGTERM', () => { func.kill(); vite.kill(); process.exit(0); });
        return;
      }
    } catch { /* backend not ready yet */ }
  }
  console.error('❌ Backend did not start within 30 seconds.');
  func.kill();
  process.exit(1);
}

waitAndStartFrontend();
