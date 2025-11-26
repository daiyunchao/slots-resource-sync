import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let config = null;

export function loadConfig() {
  if (config) return config;

  try {
    const configPath = join(__dirname, '../../config/default.json');
    const configData = readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
    return config;
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

export function getConfig() {
  if (!config) {
    return loadConfig();
  }
  return config;
}
