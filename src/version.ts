import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let version = 'unknown';
try {
  const content = await fs.readFile(packageJsonPath, 'utf-8');
  version = JSON.parse(content).version ?? 'unknown';
} catch {
  // fallback if package.json is unavailable (e.g. after bundling)
}

export const VERSION = version;
