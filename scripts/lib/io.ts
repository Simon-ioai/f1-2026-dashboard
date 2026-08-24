import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA = join(ROOT, 'data');

// Minimal .env loader so local runs pick up ODDS_API_KEY without extra deps.
// GitHub Actions injects env vars directly and has no .env file.
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== '' && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function writeJson(relPath: string, value: unknown): void {
  const abs = join(ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(value, null, 2) + '\n', 'utf8');
  console.log(`wrote ${relPath}`);
}

export function readJson<T>(relPath: string): T | null {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, 'utf8')) as T;
}

export function listDir(relPath: string): string[] {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).sort();
}

/** Fetch JSON with retries and a hard timeout. Throws with a readable message on failure. */
export async function fetchJson<T>(url: string, opts: { retries?: number; headers?: Record<string, string> } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: opts.headers,
      });
      if (res.status === 429 && attempt < retries) {
        console.warn(`429 rate-limited on ${url}, waiting before retry ${attempt + 1}/${retries}`);
        await sleep(5_000 * attempt);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${url}: ${(await res.text()).slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(2_000 * attempt);
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${url}\n${String(lastError)}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
